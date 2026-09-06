// Copying with document.execCommand("copy"), for pages where
// navigator.clipboard doesn't exist (plain http://, old browsers).
// Practices from copy-to-clipboard and @github/clipboard-copy-element:
// the user's selection and focus are restored afterwards, and the data is
// set in a capturing "copy" listener so HTML can be written too.

export function legacyCopy(text: string, html?: string): boolean {
  const doc = globalThis.document;
  if (!doc?.body || typeof doc.execCommand !== "function") return false;

  const selection = doc.getSelection();
  const savedRanges: Range[] = [];
  if (selection) {
    for (let i = 0; i < selection.rangeCount; i++) savedRanges.push(selection.getRangeAt(i));
  }
  const previouslyFocused = doc.activeElement as HTMLElement | null;

  const node = doc.createElement("pre");
  node.textContent = text;
  node.setAttribute("aria-hidden", "true");
  Object.assign(node.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "1px",
    height: "1px",
    opacity: "0",
    overflow: "hidden",
    whiteSpace: "pre",
    userSelect: "text",
    webkitUserSelect: "text",
  });

  const onCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    event.clipboardData.setData("text/plain", text);
    if (html !== undefined) event.clipboardData.setData("text/html", html);
    event.preventDefault();
  };

  doc.addEventListener("copy", onCopy, true);
  doc.body.appendChild(node);
  let copied = false;
  try {
    if (selection) {
      selection.removeAllRanges();
      const range = doc.createRange();
      range.selectNodeContents(node);
      selection.addRange(range);
    }
    copied = doc.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    doc.removeEventListener("copy", onCopy, true);
    node.remove();
    if (selection) {
      selection.removeAllRanges();
      for (const range of savedRanges) selection.addRange(range);
    }
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus({ preventScroll: true });
    }
  }
  return copied;
}
