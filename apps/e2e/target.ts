// Resolves the e2e "target" — which app/wiring is under test.
//
//   web-no-llm (default): Classical Chess Coach UI + in-browser engine workers
//                         (apps/ui), vite (:5173) + StarChess vite (:5175) for
//                         /starchess proxy + wrangler PWA preview (:8787).
//   desktop:              UI built in desktop mode (HttpCoachService) talking to
//                         the Bun server (apps/server) over HTTP.
//   starchess:            Standalone StarChess app (apps/starchess) at /starchess/,
//                         vite (:5175) + Storybook (:6007) for fog DualNav stories.
//
// `E2E_TARGET` selects the target. Specs may `import { IS_DESKTOP } from "../target"`
// to branch expectations; the Playwright config branches baseURL / webServer /
// projects / testIgnore below.
import type { PlaywrightTestConfig } from "@playwright/test";

export type Target = "web-no-llm" | "desktop" | "starchess";

export const TARGET: Target = (process.env.E2E_TARGET as Target) || "web-no-llm";
export const IS_DESKTOP = TARGET === "desktop";
export const IS_STARCHESS = TARGET === "starchess";

const WEIGHTS_DIR = process.env.MAIA_WEIGHTS_DIR ?? "../ui/public/web-engine";

export const LLM = {
  baseUrl: process.env.LLM_BASE_URL ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  model:
    process.env.LLM_COMMENTARY_MODEL ??
    process.env.LLM_MODEL ??
    "hf.co/NAKSTStudio/chess-gemma-commentary:Q8_0",
  apiKey: process.env.LLM_API_KEY || undefined,
};

type WebServer = NonNullable<PlaywrightTestConfig["webServer"]>;
type Project = NonNullable<PlaywrightTestConfig["projects"]>[number];

const BROWSERS: Project[] = [
  { name: "chromium", use: { browserName: "chromium" } },
  { name: "webkit", use: { browserName: "webkit" } },
  { name: "firefox", use: { browserName: "firefox" } },
  {
    name: "brave",
    use: { browserName: "chromium", launchOptions: { args: ["--disable-features=BraveShieldsV2"] } },
  },
];

export type TargetConfig = {
  baseURL: string;
  webServer: WebServer;
  projects: Project[];
  testIgnore: string[];
};

/** Classical Chess Coach specs — ignored on the StarChess target. */
const CLASSICAL_SPECS = [
  "**/analysis.spec.ts",
  "**/coach.spec.ts",
  "**/dynamic-float-blunder.spec.ts",
  "**/lan-multiplayer.spec.ts",
  "**/mating-net-exit.spec.ts",
  "**/mating-sequence.spec.ts",
  // Starts on the Coach menu (/chess/) — the StarChess target has no Coach app.
  "**/nerd-mode.spec.ts",
  "**/pwa-offline.spec.ts",
  "**/responsiveness.spec.ts",
  "**/review*.spec.ts",
  "**/share.spec.ts",
];

/** Standalone StarChess specs — ignored on classical Coach targets. */
const STARCHESS_SPECS = [
  "**/starchess-queue.spec.ts",
  "**/starchess-exceptions.spec.ts",
  "**/starchess-promotion.spec.ts",
  "**/starchess-gas-used.spec.ts",
  "**/starchess-gas-step.spec.ts",
  "**/starchess-fog-path.spec.ts",
  // Needs the StarChess baseURL + Storybook (:6007), started for that target only.
  "**/starchess-collision.spec.ts",
  // Combat VFX guarantee suite (tests/vfx) — StarChess overlays only.
  "**/vfx-*.spec.ts",
];

export function targetConfig(): TargetConfig {
  if (IS_STARCHESS) {
    return {
      baseURL: "http://localhost:5175/starchess/",
      webServer: [
        {
          command: "npm run dev -- --port 5175 --strictPort",
          cwd: "../starchess",
          url: "http://localhost:5175/starchess/",
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          // Progressive fog DualNav stories (bishop / rook path reveal).
          command: "npm run storybook",
          cwd: "../starchess",
          url: "http://127.0.0.1:6007",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
      projects: [{ name: "chromium", use: { browserName: "chromium" } }],
      testIgnore: CLASSICAL_SPECS,
    };
  }

  if (IS_DESKTOP) {
    return {
      baseURL: "http://localhost:5174/chess/",
      webServer: [
        {
          command: "bun run src/main.ts",
          cwd: "../server",
          url: "http://127.0.0.1:8080/hello",
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
          env: {
            PORT: "8080",
            MAIA_WEIGHTS_DIR: WEIGHTS_DIR,
            LLM_BASE_URL: LLM.baseUrl,
            LLM_MODEL: LLM.model,
            LLM_COMMENTARY_MODEL: LLM.model,
            ...(LLM.apiKey ? { LLM_API_KEY: LLM.apiKey } : {}),
          },
        },
        {
          command: "npm run dev:desktop -- --port 5174",
          cwd: "../ui",
          url: "http://localhost:5174/chess/",
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
      projects: [{ name: "chromium", use: { browserName: "chromium" } }],
      testIgnore: ["**/pwa-offline.spec.ts", ...STARCHESS_SPECS],
    };
  }

  // web-no-llm (default): classical Coach UI + StarChess proxy target for
  // NerdModePrompt → /starchess/ (same origin via vite proxy on :5173).
  return {
    baseURL: "http://127.0.0.1:5173/chess/",
    webServer: [
      {
        command: "npm run dev:web-no-llm:vite",
        cwd: "../ui",
        url: "http://127.0.0.1:5173/chess/",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
      {
        // Proxied from coach :5173 /starchess → this server (NerdModePrompt).
        command: "npm run dev",
        cwd: "../starchess",
        url: "http://127.0.0.1:5175/starchess/",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
      {
        command: "npm run preview",
        cwd: "../ui",
        url: "http://127.0.0.1:8787/chess/",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
    ],
    projects: BROWSERS,
    testIgnore: STARCHESS_SPECS,
  };
}
