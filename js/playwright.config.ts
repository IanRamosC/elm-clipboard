import { release } from "node:os";
import { defineConfig, devices } from "@playwright/test";

// Playwright's WebKit build for macOS 14 and older is out of date and fails to
// open pages ("Unknown setting: PushAPIEnabled"). Run WebKit on Linux CI or
// macOS 15+.
const webkitWorks = process.platform !== "darwin" || Number(release().split(".")[0]) >= 24;

export default defineConfig({
  testDir: "e2e",
  // The tests share one system clipboard, so they run one at a time.
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:4174" },
  webServer: {
    command: "node e2e/serve.mjs",
    url: "http://localhost:4174",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], permissions: ["clipboard-read", "clipboard-write"] },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        // Lets tests read the clipboard without Firefox's "Paste" button.
        launchOptions: { firefoxUserPrefs: { "dom.events.testing.asyncClipboard": true } },
      },
    },
    ...(webkitWorks ? [{ name: "webkit", use: { ...devices["Desktop Safari"] } }] : []),
  ],
});
