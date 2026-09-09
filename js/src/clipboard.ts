// The clipboard operations. Every function here calls navigator.clipboard
// *synchronously* before its first await: Safari and Firefox only accept a
// write while the click or key press that caused it is still being handled.
// None of them throws; failures are returned as protocol errors.

import { protocolError, toProtocolError } from "./errors";
import { legacyCopy } from "./fallback";
import type {
  Capabilities,
  Content,
  Item,
  PermissionState,
  ProtocolError,
  Representation,
  Result,
} from "./protocol";

export interface Options {
  /** Use document.execCommand("copy") where the async API is missing. Default true. */
  legacyFallback: boolean;
  /**
   * Replace characters that render as spaces (NBSP, thin spaces) with a plain
   * space and drop zero-width characters, so copied text matches what users
   * see. Default false.
   */
  normalizeWhitespace: boolean;
}

export const defaultOptions: Options = {
  legacyFallback: true,
  normalizeWhitespace: false,
};

const TEXT_TYPES = new Set(["text/plain", "text/html"]);
const KNOWN_TYPES = ["text/plain", "text/html", "image/png", "image/svg+xml"];

type InlineRep = { type: string; text: string };
type UrlRep = { type: string; url: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: ProtocolError): Result<T> => ({ ok: false, error });
const resolved = <T>(result: Result<T>): Promise<Result<T>> => Promise.resolve(result);

function isInline(rep: Representation): rep is InlineRep {
  return typeof (rep as InlineRep).text === "string";
}

function isUrl(rep: Representation): rep is UrlRep {
  return typeof (rep as UrlRep).url === "string";
}

function clipboard(): Clipboard | undefined {
  return globalThis.navigator?.clipboard;
}

function secureContext(): boolean {
  return globalThis.isSecureContext !== false;
}

function hasClipboardItem(): boolean {
  return typeof globalThis.ClipboardItem === "function";
}

function unavailable(): ProtocolError {
  return secureContext()
    ? protocolError("NotSupported", "navigator.clipboard is not available")
    : protocolError("InsecureContext", "navigator.clipboard requires a secure (HTTPS) context");
}

export function normalizeText(text: string): string {
  return text
    .replace(/[   -   　]/g, " ")
    .replace(/[​-‍⁠﻿᠎]/g, "");
}

function settle(promise: Promise<unknown>, type?: string): Promise<Result<null>> {
  return promise.then(
    () => ok(null),
    (error: unknown) => fail(toProtocolError(error, type)),
  );
}

function fallbackCopy(text: string, html: string | undefined, options: Options): Result<null> {
  if (!options.legacyFallback) return fail(unavailable());
  return legacyCopy(text, html)
    ? ok(null)
    : fail(
        secureContext()
          ? protocolError("NotAllowed", 'document.execCommand("copy") was refused')
          : protocolError("InsecureContext", "navigator.clipboard requires a secure (HTTPS) context"),
      );
}

// WRITE

export function writeText(text: string, options: Options = defaultOptions): Promise<Result<null>> {
  const value = options.normalizeWhitespace ? normalizeText(text) : text;
  const clip = clipboard();
  if (clip && typeof clip.writeText === "function") {
    try {
      return settle(clip.writeText(value));
    } catch (error) {
      return resolved(fail(toProtocolError(error)));
    }
  }
  return resolved(fallbackCopy(value, undefined, options));
}

export function writeContent(content: Content, options: Options = defaultOptions): Promise<Result<null>> {
  const reps = Array.isArray(content?.representations) ? content.representations : [];
  if (reps.length === 0 || !reps.every((rep) => typeof rep?.type === "string" && (isInline(rep) || isUrl(rep)))) {
    return resolved(fail(protocolError("DataError", "the clipboard content is empty or malformed")));
  }

  const normalized = reps.map((rep) =>
    options.normalizeWhitespace && isInline(rep) && rep.type === "text/plain"
      ? { type: rep.type, text: normalizeText(rep.text) }
      : rep,
  );
  const plain = normalized.find((rep): rep is InlineRep => rep.type === "text/plain" && isInline(rep));
  const html = normalized.find((rep): rep is InlineRep => rep.type === "text/html" && isInline(rep));
  const onlyText = normalized.every((rep) => isInline(rep) && TEXT_TYPES.has(rep.type));

  if (plain && normalized.length === 1) return writeText(plain.text, { ...options, normalizeWhitespace: false });

  const clip = clipboard();
  if (!clip || typeof clip.write !== "function" || !hasClipboardItem()) {
    if (onlyText) return resolved(fallbackCopy(plain?.text ?? htmlToText(html?.text ?? ""), html?.text, options));
    const first = normalized.find((rep) => !TEXT_TYPES.has(rep.type) || !isInline(rep));
    return resolved(
      fail(
        clip
          ? protocolError("TypeNotSupported", "ClipboardItem is not available", "TypeNotSupported", first?.type)
          : unavailable(),
      ),
    );
  }

  const supports = (globalThis.ClipboardItem as { supports?: (type: string) => boolean }).supports;
  if (typeof supports === "function") {
    const unsupported = normalized.find((rep) => !supports.call(globalThis.ClipboardItem, rep.type));
    if (unsupported) {
      return resolved(
        fail(
          protocolError(
            "TypeNotSupported",
            `this browser can't write ${unsupported.type}`,
            "TypeNotSupported",
            unsupported.type,
          ),
        ),
      );
    }
  }

  // Remote data becomes a Promise<Blob> so clipboard.write can still be called
  // synchronously (Safari's rule). Errors are kept so they can be reported as
  // DataError instead of the browser's vague rejection.
  let dataError: unknown;
  const data: Record<string, Blob | Promise<Blob>> = {};
  for (const rep of normalized) {
    data[rep.type] = isInline(rep)
      ? new Blob([rep.text], { type: rep.type })
      : fetchImageAsPng((rep as UrlRep).url).catch((error: unknown) => {
          dataError = error;
          throw error;
        });
  }

  try {
    return clip.write([new ClipboardItem(data)]).then(
      () => ok(null),
      (error: unknown) =>
        fail(
          dataError !== undefined
            ? protocolError("DataError", describe(dataError))
            : toProtocolError(error, normalized.find((rep) => !TEXT_TYPES.has(rep.type))?.type),
        ),
    );
  } catch (error) {
    return resolved(fail(toProtocolError(error)));
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function htmlToText(html: string): string {
  const doc = globalThis.document;
  if (!doc) return html;
  const div = doc.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

/** Downloads an image and converts it to PNG, the one image type every browser can write. */
export async function fetchImageAsPng(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`loading ${shorten(url)} failed with HTTP ${response.status}`);
  const blob = await response.blob();
  if (blob.type === "image/png") return blob;
  if (!blob.type.startsWith("image/")) throw new Error(`${shorten(url)} is not an image (${blob.type || "unknown type"})`);
  return convertToPng(blob);
}

function shorten(url: string): string {
  return url.length > 80 ? `${url.slice(0, 77)}...` : url;
}

function convertToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("canvas 2D context is not available");
        context.drawImage(image, 0, 0);
        canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("PNG conversion failed"))), "image/png");
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("the image could not be decoded"));
    };
    image.src = objectUrl;
  });
}
