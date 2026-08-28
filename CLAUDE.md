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
| `_spec/distribution.puml` | **Distribution architecture** (partly proposed): web / docker / desktop / Android mediums; CoachService port; Android embedded-server + P2P design; WebRTC-vs-Tailscale transport |
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
| `_spec/apps/starchess/index.puml` | Live StarChess UI/PWA spec map |
| `_spec/apps/starchess/screens.puml` | Live Screen HUD: ResourceBar / TurnBarSidebar / DualNav / ExitGameConfirm |
| `_spec/apps/starchess/menu-flow.puml` | Menu → NewGamePanel → `/single` match |
| `_spec/apps/starchess/match-store.puml` | MatchStore / matchReducer / `playTimeline` wiring |
| `_spec/apps/starchess/demos.puml` | Canonical demos + shipped vs pending |
| `_spec/apps/starchess/starchess-mode.puml` | Product / UX mode (economy, specials, HUD) |
| `_spec/apps/starchess/animation-pipeline.md` | `playTimeline` → `TIMELINE_*` MatchStore → AnimationStage |
| `_spec/apps/starchess/vfx-guarantees.md` | **VFX guarantee roster** — every combat-VFX promise ↔ its e2e test (`apps/e2e/tests/vfx/`), observation method, known gaps |
| `_spec/apps/starchess/roadmap.md` | Spec remediation roadmap |
| `_spec/packages/starchess-core/*` | Live StarChess rules: SCFEN wire/queue, resolve, turn queue, sc-moves |
| `_spec/packages/starchess-core/overview.puml` | Resolve engine **module interior**: every function in `resolve-turn.ts` / `submit-turn.ts`, the snapshot ladder, the invariants that throw |
| `_spec/packages/starchess-core/resolve-turn-activity.puml` | `resolveTurn` control flow — plan classification into buckets, then phases 1–4 |
| `_spec/packages/starchess-core/submit-turn-activity.puml` | `beginScTurn` / `endScTurn` rank pipeline: ordering, bail-outs, event vocabulary |
| `_spec/packages/starchess-core/mine-contact.puml` | `board/mine-contact.ts` — the single spider-mine rules table (attack / walk / arrive) every caller asks |
| `_spec/apps/starchess/timeline/overview.puml` | `timelinePlayer.ts` interior: projector + interpreter, cue lanes, board ladder |
| `_spec/apps/starchess/timeline/cue-projection.puml` | `projectResolveTimeline` emission order (the cue list **is** the script) |
| `_spec/apps/starchess/timeline/cue-playback.puml` | `playTimeline` dispatch, commit semantics, cancellation contract |
| `_spec/apps/starchess/timeline/cue-lanes.puml` | `cueLanes.ts` routing registry — lanes / board rungs that replaced id-prefix parsing |
| `_spec/packages/client-platform/entities.puml` | `@chess-coach/client-platform`: one client-device table (UA + UA-CH + iPadOS touch tell) shared by `apps/ui` and `apps/starchess`; `isDesktopClient` needs pointer **and** UA to agree before any keyboard copy |
| `_spec/packages/engine-core/entities.puml` | `@chess-coach/engine-core` API: shared prompt/classification/commentary exports and their two consumers |
| `_spec/packages/engine-core/ui-engine-parity.md` | Bun backend ⇄ `apps/ui/src/engine` parity map (prompt logic shared via `@chess-coach/engine-core`) |

## Key architecture notes

