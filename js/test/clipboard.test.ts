import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  capabilities,
  normalizeText,
  permission,
  read,
  readText,
  writeContent,
  writeText,
} from "../src/clipboard";
import { FakeClipboardItem, domError, installClipboard, installPermissions } from "./helpers";

const html = {
  representations: [
    { type: "text/plain", text: "Hi" },
    { type: "text/html", text: "<b>Hi</b>" },
  ],
};

beforeEach(() => {
  installPermissions(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("writeText", () => {
  it("calls the clipboard synchronously, before any await (user activation)", () => {
    const clip = installClipboard({});
    void writeText("hello");
    expect(clip.writeText).toHaveBeenCalledWith("hello");
  });

  it("maps NotAllowedError to NotAllowed", async () => {
    installClipboard({ writeText: vi.fn(() => Promise.reject(domError("NotAllowedError", "Write permission denied."))) });
    expect(await writeText("x")).toEqual({
      ok: false,
      error: { code: "NotAllowed", name: "NotAllowedError", message: "Write permission denied." },
    });
  });

  it("recognizes Chrome's unfocused-document error", async () => {
    installClipboard({ writeText: vi.fn(() => Promise.reject(domError("NotAllowedError", "Document is not focused."))) });
    const result = await writeText("x");
    expect(result.ok === false && result.error.code).toBe("DocumentNotFocused");
  });

  it("falls back to execCommand when navigator.clipboard is missing", async () => {
    installClipboard(null, { secure: false });
    const exec = vi.fn(() => true);
    document.execCommand = exec;
    expect(await writeText("plain http")).toEqual({ ok: true, value: null });
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("reports InsecureContext when the fallback fails on http", async () => {
    installClipboard(null, { secure: false });
    document.execCommand = vi.fn(() => false);
    const result = await writeText("x");
    expect(result.ok === false && result.error.code).toBe("InsecureContext");
  });

  it("reports InsecureContext when the fallback is turned off", async () => {
    installClipboard(null, { secure: false });
    const result = await writeText("x", { legacyFallback: false, normalizeWhitespace: false });
    expect(result.ok === false && result.error.code).toBe("InsecureContext");
  });

  it("normalizes whitespace only when asked", () => {
    const clip = installClipboard({});
    void writeText("a b​c", { legacyFallback: true, normalizeWhitespace: true });
    expect(clip.writeText).toHaveBeenCalledWith("a bc");
    expect(normalizeText(" x﻿")).toBe(" x");
  });
});

describe("writeContent", () => {
  it("writes text and html in one ClipboardItem, synchronously", async () => {
    const clip = installClipboard({});
    const pending = writeContent(html);
    expect(clip.write).toHaveBeenCalledTimes(1);
    const [items] = clip.write.mock.calls[0] as [FakeClipboardItem[]];
    expect(items[0]?.types).toEqual(["text/plain", "text/html"]);
    expect(await (items[0]?.data["text/html"] as Blob).text()).toBe("<b>Hi</b>");
    expect(await pending).toEqual({ ok: true, value: null });
  });

  it("uses writeText for plain text alone", () => {
    const clip = installClipboard({});
    void writeContent({ representations: [{ type: "text/plain", text: "only" }] });
    expect(clip.writeText).toHaveBeenCalledWith("only");
    expect(clip.write).not.toHaveBeenCalled();
  });

  it("rejects types ClipboardItem.supports() refuses", async () => {
    const clip = installClipboard({});
    FakeClipboardItem.supports = (type) => !type.startsWith("web ");
    const result = await writeContent({
      representations: [
        { type: "text/plain", text: "#42" },
        { type: "web application/vnd.myapp+json", text: "{}" },
      ],
    });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "TypeNotSupported",
        name: "TypeNotSupported",
        message: "this browser can't write web application/vnd.myapp+json",
        type: "web application/vnd.myapp+json",
      },
    });
    expect(clip.write).not.toHaveBeenCalled();
  });

  it("passes images as Promise<Blob> and reports fetch failures as DataError", async () => {
    const clip = installClipboard({});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("nope", { status: 404 }))));
    const pending = writeContent({ representations: [{ type: "image/png", url: "https://example.com/chart.png" }] });
    const [items] = clip.write.mock.calls[0] as [FakeClipboardItem[]];
    expect(items[0]?.data["image/png"]).toBeInstanceOf(Promise);
    expect(await pending).toEqual({
      ok: false,
      error: {
        code: "DataError",
        name: "DataError",
        message: "loading https://example.com/chart.png failed with HTTP 404",
      },
    });
  });

  it("keeps PNG images as they are", async () => {
    const clip = installClipboard({});
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(png))));
    expect(await writeContent({ representations: [{ type: "image/png", url: "data:image/png;base64,iVBO" }] })).toEqual({
      ok: true,
      value: null,
    });
    const [items] = clip.write.mock.calls[0] as [FakeClipboardItem[]];
    expect((await items[0]?.data["image/png"])?.type).toBe("image/png");
  });

  it("falls back to execCommand for html when ClipboardItem is missing", async () => {
    installClipboard({}, { clipboardItem: false });
    document.execCommand = vi.fn(() => true);
    expect(await writeContent(html)).toEqual({ ok: true, value: null });
  });

  it("reports TypeNotSupported for images when ClipboardItem is missing", async () => {
    installClipboard({}, { clipboardItem: false });
    const result = await writeContent({ representations: [{ type: "image/png", url: "x.png" }] });
    expect(result.ok === false && result.error).toMatchObject({ code: "TypeNotSupported", type: "image/png" });
  });

  it("rejects empty or malformed content without throwing", async () => {
    installClipboard({});
    for (const bad of [{ representations: [] }, { representations: [{ type: "text/plain" }] }, null]) {
      const result = await writeContent(bad as never);
      expect(result.ok === false && result.error.code).toBe("DataError");
    }
  });

  it("turns a synchronous throw into an error result", async () => {
    installClipboard({
      write: vi.fn(() => {
        throw domError("NotAllowedError", "no gesture");
      }),
    });
    const result = await writeContent(html);
    expect(result.ok === false && result.error.code).toBe("NotAllowed");
  });
});

