import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { COPY_EVENT, ERROR_EVENT, defineElements } from "../src/elements";
import { domError, installClipboard } from "./helpers";

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

});
