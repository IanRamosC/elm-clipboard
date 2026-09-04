// Wire protocol version 1, shared with the Elm package
// (src/Clipboard/Internal/Protocol.elm and src/Clipboard/Port.elm).
// Change both together and bump PROTOCOL_VERSION on incompatible changes.

export const PROTOCOL_VERSION = 1;

export type Representation =
  | { type: string; text: string }
  | { type: string; url: string };

export interface Content {
  representations: Representation[];
}

export type Request =
  | { v: number; id: string; op: "write"; payload: { content: Content } }
  | { v: number; id: string; op: "writeText"; payload: { text: string } }
  | { v: number; id: string; op: "readText"; payload: Record<string, never> }
  | { v: number; id: string; op: "read"; payload: Record<string, never> }
  | {
      v: number;
      id: string;
      op: "permission";
      payload: { name: "clipboard-read" | "clipboard-write" };
    }
  | { v: number; id: string; op: "capabilities"; payload: Record<string, never> };

export type Op = Request["op"];

export type ErrorCode =
  | "NotSupported"
  | "InsecureContext"
  | "NotAllowed"
  | "DocumentNotFocused"
  | "TypeNotSupported"
  | "DataError"
  | "Unknown";

export interface ProtocolError {
  code: ErrorCode;
  /** The browser's original error name, e.g. "NotAllowedError". */
  name: string;
  message: string;
  /** Set when code is "TypeNotSupported". */
  type?: string;
}

export interface Item {
  types: string[];
  text: string | null;
  html: string | null;
  files: File[];
}

export type PermissionState = "granted" | "denied" | "prompt" | "unavailable";

export interface Capabilities {
  secureContext: boolean;
  asyncClipboard: boolean;
  clipboardItem: boolean;
  permissionsQuery: boolean;
  supportedTypes: string[];
}

export type Reply =
  | { v: number; id: string; op: Op; ok: unknown }
  | { v: number; id: string; op: Op; error: ProtocolError };

export type Result<T> = { ok: true; value: T } | { ok: false; error: ProtocolError };
