# Chess Coach

A fully-local AI chess coach: play against a human-like opponent (Maia) and get
move-by-move coaching commentary from an LLM — with **nothing leaving your
machine**. The same SolidJS UI ships in two very different ways, swapping only the
orchestration layer underneath.

### ▶ Try it now — **[proveo.ca/chess](https://proveo.ca/chess)**

The hosted demo is the **`web-no-llm`** edition: zero install, runs entirely in
your browser. No account, no backend, no GPU required.

---

## Two editions

| | **`web-no-llm`** (hosted) | **Desktop** (full stack) |
|---|---|---|
| Where it runs | 100% in the browser | Bun server + UI on your machine |
| Live at | [proveo.ca/chess](https://proveo.ca/chess) | self-hosted (Docker or native) |
| Chess engine | Stockfish (WASM) | native Stockfish |
| Opponent (human-like) | Maia / lc0 (WASM) | native Maia / lc0 |
| Coaching commentary (LLM) | **none** | Ollama (`chess-gemma-commentary`) |
| Install required | none | Docker **or** Bun + engines |
| Privacy | all client-side | all on your host |

> There is also a **`web-full`** browser build that adds on-device LLM commentary
> via WebGPU/WebLLM — the same `chess-gemma-commentary` model, compiled to WASM
> with MLC (`chess-gemma-commentary-q0f32-MLC`). It's the same client-only
> deployment as `web-no-llm` with the coach turned on — see
> [`_spec/distribution.md`](_spec/distribution.md). This README focuses on the two
> editions above.

The architecture rule that makes this work: the coaching orchestration sits behind
a single UI port (`CoachService`), and the behaviour-defining prompt/classification
logic is shared by both editions via the `@chess-coach/engine-core` package. The
UI build picks the wiring at compile time with `VITE_TARGET`
(`web-no-llm` · `web-full` · `desktop`).

---

## `web-no-llm` — the hosted, in-browser edition

This is what runs at **[proveo.ca/chess](https://proveo.ca/chess)**.

- **100% client-side.** The UI, the chess engine, and the AI opponent all run in
  the browser. There is no server doing chess or LLM work.
- **Engines:** one Stockfish WASM worker powers hints and hover/blunder evaluation;
  Maia (lc0 WASM) generates the human-like opponent's moves.
- **No LLM.** This edition omits the language-model coach entirely, so it's light
  enough to run on any modern device with no GPU and no model download. You still
  get the full board, hints, eval bar, and a Maia opponent — just without the
  written commentary.
- **Hosting:** deployed to Cloudflare Pages/Workers under the `/chess` path.

Run it locally:

```bash
cd apps/ui
npm install
npm run dev:web-no-llm:vite     # Vite dev server
# or build + serve via Wrangler exactly as deployed:
npm run preview
```

Deploy (from the repo root):

```bash
npm run deploy:web-no-llm        # build:web-no-llm + wrangler deploy
```

---

## Desktop — the full local stack

The desktop edition runs the same UI against a **Bun server** (`apps/server`) that
orchestrates the coaching loop *in-process* and talks to **native** engines plus a
**local LLM**:

- **Bun server** owns game state and the execution loop, exposing `/move`,
  `/advice`, `/explain`, etc., and serving the compiled UI under `/chess`.
- **Engines:** native **Stockfish** binary (eval/legality/hints) + native **Maia
  (lc0)** for the human-like opponent. The browser still runs one Stockfish WASM
  worker for instant local hover evals.
- **LLM:** an **Ollama** instance (OpenAI-compatible API) provides the coaching
  commentary. The commentary model is **`chess-gemma-commentary`** — a
  `gemma-3-270m` fine-tune by NAKST Studio (~291 MB as
  `hf.co/NAKSTStudio/chess-gemma-commentary:Q8_0`).

There are two ways to run it: **Docker** (everything bundled) or a **native macOS
host** (you provide the engines + Ollama).

### Requirements

~16 GB RAM and ~15 GB free disk (engine weights + LLM). See
[`MINIMUM_REQUIREMENTS.md`](MINIMUM_REQUIREMENTS.md) for the full breakdown.

### Option A — Docker

The root [`Dockerfile`](Dockerfile) builds the desktop UI, compiles **lc0**,
installs **Stockfish**, and downloads the Maia weights, an opening book, and the
3-4-5 Syzygy tablebases into the image. It does **not** bundle the LLM — point the
container at an Ollama instance running on your host.

```bash
# 1. Build the image (first build is large — downloads weights + tablebases)
docker build -t chess-coach .

# 2. Make sure Ollama is running on the host with the commentary model pulled
ollama serve &
ollama pull hf.co/NAKSTStudio/chess-gemma-commentary:Q8_0

# 3. Run, pointing the server at the host's Ollama
docker run --rm -p 8080:8080 \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434/v1 \
  -e LLM_COMMENTARY_MODEL=hf.co/NAKSTStudio/chess-gemma-commentary:Q8_0 \
  chess-coach
```

Then open **http://localhost:8080/chess**.

> On Linux, `host.docker.internal` may require
> `--add-host=host.docker.internal:host-gateway`, or use the host's LAN IP.
> OrbStack is recommended over Docker Desktop on Mac for lower memory overhead.

### Option B — native macOS host (no Docker)

Run the Bun server directly on macOS and use Homebrew-installed engines.

```bash
# 1. Install the runtime + native engines + LLM
brew install oven-sh/bun/bun stockfish lc0 ollama

# 2. Start Ollama and pull the commentary model
ollama serve &
ollama pull hf.co/NAKSTStudio/chess-gemma-commentary:Q8_0

# 3. Fetch the Maia weights + opening book into a local dir.
#    (Exact files/URLs are listed in the Dockerfile, lines ~47–54:
#     maia-1100/1600/2200.pb.gz and openings.bin)
mkdir -p ~/.chess-coach/weights
#    ...download maia-*.pb.gz and openings.bin into ~/.chess-coach/weights

# 4. Build the UI (desktop target → talks to the local server)
cd apps/ui && npm install && npm run build:desktop && cd ../..

# 5. Run the server, pointing it at the UI build + weights + commentary model
MAIA_WEIGHTS_DIR=~/.chess-coach/weights \
STATIC_DIR=apps/ui/dist \
LLM_COMMENTARY_MODEL=hf.co/NAKSTStudio/chess-gemma-commentary:Q8_0 \
bun run apps/server/src/main.ts
```

Open **http://localhost:8080/chess**.

**Dev loop** (hot-reload UI against the server): run the server as above, then in
another terminal `cd apps/ui && npm run dev:desktop` — the Vite dev server proxies
to the API at `http://localhost:8080`.

### Configuration (server env vars)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | `8080` / `127.0.0.1` | server bind address. Binds loopback by default; set `HOST=0.0.0.0` (or a specific IP) to reach it from another device. Docker sets `HOST=0.0.0.0` in the image. |
| `ALLOWED_ORIGINS` | localhost dev ports | comma-separated extra CORS origins allowed to call the API cross-origin (the UI is same-origin under `/chess`, so this is only for custom dev setups) |
| `OLLAMA_BASE_URL` / `LLM_BASE_URL` | `http://localhost:11434/v1` | LLM endpoint (OpenAI-compatible) |
| `LLM_COMMENTARY_MODEL` | = general model | commentary model — set to `hf.co/NAKSTStudio/chess-gemma-commentary:Q8_0` |
| `LLM_MODEL` / `LLM_GENERAL_MODEL` | `qwen2.5:7b` | fallback when `LLM_COMMENTARY_MODEL` is unset |
| `LLM_API_KEY` | — | bearer token, if your LLM host needs one |
| `MAIA_WEIGHTS_DIR` | `/app/weights` | dir holding `maia-*.pb.gz` + `openings.bin` |
| `SYZYGY_PATH` | — | Syzygy tablebase dir (set automatically in Docker) |
| `STATIC_DIR` | `static` | dir of the compiled UI (`/chess` served from here) |
| `CHESS_STATE_DIR` | cwd | dir for the `game_state.fen` file (Docker sets `/app/state`, owned by the non-root run user) |

---

## Repo layout

```
apps/
  ui/        SolidJS UI (all editions; VITE_TARGET selects the wiring)
  server/    Bun server — in-process coach orchestrator + native engines
  android/   embedded-server + WebView shell (scaffolded)
  e2e/       Playwright end-to-end tests
packages/
  engine-core/   shared prompt/classification/commentary logic (@chess-coach/engine-core)
_spec/           living architecture specs (.puml + .md) — see CLAUDE.md for the index
Dockerfile       desktop-edition image (UI + native engines + Bun server)
```

## Further reading

- [`_spec/distribution.md`](_spec/distribution.md) — full distribution matrix (web / docker / desktop / Android)
- [`_spec/apps/server/behavior.md`](_spec/apps/server/behavior.md) — backend orchestration behavioural contract
- [`_spec/summary.md`](_spec/summary.md) — high-level overview
- [`CLAUDE.md`](CLAUDE.md) — architecture notes + spec index

## Credits

- **The Cat** — by Johan Mouchet · [codepen.io/johanmouchet](https://codepen.io/johanmouchet)
- **The Board** — by Jeff Hlywa · [github.com/jhlywa/chess.js](https://github.com/jhlywa/chess.js)
- **The (Human) Pieces** — by Colin M.L. Burnett (via Lichess) · [github.com/lichess-org/lila](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett)
- **The Eval Engine** — by Stockfish · [stockfishchess.org](https://stockfishchess.org/)
- **The Brain (Chess Moves)** — by Maia · [maiachess.com](https://maiachess.com/)
- **The Brain (Chess Commentary)** — by NAKST Studio · [nakststudio.com](https://nakststudio.com/) *(commentary builds only)*
- **All running on your device** — by Roberto von Schoettler · [github.com/proveo-ca](https://github.com/proveo-ca)
