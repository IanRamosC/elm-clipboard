import { defineConfig, devices } from "@playwright/test";

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
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
