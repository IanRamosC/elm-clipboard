import { vi } from "vitest";

/** A ClipboardItem stand-in that keeps the data it was given. */
export class FakeClipboardItem {
  static supports?: (type: string) => boolean;
  constructor(public readonly data: Record<string, Blob | Promise<Blob>>) {}
  get types(): string[] {
    return Object.keys(this.data);
  }
  getType(type: string): Promise<Blob> {
    const value = this.data[type];
    return value === undefined ? Promise.reject(new DOMException("missing", "NotFoundError")) : Promise.resolve(value);
  }
}

export function domError(name: string, message: string): DOMException {
  return new DOMException(message, name);
}

export interface FakeClipboard {
  writeText: ReturnType<typeof vi.fn>;
  readText: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
}

/** Installs navigator.clipboard (or removes it with `null`), ClipboardItem and isSecureContext. */
export function installClipboard(
  clipboard: Partial<FakeClipboard> | null,
  { secure = true, clipboardItem = true }: { secure?: boolean; clipboardItem?: boolean } = {},
): FakeClipboard {
  const full: FakeClipboard = {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve("")),
    // Like browsers, wait for every promised blob before resolving.
    write: vi.fn(async (items: FakeClipboardItem[]) => {
      for (const item of items) await Promise.all(Object.values(item.data));
    }),
    read: vi.fn(() => Promise.resolve([])),
    ...clipboard,
  };
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    get: () => (clipboard === null ? undefined : full),
  });
  Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: secure });
  FakeClipboardItem.supports = undefined;
  vi.stubGlobal("ClipboardItem", clipboardItem ? FakeClipboardItem : undefined);
  return full;
}

export function installPermissions(query: ((descriptor: { name: string }) => Promise<{ state: string }>) | null): void {
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    get: () => (query === null ? undefined : { query }),
  });
}