- **StarChess standalone**: product UI/PWA lives in `apps/starchess` at `/starchess/`; rules in `packages/starchess-core`. Coach (`apps/ui`) keeps `features/nerd` + `StarChessRedirect` only — not the game tree. See `_spec/apps/starchess/deployment.puml`.
- **Dual distribution**: `runtimeMode === 'desktop'` uses `HttpCoachService` (the Bun server, `apps/server`); `runtimeMode === 'web-*'` uses `WebWorkerCoachService` (in-browser workers).
- **Shared orchestration core**: the behaviour-defining prompt / classification / commentary logic lives in `packages/engine-core` (`@chess-coach/engine-core`) and is imported by **both** the Bun server (`apps/server`) and the browser engine (`apps/ui/src/engine`) — one implementation, behavior pinned by `_spec/apps/server/behavior.md`.
- **Coach decoupling**: `useMoveExecutor` owns game mechanics and emits `lastHumanMoveInfo` / `lastAIMoveInfo` signals. `useCoachBehavior` reacts to those signals and owns all advice/emotion logic — do not add coach actions back into `useMoveExecutor`.
- **Device class**: never sniff the user agent in an app. `@chess-coach/client-platform`
  owns it (`detectClientDevice` / `resolveClientOS`), and copy that names a **key**
  must go through `isDesktopClient`, which requires `(pointer: fine) and (hover: hover)`
  *and* a non-mobile UA — either alone misfires on tablets and mouse-equipped phones.
  In `apps/starchess` use the `useIsDesktopClient()` hook. Note this is the *device*
  axis, unrelated to `runtimeMode === 'desktop'` (which is a distribution mode).
- **Capabilities pattern**: each screen sets `ScreenCapabilities` on mount (`capabilitiesStore`); hooks and components read specific flags rather than branching on a screen name.
- **Piece art**: `apps/starchess/public/pieces` holds **cburnett only**. Every
  product board — live match, review, demos, deploy/promotion pickers — renders
  the inline units in `presentation/pieces/` through the single `PieceGlyph`
  dispatcher; a static asset is reachable on exactly one branch, `cburnett`,
  whose sole entry point is `TutorialScreen`'s fog skin toggle. Never add a
  `pieceUrl` caller or a hand-rolled `pieces/<set>/` path —
  `__tests__/bundle/bundleBoundary.test.ts` fails the build if you do. The
  traced reference art lives in `apps/ui/public/pieces/nerd/`; a unit's **rest**
  pose must match it (same `PIECE_FRAME` nest, same main stroke, no aim
  normalize), and aiming applies its normalize as a CSS transform so a mover can
  settle back over `SETTLE_MS` before the overlay hands the square back.
  `presentation/pieces/` sits *below* `presentation/animations/` — animations
  import down into it, never the reverse.
- **Spider mines**: every mine decision in `starchess-core` goes through
  `board/mine-contact.ts` (`mineContact` / `withoutMine` / `hostileMineOn`) —
  never hand-roll a `mineAt(...)` + colour test. See `_spec/packages/starchess-core/mine-contact.puml`.
- **Timeline cues**: `timelinePlayer` routes on `cue.lane` / `cue.board` / `cue.group`,
  stamped by `presentation/timeline/cueLanes.ts`. Never branch on a cue id prefix.
- **These three files carry no comments**: `resolve-turn.ts`, `submit-turn.ts`,
  `timelinePlayer.ts` keep only their `// SPEC:` header — their decision record lives
  in the diagrams above. Update the diagram, not a comment.
- **Test layout**: every package keeps its tests in `src/__tests__/` (`apps/starchess`,
  `packages/starchess-core`). A test that mirrors one source file keeps that file's
  name and sits at the root of `__tests__/`; a test with no source doppelganger
  (behavior suites, guards, cross-module flows) goes in a subject folder —
  `__tests__/mine/`, `__tests__/gas/`, `__tests__/tutorial/`. Same rule for e2e
  specs under `apps/e2e/tests/<subject>/`. One subject, one owner: put a case where
  its subject folder is, not where the fixture was handy.
- **Engine scheduling**: all main-thread Stockfish work goes through the `EnginePool` singleton (`engine/EnginePool.ts`) via `evaluate(req)` — never spawn a Stockfish `Worker` directly. Pick a priority (`interactive` for hint/hover and for the best-move arrow whenever it's shown, `normal` for the best-move arrow during live Coach play when the arrow is off, `background` for review/pre-analysis) so interactive searches preempt bulk work. See `_spec/apps/ui/scheduler.puml`.
