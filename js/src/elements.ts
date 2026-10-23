// <elm-clipboard-copy> and <elm-clipboard-paste>.
// The copy element follows @github/clipboard-copy-element: button role and
// tabindex by default, Enter/Space copy, aria-disabled="true" disables it,
// `for` is resolved within the element's own root (works in shadow DOM).
// Events are namespaced ("elm-clipboard:*") so they never mix with GitHub's
// "clipboard-copy" event on pages that use both.

import { defaultOptions, writeContent, writeText, type Options } from "./clipboard";
import type { Content, Item, ProtocolError, Result } from "./protocol";

export const COPY_TAG = "elm-clipboard-copy";
export const PASTE_TAG = "elm-clipboard-paste";

export const COPY_EVENT = "elm-clipboard:copy";
export const ERROR_EVENT = "elm-clipboard:error";
export const PASTE_EVENT = "elm-clipboard:paste";

let elementOptions: Options = defaultOptions;

// Elm may set a property before the element is defined (when defineElements
// runs after Elm.init). The value then sits on the instance and would hide the
// class's setter, so move it over (the "lazy property" pattern).
function upgradeProperty(element: HTMLElement, property: string): void {
  if (Object.prototype.hasOwnProperty.call(element, property)) {
    const value = (element as unknown as Record<string, unknown>)[property];
    delete (element as unknown as Record<string, unknown>)[property];
    (element as unknown as Record<string, unknown>)[property] = value;
  }
}

const BaseElement: typeof HTMLElement =
  typeof HTMLElement === "undefined" ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

export class ElmClipboardCopyElement extends BaseElement {
  #content: Content | null = null;

  constructor() {
    super();
    upgradeProperty(this, "content");
    this.addEventListener("click", () => this.copy());
    this.addEventListener("keydown", (event) => {
      if (event.target !== this) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.copy();
      }
    });
  }

  connectedCallback(): void {
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    if (!this.hasAttribute("role")) this.setAttribute("role", "button");
  }

  /** Protocol content, set by Clipboard.Element.copyButton. Takes precedence over `value` and `for`. */
  get content(): Content | null {
    return this.#content;
  }

  set content(value: Content | null) {
    this.#content = value ?? null;
  }

  /** Plain text to copy, mirrored to the `value` attribute. */
  get value(): string {
    return this.getAttribute("value") ?? "";
  }

  set value(text: string) {
    this.setAttribute("value", text);
  }

  /** Copies now. Must be called while handling a user action. */
  copy(): Promise<Result<null>> | undefined {
    if (this.getAttribute("aria-disabled") === "true") return undefined;

    let pending: Promise<Result<null>> | undefined;
    if (this.#content) {
      pending = writeContent(this.#content, elementOptions);
    } else if (this.hasAttribute("value")) {
      pending = writeText(this.value, elementOptions);
    } else {
      const id = this.getAttribute("for");
      const target = id ? findById(this, id) : null;
      if (target) pending = writeText(textOf(target), elementOptions);
    }
    if (!pending) return undefined;

    return pending.then((result) => {
      if (result.ok) {
        this.dispatchEvent(new CustomEvent(COPY_EVENT, { bubbles: true, composed: true, detail: {} }));
      } else {
        this.dispatchEvent(
          new CustomEvent<ProtocolError>(ERROR_EVENT, { bubbles: true, composed: true, detail: result.error }),
        );
      }
      return result;
    });
  }
}

// Duck-typed rather than instanceof, so elements from another realm (an
// iframe) and DOM implementations used in tests behave the same.
function findById(from: Element, id: string): Element | null {
  const root = from.getRootNode() as Partial<Pick<Document, "getElementById">>;
  return typeof root.getElementById === "function" ? root.getElementById(id) : null;
}

function textOf(target: Element): string {
  const tag = target.localName;
  if (tag === "input" || tag === "textarea") return (target as HTMLInputElement).value;
  if (tag === "a" && target.hasAttribute("href")) return (target as HTMLAnchorElement).href;
  return target.textContent ?? "";
}

export class ElmClipboardPasteElement extends BaseElement {
  #preventPaste = false;

  constructor() {
    super();
    upgradeProperty(this, "preventPaste");
    this.addEventListener("paste", (event) => this.#onPaste(event as ClipboardEvent));
  }

  /** When true, the browser's own paste is cancelled. Also settable with the `prevent-default` attribute. */
  get preventPaste(): boolean {
    return this.#preventPaste || this.hasAttribute("prevent-default");
  }

  set preventPaste(value: boolean) {
    this.#preventPaste = Boolean(value);
  }

  #onPaste(event: ClipboardEvent): void {
    const data = event.clipboardData;
    if (!data) return;
    if (this.preventPaste) event.preventDefault();
    const types = Array.from(data.types);
    const detail: Item = {
      types,
      text: types.includes("text/plain") ? data.getData("text/plain") : null,
      html: types.includes("text/html") ? data.getData("text/html") : null,
      files: Array.from(data.files),
    };
    // Not bubbling: Elm listens on this element, and nested zones must not see it twice.
    this.dispatchEvent(new CustomEvent<Item>(PASTE_EVENT, { bubbles: false, detail }));
  }
}

/**
 * Defines both custom elements. Safe to call more than once (hot reload,
 * several Elm apps on a page); the first call's options win.
 */
export function defineElements(options: Partial<Options> = {}): void {
  const registry = globalThis.customElements;
  if (!registry) return;
  if (!registry.get(COPY_TAG)) {
    elementOptions = { ...defaultOptions, ...options };
    registry.define(COPY_TAG, ElmClipboardCopyElement);
  }
  if (!registry.get(PASTE_TAG)) registry.define(PASTE_TAG, ElmClipboardPasteElement);
}
