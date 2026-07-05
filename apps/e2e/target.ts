// Resolves the e2e "target" — which wiring of the SAME apps/ui is under test.
//
//   web-no-llm (default): UI + in-browser engine workers (apps/ui/src/engine),
//                         served by vite (:5173) and the wrangler PWA preview
//                         (:8787). Commentary is a no-op in this mode.
//   desktop:              UI built in desktop mode (HttpCoachService) talking to
//                         the Bun server (apps/server) over HTTP. The server hosts
//                         the SAME @chess-coach/engine-core, and commentary is
//                         produced by a locally-run, OpenAI-compatible LLM (Ollama).
//   android:              the web-no-llm UI built + synced into the Android
//                         embedded server's webroot and served by the SAME Go
//                         static host the APK uses (thinserver, via cmd/devserver
//                         on :8790) — asserts the exact bytes and host behavior
//                         (//go:embed, COOP/COEP, /chess/ base path, SPA fallback)
//                         of the Android distribution, no emulator required.
//                         Chromium only: Android System WebView is Chromium.
//
// All targets render the identical UI and share engine-core, so the specs assert
// the same behavior — running them against each wiring proves the parity
// (_spec/packages/engine-core/ui-engine-parity.md, _spec/distribution.md §3.5)
// holds in practice.
//
// `E2E_TARGET` selects the target. Specs may `import { IS_DESKTOP } from "../target"`
// to branch expectations; the Playwright config branches baseURL / webServer /
// projects / testIgnore below.
import type { PlaywrightTestConfig } from "@playwright/test";

export type Target = "web-no-llm" | "desktop" | "android";

export const TARGET: Target = (process.env.E2E_TARGET as Target) || "web-no-llm";
export const IS_DESKTOP = TARGET === "desktop";
export const IS_ANDROID = TARGET === "android";

// Where specs can dynamically import the app's own share encoder in-page
// (share.spec.ts): vite dev servers serve the source module directly; the
// android target serves a production build, so android-devserver.sh bundles
// the same source into the webroot as a standalone ESM file. Node-side import
// is not an option: apps/ui is `"type": "module"`, and Playwright's CJS
// transform can't load its TS across the package boundary.
export const SHARE_MODULE = IS_ANDROID
  ? "/chess/e2e-gameShare.js"
  : "/chess/src/services/gameShare.ts";

// The Bun server spawns native `stockfish` + `lc0` (brew: `brew install stockfish lc0`)
// and loads Maia weights from MAIA_WEIGHTS_DIR. The web build already ships those
// weights (maia-{1100,1600,2200}.pb.gz) in apps/ui/public/web-engine, so reuse them
// rather than re-downloading. lc0 ≥0.30 dropped OwnBook/BookFile, so the server's
// book setoptions are harmless no-ops here — no openings.bin needed.
//
// Relative to the Bun server's cwd (apps/server, set by the webServer `cwd` below);
// lc0 inherits that cwd, so this resolves to apps/ui/public/web-engine. A path
// string keeps target.ts free of import.meta/__dirname (Playwright's TS loader
// trips on ESM/CJS mode-mixing). Override with MAIA_WEIGHTS_DIR for another location.
const WEIGHTS_DIR = process.env.MAIA_WEIGHTS_DIR ?? "../ui/public/web-engine";

// Local LLM wiring (desktop only). Names mirror what apps/server/src/LlmClient.ts
// (OllamaLlmClient) reads, so passing these into the server's env is enough — no
// code change in apps/server. The specs don't assert commentary prose, so the
// default is the smallest on-domain option: a 268M Gemma 3 fine-tune built for
// chess coach commentary (291MB, fast). Override any of these from the
// environment to point at another model or local OpenAI-compatible runtime
// (e.g. LLM_COMMENTARY_MODEL=gemma3:1b, or a llama.cpp --api / LM Studio host).
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

