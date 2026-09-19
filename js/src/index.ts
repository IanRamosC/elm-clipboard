// elm-clipboard: the JavaScript side of the `ianramosc/elm-clipboard` Elm package.

import {
  capabilities,
  defaultOptions,
  permission,
  read,
  readText,
  writeContent,
  writeText,
  type Options,
} from "./clipboard";
import { protocolError } from "./errors";
import { defineElements } from "./elements";
import { PROTOCOL_VERSION, type Op, type Reply, type Result } from "./protocol";

export { defineElements, ElmClipboardCopyElement, ElmClipboardPasteElement } from "./elements";
export { capabilities, permission, read, readText, writeContent, writeText, normalizeText } from "./clipboard";
export type { Options } from "./clipboard";
export * from "./protocol";

/** The shape of an Elm outgoing port (`port clipboardOut : Value -> Cmd msg`). */
export interface OutgoingPort {
  subscribe(callback: (value: unknown) => void): void;
  unsubscribe(callback: (value: unknown) => void): void;
}

/** The shape of an Elm incoming port (`port clipboardIn : (Value -> msg) -> Sub msg`). */
export interface IncomingPort {
  send(value: unknown): void;
}

export interface RegisterOptions extends Options {
  /** Also define <elm-clipboard-copy> and <elm-clipboard-paste>. Default true. */
  defineElements: boolean;
}

const OPS: readonly Op[] = ["write", "writeText", "readText", "read", "permission", "capabilities"];

/**
 * Connects the Elm ports. Returns a function that disconnects them.
 *
 *     register(app.ports.clipboardOut, app.ports.clipboardIn);
 */
export function register(
  outgoing: OutgoingPort,
  incoming: IncomingPort,
  options: Partial<RegisterOptions> = {},
): () => void {
  const { defineElements: shouldDefine = true, ...rest } = options;
  const resolved: Options = { ...defaultOptions, ...rest };
  if (shouldDefine) defineElements(resolved);

  // Elm calls this synchronously while it handles the click that caused the
  // command, so the clipboard call below still counts as a user action.
  const listener = (message: unknown) => {
    void handleRequest(message, resolved).then((reply) => incoming.send(reply));
  };
  outgoing.subscribe(listener);
  return () => outgoing.unsubscribe(listener);
}

/**
 * Runs one protocol request. Always resolves with exactly one reply.
 * Exposed for custom wiring (elm-ts-interop, elm-concurrent-task).
 */
export function handleRequest(message: unknown, options: Options = defaultOptions): Promise<Reply> {
  const request = (message ?? {}) as { v?: unknown; id?: unknown; op?: unknown; payload?: unknown };
  const id = typeof request.id === "string" ? request.id : "";
  const op = (OPS as readonly unknown[]).includes(request.op) ? (request.op as Op) : null;
  const payload = (request.payload ?? {}) as Record<string, unknown>;

  const reply = (result: Result<unknown>): Reply =>
    result.ok
      ? { v: PROTOCOL_VERSION, id, op: op ?? "write", ok: result.value }
      : { v: PROTOCOL_VERSION, id, op: op ?? "write", error: result.error };

  if (request.v !== PROTOCOL_VERSION || op === null) {
    return Promise.resolve(
      reply({
        ok: false,
        error: protocolError(
          "Unknown",
          `elm-clipboard expected protocol version ${PROTOCOL_VERSION}; got version ${String(request.v)}, operation ${String(request.op)}. Update the npm and Elm packages together.`,
          "ProtocolError",
        ),
      }),
    );
  }

  let pending: Promise<Result<unknown>>;
  switch (op) {
    case "write":
      pending = writeContent(payload.content as never, options);
      break;
    case "writeText":
      pending = writeText(String(payload.text ?? ""), options);
      break;
    case "readText":
      pending = readText();
      break;
    case "read":
      pending = read();
      break;
    case "permission":
      pending = permission(payload.name === "clipboard-read" ? "clipboard-read" : "clipboard-write");
      break;
    case "capabilities":
      pending = capabilities(options);
      break;
  }
  return pending.then(reply);
}
