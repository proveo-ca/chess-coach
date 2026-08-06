# Chess Coach — Project Notes

## Specs are living documents

Architecture specs live in `_spec/` (repo root). The directory mirrors the
source tree: repo-wide specs at the root, per-package specs under
`_spec/apps/<app>/` and `_spec/packages/<package>/`.
They are **not snapshots** — they must stay in sync with the source.

When you add, rename, or remove a component, hook, store, or service:
1. Update the relevant `.puml` file(s) to reflect the change.
2. Keep the `// SPEC: _spec/...` comment at the top of any source file that appears in a diagram.
3. If a file is no longer referenced by any spec, remove its comment.

### Spec index

| File | Covers |
|---|---|
| `_spec/architecture.puml` | Top-level system architecture |
| `_spec/components.puml` | Full-stack architecture: UI ↔ Bun server (desktop) / in-browser workers (web); runtime modes (desktop / web-full / web-no-llm) |
| `_spec/sequence.puml` | Move, hint, and advice request flows (end-to-end) |
| `_spec/summary.md` | High-level overview |
| `_spec/distribution.md` | **Distribution architecture** (partly proposed): web / docker / desktop / Android mediums; CoachService port; Android embedded-server + P2P design; WebRTC-vs-Tailscale transport |
| `_spec/apps/ui/components.puml` | UI component graph: screens, hooks, stores, services, web-engine (no method bodies) |
| `_spec/apps/ui/entities.puml` | Full API reference: all store selectors/mutations, hook contracts, service interfaces, engine methods |
| `_spec/apps/ui/scheduler.puml` | EnginePool scheduler: workers, priority tiers + preemption, legacy-vs-pool differences |
| `_spec/apps/ui/blunder-detection.puml` | Blunder detection activity: hover (incl. mating-net-exit −9000), review annotations, LLM `classifyMoveTag` |
| `_spec/apps/ui/state-machine.puml` | UI state machine: runtime-mode resolution, screen states, game/coach state transitions |
| `_spec/apps/ui/web-llm-integration.puml` | WebLLM model loading and Linux/WebGPU workaround |
| `_spec/apps/ui/multiplayer.puml` | Serverless LAN/online multiplayer: host-hub topology over Tailscale + WebRTC (no backend) |
| `_spec/apps/ui/multiplayer-sequence.puml` | Multiplayer flows: pairing handshake (QR/link), start gate, move relay, resign/disconnect |
| `_spec/apps/ui/responsiveness/rules.md` | Responsiveness contract: min width, no page scroll, grid row priority (middle → top → bottom), avatar↔board overlap ≤50%, floating footer on short viewports |
| `_spec/apps/ui/responsiveness/layout.puml` | Root `Screen` grid priority diagram |
| `_spec/apps/ui/responsiveness/screenshots.md` | HEAD visual archive: desktop · mobile · dynamic (includes Review list + `/:id`, Analysis on all profiles) |
| `_spec/apps/server/components.puml` | Bun server component breakdown (`apps/server`: routes, in-process orchestration, engine adapters, streaming) |
| `_spec/apps/server/orchestration.puml` | Backend orchestration workflow end-to-end: move / advice / explain / hello |
| `_spec/apps/server/behavior.md` | **Backend behavioral contract** — 100% of the Bun backend orchestration behavior (source of truth for web parity) |
| `_spec/apps/android/distribution.puml` | Android distribution topology: embedded thin server + WASM WebView + P2P (proposed; `apps/android` is WIP) |
| `_spec/apps/android/webrtc-p2p.puml` | P2P multiplayer signaling + move-exchange sequence (proposed; `apps/android` is WIP) |
| `_spec/apps/starchess/deployment.puml` | Standalone StarChess scoped PWA + Worker (`/starchess/`); Coach `/chess/starchess` redirect |
| `_spec/apps/ui/starchess/*` | **OUTDATED** (pre–Phase 5–6): rules/UI path map for deleted `apps/ui/src/starchess`; live code is `packages/starchess-core` + `apps/starchess` |
| `_spec/packages/engine-core/entities.puml` | `@chess-coach/engine-core` API: shared prompt/classification/commentary exports and their two consumers |
| `_spec/packages/engine-core/ui-engine-parity.md` | Bun backend ⇄ `apps/ui/src/engine` parity map (prompt logic shared via `@chess-coach/engine-core`) |

## Key architecture notes

- **StarChess standalone**: product UI/PWA lives in `apps/starchess` at `/starchess/`; rules in `packages/starchess-core`. Coach (`apps/ui`) keeps `features/nerd` + `StarChessRedirect` only — not the game tree. See `_spec/apps/starchess/deployment.puml`.
- **Dual distribution**: `runtimeMode === 'desktop'` uses `HttpCoachService` (the Bun server, `apps/server`); `runtimeMode === 'web-*'` uses `WebWorkerCoachService` (in-browser workers).
- **Shared orchestration core**: the behaviour-defining prompt / classification / commentary logic lives in `packages/engine-core` (`@chess-coach/engine-core`) and is imported by **both** the Bun server (`apps/server`) and the browser engine (`apps/ui/src/engine`) — one implementation, behavior pinned by `_spec/apps/server/behavior.md`.
- **Coach decoupling**: `useMoveExecutor` owns game mechanics and emits `lastHumanMoveInfo` / `lastAIMoveInfo` signals. `useCoachBehavior` reacts to those signals and owns all advice/emotion logic — do not add coach actions back into `useMoveExecutor`.
- **Capabilities pattern**: each screen sets `ScreenCapabilities` on mount (`capabilitiesStore`); hooks and components read specific flags rather than branching on a screen name.
- **Engine scheduling**: all main-thread Stockfish work goes through the `EnginePool` singleton (`engine/EnginePool.ts`) via `evaluate(req)` — never spawn a Stockfish `Worker` directly. Pick a priority (`interactive` for hint/hover and for the best-move arrow whenever it's shown, `normal` for the best-move arrow during live Coach play when the arrow is off, `background` for review/pre-analysis) so interactive searches preempt bulk work. See `_spec/apps/ui/scheduler.puml`.