export function targetConfig(): TargetConfig {
  if (IS_DESKTOP) {
    return {
      baseURL: "http://localhost:5174/chess/",
      webServer: [
        {
          // The Bun server (apps/server) — hosts @chess-coach/engine-core and
          // streams commentary from the local LLM. Probe "/" (instant 302,
          // LLM-independent); the LLM itself is verified in global-setup so a
          // missing model fails fast with guidance instead of mid-suite timeouts.
          command: "bun run src/main.ts",
          cwd: "../server",
          // Probe /hello (returns 200; harmless even if the LLM is down — phrases
          // are hardcoded and warmup is best-effort). Not "/": that 302-redirects
          // to /chess, which 404s in dev (vite serves the UI, not the server), and
          // Playwright treats the followed 404 as not-ready. Also IPv4-explicit —
          // the server binds 0.0.0.0, but "localhost" resolves to ::1 first on macOS.
          url: "http://127.0.0.1:8080/hello",
          reuseExistingServer: true,
          timeout: 60_000,
          env: {
            PORT: "8080",
            MAIA_WEIGHTS_DIR: WEIGHTS_DIR,
            LLM_BASE_URL: LLM.baseUrl,
            // Force the small model for both general + commentary (the server
            // otherwise defaults to qwen2.5:7b, too heavy for e2e).
            LLM_MODEL: LLM.model,
            LLM_COMMENTARY_MODEL: LLM.model,
            ...(LLM.apiKey ? { LLM_API_KEY: LLM.apiKey } : {}),
          },
        },
        {
          // The SAME apps/ui, built in desktop mode (VITE_API_URL → :8080), served
          // by vite on a port distinct from web-no-llm's :5173 so both targets can
          // coexist. Cross-origin isolation headers come from the shared vite config.
          command: "npm run dev:desktop -- --port 5174",
          cwd: "../ui",
          url: "http://localhost:5174/chess/",
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],
      // Engine/server parity doesn't need cross-browser coverage; keep desktop cheap.
      projects: [{ name: "chromium", use: { browserName: "chromium" } }],
      // pwa-offline pins its own baseURL to the wrangler PWA preview (:8787), which
      // the desktop target doesn't run — the service worker is a web-build concern,
      // not a server concern.
      testIgnore: ["**/pwa-offline.spec.ts"],
    };
  }

  if (IS_ANDROID) {
    return {
      baseURL: "http://127.0.0.1:8790/chess/",
      webServer: [
        {
          // Builds web-no-llm, syncs it into thinserver/webroot (mirroring the
          // Gradle syncWeb task), and serves it with the Go host the APK embeds.
          // Needs Go on PATH (checked in global-setup) — no Android SDK/NDK.
          // Timeout covers the UI build + the first `go run` compile of the
          // tailscale.com dependency tree on a cold Go build cache.
          command: "bash android-devserver.sh",
          url: "http://127.0.0.1:8790/chess/",
          reuseExistingServer: true,
          timeout: 300_000,
          env: { PORT: "8790" },
        },
      ],
      // The WebView is Chromium; cross-browser coverage belongs to web-no-llm.
      projects: [{ name: "chromium", use: { browserName: "chromium" } }],
      // pwa-offline pins the wrangler preview (:8787); the service worker is a
      // web-deploy concern — the Android WebView loads from loopback instead.
      testIgnore: ["**/pwa-offline.spec.ts"],
    };
  }

  // web-no-llm (default): unchanged from the original config — two servers run in
  // parallel, :5173 (vite dev, fast specs) and :8787 (wrangler dev over the prod
  // build, for the PWA service-worker / offline spec).
  return {
    baseURL: "http://localhost:5173/chess/",
    webServer: [
      {
        command: "npm run dev:web-no-llm:vite",
        cwd: "../ui",
        url: "http://localhost:5173/chess/",
        reuseExistingServer: true,
        timeout: 30_000,
      },
      {
        command: "npm run preview",
        cwd: "../ui",
        url: "http://localhost:8787/chess/",
        reuseExistingServer: true,
        // `preview` runs the full vite build before booting wrangler dev.
        timeout: 180_000,
      },
    ],
    projects: BROWSERS,
    testIgnore: [],
  };
}
