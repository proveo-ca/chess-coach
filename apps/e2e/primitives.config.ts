// SPEC: _spec/_plans/chess-ui-primitives.puml
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/primitives",
  timeout: 30_000,
  retries: 0,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:6008",
    headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: [
    {
      command: "pnpm storybook",
      cwd: "../../packages/ui/web",
      url: "http://127.0.0.1:6008",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm dev:web-no-llm:vite",
      cwd: "../ui",
      url: "http://127.0.0.1:5173/chess/",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "pnpm dev -- --host 127.0.0.1",
      cwd: "../starchess",
      url: "http://127.0.0.1:5175/starchess/",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