describe("reading", () => {
  it("readText returns the text", async () => {
    installClipboard({ readText: vi.fn(() => Promise.resolve("hello")) });
    expect(await readText()).toEqual({ ok: true, value: "hello" });
  });

  it("read converts items: text and html as strings, the rest as Files", async () => {
    const image = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    installClipboard({
      read: vi.fn(() =>
        Promise.resolve([
          new FakeClipboardItem({
            "text/plain": new Blob(["Hi"], { type: "text/plain" }),
            "text/html": new Blob(["<b>Hi</b>"], { type: "text/html" }),
            "image/png": image,
          }),
        ]),
      ),
    });
    const result = await read();
    if (!result.ok) throw new Error("expected ok");
    const [item] = result.value;
    expect(item?.types).toEqual(["text/plain", "text/html", "image/png"]);
    expect(item?.text).toBe("Hi");
    expect(item?.html).toBe("<b>Hi</b>");
    expect(item?.files[0]).toBeInstanceOf(File);
    expect(item?.files[0]?.name).toBe("clipboard.png");
    expect(item?.files[0]?.type).toBe("image/png");
  });

  it("read falls back to readText where clipboard.read is missing", async () => {
    installClipboard({ read: undefined as never, readText: vi.fn(() => Promise.resolve("old browser")) });
    expect(await read()).toEqual({
      ok: true,
      value: [{ types: ["text/plain"], text: "old browser", html: null, files: [] }],
    });
  });

  it("read of an empty clipboard through the fallback is an empty list", async () => {
    installClipboard({ read: undefined as never });
    expect(await read()).toEqual({ ok: true, value: [] });
  });

  it("reading without the API reports InsecureContext on http", async () => {
    installClipboard(null, { secure: false });
    const result = await readText();
    expect(result.ok === false && result.error.code).toBe("InsecureContext");
  });
});

describe("permissions and capabilities", () => {
  it("returns the permission state", async () => {
    installPermissions(() => Promise.resolve({ state: "granted" }));
    expect(await permission("clipboard-read")).toEqual({ ok: true, value: "granted" });
  });

  it("is unavailable where clipboard permission names throw (Firefox, Safari)", async () => {
    installPermissions(() => Promise.reject(new TypeError("'clipboard-read' is not a valid value")));
    expect(await permission("clipboard-read")).toEqual({ ok: true, value: "unavailable" });
  });

  it("lists types with ClipboardItem.supports()", async () => {
    installClipboard({});
    installPermissions(() => Promise.resolve({ state: "granted" }));
    FakeClipboardItem.supports = (type) => type !== "image/svg+xml";
    expect(await capabilities()).toEqual({
      ok: true,
      value: {
        secureContext: true,
        asyncClipboard: true,
        clipboardItem: true,
        permissionsQuery: true,
        supportedTypes: ["text/plain", "text/html", "image/png"],
      },
    });
  });

  it("reports only the fallback's types on http", async () => {
    installClipboard(null, { secure: false });
    document.execCommand = vi.fn(() => true);
    const result = await capabilities();
    expect(result.ok && result.value).toMatchObject({
      secureContext: false,
      asyncClipboard: false,
      supportedTypes: ["text/plain", "text/html"],
    });
  });
});
