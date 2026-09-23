import { defineConfig } from "@playwright/test";
import { TARGET, targetConfig } from "./target";

// The SAME specs in ./tests run against multiple "targets" — wirings of the
// identical apps/ui. `E2E_TARGET` selects one (default web-no-llm); each target
// supplies its own baseURL, web servers, browser projects and ignore list. See
// ./target.ts for the matrix and ./global-setup.ts for the desktop LLM preflight.
const t = targetConfig();

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: t.baseURL,
    headless: true,
  },
  webServer: t.webServer,
  testIgnore: [...t.testIgnore, "**/primitives/**"],
  projects: t.projects,
  metadata: { target: TARGET },
});
