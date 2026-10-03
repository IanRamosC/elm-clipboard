import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    // e2e/*.spec.ts are Playwright tests; vitest would fail to load them.
    include: ["test/**/*.test.ts"],
  },
});
