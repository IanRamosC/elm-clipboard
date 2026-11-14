import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { COPY_EVENT, ERROR_EVENT, PASTE_EVENT, defineElements } from "../src/elements";
import { domError, installClipboard } from "./helpers";

// Created *before* the elements are defined, like an Elm app that starts
// before defineElements() runs. Its property must survive the upgrade.
const early = document.createElement("elm-clipboard-copy") as HTMLElement & { content: unknown };
early.content = { representations: [{ type: "text/plain", text: "set before define" }] };

beforeAll(() => {
  defineElements();
  defineElements(); // idempotent
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

function nextEvent(target: EventTarget, ...names: string[]): Promise<CustomEvent> {
  return new Promise((resolve) => {
    for (const name of names) target.addEventListener(name, (event) => resolve(event as CustomEvent), { once: true });
  });
}

describe("<elm-clipboard-copy>", () => {
  it("adds button semantics unless already set", () => {
    const button = mount(`<elm-clipboard-copy value="x"></elm-clipboard-copy>`);
    expect(button.getAttribute("role")).toBe("button");
    expect(button.getAttribute("tabindex")).toBe("0");
    const custom = mount(`<elm-clipboard-copy role="link" tabindex="-1"></elm-clipboard-copy>`);
    expect(custom.getAttribute("role")).toBe("link");
    expect(custom.getAttribute("tabindex")).toBe("-1");
  });

  it("copies its value on click, in the same task, and fires elm-clipboard:copy", async () => {
    const clip = installClipboard({});
    const button = mount(`<elm-clipboard-copy value="hello"></elm-clipboard-copy>`);
    const event = nextEvent(button, COPY_EVENT);
    button.click();
    expect(clip.writeText).toHaveBeenCalledWith("hello");
    expect((await event).type).toBe(COPY_EVENT);
  });

  it("copies with Enter and Space", () => {
    const clip = installClipboard({});
    const button = mount(`<elm-clipboard-copy value="k"></elm-clipboard-copy>`);
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    button.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(clip.writeText).toHaveBeenCalledTimes(2);
  });

  it("does nothing when aria-disabled", () => {
    const clip = installClipboard({});
    const button = mount(`<elm-clipboard-copy value="x" aria-disabled="true"></elm-clipboard-copy>`);
    button.click();
    expect(clip.writeText).not.toHaveBeenCalled();
  });

  it("copies from the element named by for= (input value, link href, text)", () => {
    const clip = installClipboard({});
    document.body.innerHTML = `
      <input id="field" value="from input">
      <a id="link" href="https://example.com/x">label</a>
      <pre id="code">from text</pre>
      <elm-clipboard-copy for="field"></elm-clipboard-copy>
      <elm-clipboard-copy for="link"></elm-clipboard-copy>
      <elm-clipboard-copy for="code"></elm-clipboard-copy>`;
    for (const button of document.querySelectorAll<HTMLElement>("elm-clipboard-copy")) button.click();
    expect(clip.writeText.mock.calls.map((call) => call[0])).toEqual([
      "from input",
      "https://example.com/x",
      "from text",
    ]);
  });

  it("prefers the content property and reports errors as elm-clipboard:error", async () => {
    installClipboard({ write: vi.fn(() => Promise.reject(domError("NotAllowedError", "no"))) });
    const button = mount(`<elm-clipboard-copy value="ignored"></elm-clipboard-copy>`) as HTMLElement & {
      content: unknown;
    };
    button.content = {
      representations: [
        { type: "text/plain", text: "a" },
        { type: "text/html", text: "<b>a</b>" },
      ],
    };
    const event = nextEvent(button, ERROR_EVENT, COPY_EVENT);
    button.click();
    const received = await event;
    expect(received.type).toBe(ERROR_EVENT);
    expect(received.detail).toMatchObject({ code: "NotAllowed", name: "NotAllowedError" });
  });

  it("keeps a property set before the element was defined", () => {
    const clip = installClipboard({});
    document.body.appendChild(early);
    early.click();
    expect(clip.writeText).toHaveBeenCalledWith("set before define");
  });
});

describe("<elm-clipboard-paste>", () => {
  function paste(target: Element, data: Record<string, string>, files: File[] = []): Event {
    const transfer = {
      types: [...Object.keys(data), ...(files.length ? ["Files"] : [])],
      files,
      getData: (type: string) => data[type] ?? "",
    };
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    target.dispatchEvent(event);
    return event;
  }

  it("reports text, html and files from a paste inside it", async () => {
    const zone = mount(`<elm-clipboard-paste><textarea></textarea></elm-clipboard-paste>`);
    const file = new File([new Uint8Array([1])], "shot.png", { type: "image/png" });
    const event = nextEvent(zone, PASTE_EVENT);
    const native = paste(zone.querySelector("textarea")!, { "text/plain": "Hi", "text/html": "<b>Hi</b>" }, [file]);
    const { detail } = await event;
    expect(detail).toEqual({
      types: ["text/plain", "text/html", "Files"],
      text: "Hi",
      html: "<b>Hi</b>",
      files: [file],
    });
    expect(native.defaultPrevented).toBe(false);
  });

  it("cancels the browser's paste when preventPaste is set", () => {
    const zone = mount(`<elm-clipboard-paste></elm-clipboard-paste>`) as HTMLElement & { preventPaste: boolean };
    zone.preventPaste = true;
    expect(paste(zone, { "text/plain": "x" }).defaultPrevented).toBe(true);
  });

  it("reports missing formats as null", async () => {
    const zone = mount(`<elm-clipboard-paste></elm-clipboard-paste>`);
    const event = nextEvent(zone, PASTE_EVENT);
    paste(zone, { "text/plain": "only text" });
    expect((await event).detail).toMatchObject({ text: "only text", html: null, files: [] });
  });
});
