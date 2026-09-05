import type { ErrorCode, ProtocolError } from "./protocol";

export function protocolError(
  code: ErrorCode,
  message = "",
  name: string = code,
  type?: string,
): ProtocolError {
  return type === undefined ? { code, name, message } : { code, name, message, type };
}

/** Maps whatever a clipboard call rejected with to a protocol error. */
export function toProtocolError(error: unknown, type?: string): ProtocolError {
  const name = errorName(error);
  const message = errorMessage(error);
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      // Chrome: "Document is not focused." / Firefox: "Clipboard write is not allowed."
      return /focus/i.test(message)
        ? protocolError("DocumentNotFocused", message, name)
        : protocolError("NotAllowed", message, name);
    case "NotSupportedError":
      return type === undefined
        ? protocolError("NotSupported", message, name)
        : protocolError("TypeNotSupported", message, name, type);
    case "DataError":
    case "EncodingError":
      return protocolError("DataError", message, name);
    default:
      return protocolError("Unknown", message, name);
  }
}

function errorName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error && typeof error.name === "string") {
    return error.name;
  }
  return "Error";
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}
