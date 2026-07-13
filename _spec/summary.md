# Chess Coach — Summary

## Overview
This project provides an interactive chess coach environment. It is designed as an **Anti-framework** implementation to explore fundamental execution loops, raw prompting, and tool calling mechanics without black-box abstractions.

## Distribution Mediums
The application is built to be deployed in different ways, sharing the same SolidJS UI but swapping the orchestration layer at compile time via `VITE_TARGET` (`web-no-llm` · `web-full` · `desktop`). The behaviour-defining prompt / classification / commentary logic is shared across all editions through **`packages/engine-core`** (`@chess-coach/engine-core`) — one implementation, pinned by [`_spec/apps/server/behavior.md`](apps/server/behavior.md).

### 1. Cloudflare Workers (Web Mode)
- **Targets:** `VITE_TARGET=web-no-llm` (hosted at proveo.ca/chess) and `VITE_TARGET=web-full`.
- **Hosting:** Cloudflare Pages / Workers under the `/chess` path.
- **Architecture:** 100% Client-Side. The UI runs entirely in the browser.
- **Orchestration:** A dedicated Web Worker (`orchestrator.worker.ts`) handles the execution loop.
- **Engines:** `stockfish-18-lite-single.js` (single-threaded WASM) for hints/hover analysis; **Maia (lc0.wasm)** generates the AI opponent's moves.
- **LLM (`web-full` only):** `@mlc-ai/web-llm` (WebGPU) runs the fine-tuned **`chess-gemma-commentary`** model (`chess-gemma-commentary-q0f32-MLC`, a `gemma-3-270m` fine-tune) on the user's hardware. `web-no-llm` omits the LLM entirely.

### 2. Docker / Native (Server/Desktop Mode)
- **Target:** `VITE_TARGET=desktop` (the UI resolves the API same-origin; a dev server on a separate port sets `VITE_API_URL`).
- **Hosting:** the root `Dockerfile` (UI + native engines + Bun server in one image) or a native host running the Bun server directly.
- **Architecture:** Client-Server. The UI connects to a Bun REST server (`apps/server`).
- **Orchestration:** The Bun server runs the execution loop **in-process** — managing state (`game_state.fen`) and engine/LLM I/O directly (no separate daemon or wire protocol). Prompt logic is shared with the web build via `@chess-coach/engine-core`.
- **Engines:** The UI still uses one local `stockfish-18-lite.js` (threaded WASM) worker for instant hover evaluations and hints. The *backend* uses native Stockfish binaries and Maia (lc0) for the AI opponent's moves.
- **LLM:** The backend connects to a local or remote Ollama instance via HTTP (recommended commentary model: `hf.co/NAKSTStudio/chess-gemma-commentary:Q8_0`).

## LAN / Online Multiplayer (serverless host-hub — Tailscale + WebRTC)
A **human-vs-human** mode that needs **no backend**: the Bun server, Maia and the LLM are not involved. It ships in the client-only web / PWA build and is reached from `/chess/lan` (`LanScreen`).

- **Connectivity:** every participant installs **Tailscale** and joins the same tailnet; devices get stable `100.x` IPs with no NAT.
- **Transport:** browsers talk **peer-to-peer over WebRTC `RTCDataChannel`**. Because the tailnet has no NAT, WebRTC connects via **host ICE candidates** — **no STUN / TURN / relay** (`iceServers: []`).
- **Topology — host-hub:** the room creator's browser is the **hub** (room authority); the other player and observers each open a DataChannel to it. The host runs the authoritative `chess.js` game and relays every move + room-state update.
- **Signaling (serverless):** WebRTC still needs a one-time offer/answer exchange. With no server this is **manual & out-of-band** — the host shows a **QR code / shareable link** (`/chess/lan#o=…`) and the joiner returns an answer QR/link (`#a=…`), one exchange per joiner. Non-trickle ICE keeps each blob to a single QR.
- **Room:** two **player seats** plus **up to 4 optional observers**. **Colors are not assigned by default** — each player picks **White** or **Black** in the lobby and may select the opposite seat to **swap**; any color change resets both ready votes. Colors lock only when **both players press Start Game** (observers never required). The host browser **is** the room — if it closes, the room ends.
- **Known risk:** mobile browsers may obfuscate the `100.x` host candidate with `.local` mDNS names; whether the tailnet path survives that must be validated on real devices before relying on the design.

## Rendering & UI (SolidJS)
A minimal Single Page Application (SPA) using SolidJS.
- **State Management:** FEN history and move history are stored client-side, allowing instant replayability without backend calls.
- **Hinting & Hover Evals:** The UI queries a dedicated Stockfish Web Worker directly for real-time hints and blunder detection on hover, regardless of the distribution medium. Full blunder-detection scenarios (hover, review annotations, LLM tags) are gathered in [`apps/ui/blunder-detection.puml`](apps/ui/blunder-detection.puml). Hover treats mating-net exit as a distinct −9000 case with dedicated advice phrases; review/LLM still use generic large-Δ only.
