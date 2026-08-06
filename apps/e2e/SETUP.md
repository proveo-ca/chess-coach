# e2e setup

The same specs in `tests/` run against two **targets** (see `target.ts`), selected by
`E2E_TARGET`:

| Target | Command | Wiring | Host deps |
|---|---|---|---|
| `web-no-llm` (default) | `npm test` / `npm run test:web` | UI + in-browser engine workers; vite `:5173` + wrangler PWA preview `:8787` | none beyond npm |
| `desktop` | `npm run test:desktop` | UI (desktop mode) `:5174` + Bun server `apps/server` `:8080` → `@chess-coach/engine-core` + **native Stockfish/Maia** + **local LLM** | see below |

## npm dependencies (both targets)

```sh
npm install            # @playwright/test, @types/node, typescript, chess.js
npx playwright install # browsers (chromium for desktop; + webkit/firefox/brave for web)
```

## Desktop target — local installs

`npm run test:desktop` drives the real Bun backend, which spawns native chess engines
and streams commentary from a locally-run LLM. On macOS via Homebrew:

### 1. Chess engines

```sh
brew install stockfish lc0
```

- **stockfish** (18) — spawned as `stockfish` from `$PATH` by `EngineBridge`; required for
  the server to boot.
- **lc0** (0.32) — runs Maia; spawned as `lc0`, starts lazily on the first AI move.
  lc0 ≥ 0.30 dropped the `OwnBook`/`BookFile` options, so the server's opening-book
  setoptions are harmless no-ops — **no `openings.bin` needed**.

### 2. Maia weights — already in the repo

Reused from the web build at `../ui/public/web-engine/maia-{1100,1600,2200}.pb.gz`. The
desktop config points `MAIA_WEIGHTS_DIR` there automatically (relative to the Bun
server's cwd). No download. Override with `MAIA_WEIGHTS_DIR=/abs/path`.

### 3. Local LLM (commentary)

An OpenAI-compatible local server (Ollama by default) at `http://localhost:11434/v1`:

```sh
brew install ollama                                       # if not already installed
ollama serve                                              # start the daemon
ollama pull hf.co/NAKSTStudio/chess-gemma-commentary:Q8_0 # the default model (~291 MB)
```

- Default model: a 268M Gemma-3 chess-commentary fine-tune — small, fast, on-domain.
  Specs don't assert commentary prose, so any small chat model works.
- `global-setup.ts` preflights this (reachable + model pulled, then warms it) and **fails
  fast with these exact commands** if it's missing.
- Overrides: `LLM_BASE_URL`, `LLM_COMMENTARY_MODEL` (e.g. `gemma3:1b`, or your
  `gemma4:latest`), `LLM_API_KEY`. Works with any OpenAI-compatible host (llama.cpp
  `--api`, LM Studio).

### 4. Local network path (LAN multiplayer specs)

`lan-multiplayer.spec.ts` opens a loopback WebRTC DataChannel between two browser
contexts with host ICE candidates only. Chromium publishes those as mDNS `.local`
names, which only resolve while the machine has an **active multicast-capable
network path** — in practice: Tailscale up, or Wi-Fi/Ethernet connected. If the
Tailscale service is stopped and there's no other path, every LAN spec would time
out at the first handshake gate.

- `global-setup.ts` preflights this (a minimal host↔guest DataChannel probe) and
  **skips the LAN spec with guidance** when loopback WebRTC is unavailable, so the
  rest of the suite still runs.

## Run

```sh
npm run test:web       # default target — no host deps
npm run test:desktop   # needs the three installs above
```

## Docker Compose

Runs the StarChess chromium smoke suite in the Playwright image (`E2E_TARGET=web-no-llm`).
Playwright `webServer` starts vite from `apps/ui` (`npm run dev:web-no-llm:vite`); the
image installs UI + e2e deps, and compose bind-mounts the repo at `/work` with anonymous
`node_modules` volumes so those installs survive.

```sh
docker compose build e2e
docker compose run --rm e2e
```

Full suite (chromium): `docker compose --profile full run --rm e2e-full`  
Or override: `docker compose run --rm e2e npx playwright test --project=chromium`


## CI notes

- Provide `stockfish` + `lc0` on `$PATH`, and an Ollama service with the model pulled
  (`ollama pull …`) — or repoint `LLM_*` / `MAIA_WEIGHTS_DIR` at alternatives.
- `pwa-offline.spec.ts` is web-only (pins the `:8787` PWA preview) and is auto-ignored on
  the desktop target.
- macOS gotcha baked into the config: the Bun server binds `0.0.0.0`, so the desktop
  readiness probe targets `http://127.0.0.1:8080/hello` (avoids the `localhost`→`::1`
  resolution and the `/`→`/chess` redirect-404).
