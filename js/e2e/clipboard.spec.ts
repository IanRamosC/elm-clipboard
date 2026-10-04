import { expect, test, type Page } from "@playwright/test";

// Checks what is on the system clipboard by pasting into the example's text
// area with the keyboard. That works in every engine without read permission.
async function pastedText(page: Page): Promise<string> {
  const target = page.locator("#paste-target");
  await target.fill("");
  await target.focus();
  await page.keyboard.press("ControlOrMeta+V");
  return target.inputValue();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#capabilities")).toBeVisible();
});

test("copy button copies the target's text and shows Copied!", async ({ page }) => {
  await page.locator("#copy-snippet").click();
  await expect(page.locator("#copy-snippet")).toHaveText("Copied!");
  expect(await pastedText(page)).toBe("elm install ianramosc/elm-clipboard");
  // Clipboard.Feedback resets after 1.5 s.
  await expect(page.locator("#copy-snippet")).toHaveText("Copy", { timeout: 4000 });
});

test("copy button with content copies the value", async ({ page }) => {
  await page.locator("#copy-link").click();
  await expect(page.locator("#copy-link")).toHaveText("Copied!");
  expect(await pastedText(page)).toBe("https://example.com/invite/42");
});

test("keyboard: Tab to the button and press Enter", async ({ page }) => {
  await page.locator("#copy-snippet").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#copy-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#copy-link")).toHaveText("Copied!");
});

test("aria-disabled buttons don't copy", async ({ page }) => {
  await page.locator("#copy-link").click();
  // force: Playwright otherwise waits for aria-disabled elements to become enabled.
  await page.locator("#copy-disabled").click({ force: true });
  expect(await pastedText(page)).toBe("https://example.com/invite/42");
});

test("port write of rich text replies to Elm and pastes as plain text", async ({ page }) => {
  await page.locator("#copy-html").click();
  await expect(page.locator("#port-log")).toContainText("rich: copied");
  expect(await pastedText(page)).toBe("Order #42 shipped");
});

test("paste zone reports pasted text to Elm", async ({ page }) => {
  await page.locator("#copy-link").click();
  await expect(page.locator("#copy-link")).toHaveText("Copied!");
  await pastedText(page);
  await expect(page.locator("#pasted")).toHaveText("text=https://example.com/invite/42");
});

test("capabilities reach Elm", async ({ page }) => {
  await expect(page.locator("#capabilities")).toContainText("Secure context: yes");
  await expect(page.locator("#capabilities")).toContainText("text/plain");
});

test.describe("reading (Chromium grants permission; Firefox via test pref)", () => {
  test.skip(({ browserName }) => browserName === "webkit", "WebKit has no way to pre-approve clipboard reads");

  test("readText and read return what was copied", async ({ page }) => {
    await page.locator("#copy-html").click();
    await expect(page.locator("#port-log")).toContainText("rich: copied");

    await page.locator("#read-text").click();
    await expect(page.locator("#read-result")).toHaveText("text: Order #42 shipped");

    await page.locator("#read").click();
    await expect(page.locator("#read-result")).toContainText("text=Order #42 shipped");
    await expect(page.locator("#read-result")).toContainText("<b>Order #42</b> shipped");
  });

  test("an image copied as PNG reads back as a file", async ({ page }) => {
    // 1x1 PNG
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const result = await page.evaluate(async (url) => {
      const { writeContent, read } = (window as unknown as { ElmClipboard: typeof import("../src/index") }).ElmClipboard;
      const written = await writeContent({ representations: [{ type: "image/png", url }] });
      const back = await read();
      return { written, types: back.ok ? back.value.map((item) => item.types) : back.error };
    }, png);
    expect(result.written).toEqual({ ok: true, value: null });
    expect(JSON.stringify(result.types)).toContain("image/png");
  });
});
