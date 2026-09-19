// Runs the shared fixtures (../../fixtures/protocol.json) through the JS
// handler. The Elm tests check the same file, so both sides agree on v1.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRequest, register } from "../src/index";
import { FakeClipboardItem, domError, installClipboard, installPermissions } from "./helpers";

const fixtures = JSON.parse(readFileSync(resolve(__dirname, "../../fixtures/protocol.json"), "utf8")) as {
  requests: Record<string, unknown>;
  replies: Record<string, unknown>;
};
const request = (name: string) => structuredClone(fixtures.requests[name]);
const reply = (name: string) => fixtures.replies[name];

beforeEach(() => {
  installPermissions(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fixture replies", () => {
  it("wrote", async () => {
    installClipboard({});
    expect(await handleRequest(request("writeText"))).toEqual(reply("wrote"));
  });

  it("notAllowed", async () => {
    installClipboard({ writeText: vi.fn(() => Promise.reject(domError("NotAllowedError", "Write permission denied."))) });
    expect(await handleRequest(request("writeText"))).toEqual(reply("notAllowed"));
  });

  it("notFocused", async () => {
    installClipboard({ writeText: vi.fn(() => Promise.reject(domError("NotAllowedError", "Document is not focused."))) });
    expect(await handleRequest(request("writeText"))).toEqual(reply("notFocused"));
  });

  it("typeNotSupported", async () => {
    installClipboard({});
    FakeClipboardItem.supports = (type) => !type.startsWith("web ");
    expect(await handleRequest(request("writeCustom"))).toEqual(reply("typeNotSupported"));
  });

  it("dataError", async () => {
    installClipboard({});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("", { status: 404 }))));
    expect(await handleRequest(request("writeImage"))).toEqual(reply("dataError"));
  });

  it("unknownError", async () => {
    installClipboard({ writeText: vi.fn(() => Promise.reject(domError("AbortError", "The operation was aborted."))) });
    expect(await handleRequest(request("writeText"))).toEqual(reply("unknownError"));
  });

  it("gotText", async () => {
    installClipboard({ readText: vi.fn(() => Promise.resolve("hello")) });
    expect(await handleRequest(request("readText"))).toEqual(reply("gotText"));
  });

  it("gotItems", async () => {
    installClipboard({
      read: vi.fn(() =>
        Promise.resolve([
          new FakeClipboardItem({
            "text/plain": new Blob(["Hi"], { type: "text/plain" }),
            "text/html": new Blob(["<b>Hi</b>"], { type: "text/html" }),
          }),
        ]),
      ),
    });
    expect(await handleRequest(request("read"))).toEqual(reply("gotItems"));
  });

  it("gotPermission", async () => {
    const query = vi.fn(() => Promise.resolve({ state: "granted" }));
    installPermissions(query);
    expect(await handleRequest(request("permissionRead"))).toEqual(reply("gotPermission"));
    expect(query).toHaveBeenCalledWith({ name: "clipboard-read" });
  });

  it("gotCapabilities", async () => {
    installClipboard({});
    installPermissions(() => Promise.resolve({ state: "prompt" }));
    FakeClipboardItem.supports = (type) => type !== "image/svg+xml";
    expect(await handleRequest(request("capabilities"))).toEqual(reply("gotCapabilities"));
  });

  it("writeHtml succeeds", async () => {
    installClipboard({});
    expect(await handleRequest(request("writeHtml"))).toEqual({ v: 1, id: "copy-2", op: "write", ok: null });
  });
});

describe("malformed requests", () => {
  it("answer a wrong version with a ProtocolError instead of throwing", async () => {
    const result = await handleRequest({ v: 2, id: "x", op: "writeText", payload: {} });
    expect(result).toMatchObject({ v: 1, id: "x", error: { code: "Unknown", name: "ProtocolError" } });
  });

  it("answer garbage too", async () => {
    await expect(handleRequest(undefined)).resolves.toMatchObject({ error: { name: "ProtocolError" } });
  });
});

describe("register", () => {
  it("answers each request on the incoming port and can be undone", async () => {
    installClipboard({});
    let listener: ((value: unknown) => void) | undefined;
    const outgoing = {
      subscribe: vi.fn((callback: (value: unknown) => void) => (listener = callback)),
      unsubscribe: vi.fn(),
    };
    const sent: unknown[] = [];
    const unregister = register(outgoing, { send: (value) => sent.push(value) }, { defineElements: false });

    listener?.(request("writeText"));
    await vi.waitFor(() => expect(sent).toEqual([reply("wrote")]));

    unregister();
    expect(outgoing.unsubscribe).toHaveBeenCalledWith(listener);
  });
});
