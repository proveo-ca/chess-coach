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
| `_spec/apps/server/components.puml` | Bun server component breakdown (`apps/server`: routes, in-process orchestration, engine adapters, streaming) |
| `_spec/apps/server/orchestration.puml` | Backend orchestration workflow end-to-end: move / advice / explain / hello |
| `_spec/apps/server/behavior.md` | **Backend behavioral contract** — 100% of the Bun backend orchestration behavior (source of truth for web parity) |
| `_spec/apps/android/distribution.puml` | Android distribution topology: embedded thin server + WASM WebView + P2P (proposed; `apps/android` is WIP) |
| `_spec/apps/android/webrtc-p2p.puml` | P2P multiplayer signaling + move-exchange sequence (proposed; `apps/android` is WIP) |
| `_spec/_plans/android-p2p-wiring.puml` | **PLANNED** — remaining Coach Android wiring from feat-android: `LanScreen` → `P2PClient` / `ChessNative`; Go thin server stays host-only |
| `_spec/apps/starchess/deployment.puml` | Standalone StarChess scoped PWA + Worker (`/starchess/`); Coach `/chess/starchess` redirect |
| `_spec/apps/starchess/index.puml` | Live StarChess UI/PWA spec map |
| `_spec/apps/starchess/screens.puml` | Live Screen HUD: ResourceBar / TurnBarSidebar / DualNav / ExitGameConfirm |
| `_spec/apps/starchess/menu-flow.puml` | Menu → NewGamePanel → `/single` match |
| `_spec/apps/starchess/match-store.puml` | MatchStore / matchReducer / `playTimeline` wiring |
| `_spec/apps/starchess/demos.puml` | Canonical demos + shipped vs pending |
| `_spec/apps/starchess/starchess-mode.puml` | Product / UX mode (economy, specials, HUD) |
| `_spec/apps/starchess/replay-import.puml` | Arena record import: file → localStorage + `?game=` / `?scfens=` validate → `ReviewDemoScreen` |
| `_spec/apps/starchess/animation-pipeline.md` | `playTimeline` → `TIMELINE_*` MatchStore → AnimationStage |
| `_spec/apps/starchess/vfx-guarantees.md` | **VFX guarantee roster** — every combat-VFX promise ↔ its e2e test (`apps/e2e/tests/vfx/`), observation method, known gaps |
| `_spec/apps/starchess/roadmap.md` | Spec remediation roadmap |
| `_spec/packages/starchess-core/*` | Live StarChess rules: SCFEN wire/queue, resolve, turn queue, sc-moves |
| `_spec/packages/starchess-core/overview.puml` | Resolve engine **module interior**: every function in `resolve-turn.ts` / `submit-turn.ts`, the snapshot ladder, the invariants that throw |
| `_spec/packages/starchess-core/resolve-turn-activity.puml` | `resolveTurn` control flow — plan classification into buckets, then phases 1–4 |
| `_spec/packages/starchess-core/submit-turn-activity.puml` | `beginScTurn` / `endScTurn` rank pipeline: ordering, bail-outs, event vocabulary |
| `_spec/packages/starchess-core/mine-contact.puml` | `board/mine-contact.ts` — the single spider-mine rules table (attack / walk / arrive) every caller asks |
| `_spec/packages/starchess-core/deploy-reach.puml` | `board/deploy-reach.ts` — the single deploy-reach table; **a `false` is a proof**, and the explicit non-goal vs "should I deploy to capture" |
| `_spec/packages/starchess-core/ray-scan.puml` | `board/ray-scan.ts` — one `scanRay` + one `takeRayContact` replacing the duplicated ray walks |
| `_spec/apps/starchess/timeline/overview.puml` | `timelinePlayer.ts` interior: projector + interpreter, cue lanes, board ladder |
| `_spec/apps/starchess/timeline/cue-projection.puml` | `projectResolveTimeline` emission order (the cue list **is** the script) |
| `_spec/apps/starchess/timeline/cue-playback.puml` | `playTimeline` dispatch, commit semantics, cancellation contract |
| `_spec/apps/starchess/timeline/cue-lanes.puml` | `cueLanes.ts` routing registry — lanes / board rungs that replaced id-prefix parsing |
| `_spec/apps/starchess/core/index.puml` | **Core single-owner interaction plan** — Command / Facade / Pipeline / Interpreter / Query, and the forbidden dual path per concern |
| `_spec/apps/starchess/core/engine-boundary.puml` | Public API surface of the core; what the app may not reach past |
| `_spec/apps/starchess/core/scfen/document.puml` | `scfen/codec.ts` as sole wire I/O owner |
| `_spec/apps/starchess/core/turn/command-queue.puml` | `addScAction` as the only queue write |
| `_spec/apps/starchess/core/turn/turn-facade.puml` | `beginScTurn` / `endScTurn` facade |
| `_spec/apps/starchess/core/turn/resolve-pipeline.puml` | `resolveTurn` phases |
| `_spec/apps/starchess/core/turn/match-state-machine.puml` | `matchReducer` as sole app-state write |
| `_spec/apps/starchess/core/turn/playback-interpreter.puml` | `timelinePlayer` as sole playback owner |
| `_spec/apps/starchess/core/turn/turn-bonus-broadcast.puml` | Turn-bonus broadcast wiring |
| `_spec/apps/starchess/core/board/board-queries.puml` | Board queries: vision · mines · adjacency |
| `_spec/apps/starchess/core/board/planning-projection.puml` | Occupancy → planning overlay stack |
| `_spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml` | **ADJUTANT (SCRIPT NAIVE)** — the script actually behind `/single`; context → posture → strategies → plans → commit. Records the deliberate CC omniscience |
| `_spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml` | **ADJUTANT (SCRIPT STRATEGIC)** — known-vs-seen dials, the shipped `economy`/`runners`/`captures`/`survival`/`threats`/`checks` set, and the `NAIVE_NOT_OVERRIDDEN` substitution (only `mapControl` survives from naive). Two hosts: the arena and `/single` |
| `_spec/apps/starchess/core/adjutant/strategic/strategic-economy.puml` | Strategic deploy dials on known-vs-seen: `BATTLESHIP_FINISH`, `HIDDEN_GUARD`, `SHIP_WARP_READY`, horizon-5 lookahead, direct spawn crush |
| `_spec/apps/starchess/core/adjutant/strategic/promotion-defense.puml` | **Enemy promotion race** — runners read in *turns* (a marine covers 2 ranks/turn), the capture / block / cover / abandon answers, the `seekFocus` damp, and the `witness.ts` fly-by channel (`runnerCrossings`, fog-gated) |
| `_spec/apps/starchess/core/adjutant/strategic/cc-retaliation.puml` | **CC retaliation** — firing on a Command Center names the shooter (`ccShot`, the one ungated channel), the wanted-list `AttackerMemory` (a fact with an expiry, not a posterior), `AVENGE_CC_SHOT` 9_000 + `AVENGE_THRIFT`, and the stacked-check exception |
| `_spec/apps/starchess/core/adjutant/cc-focus.puml` | **CC targeting contract** — fog-honest strategic / omniscient naive (decided), the always-false `isGuess` bug it replaced, and the open defects (Marine check double-counted; `lastCCProbe` never populated by either host; `tracking.ts` folds the posterior on thinner vision than the planner) |
| `_spec/apps/starchess/core/adjutant/weight-ladder.puml` | **The scoring ladder** — every named weight with its value and tier, the 18 orderings `__tests__/tactics/weightOrdering.test.ts` enforces, and what nothing pins |
| `_spec/packages/starchess-arena/index.puml` | Script-arena spec map (`packages/starchess-arena`) |
| `_spec/packages/starchess-arena/arena.puml` | **Headless script arena** — `beginScTurn`/`endScTurn` loop, arena-owned bank + the three core folds (`KnownVsSeen` · `CCIntel` · `RunnerMemory`), recording rule, determinism guarantee, optional `EngineFeed` rescue |
| `_spec/apps/server/starchess-arena-feed.puml` | Bun-side `StarChessFeed` + pool + record store + routes behind `EngineFeed` |
| `_spec/PLAN-starchess-script-arena.md` | Script-arena plan (partly shipped — keep until its open phases land) |
| `_spec/_plans/backlog-line-items.puml` | Backlog map (2026-09-17 retargeted): remaining StarChess leave/export/analytics + Coach Android `P2PClient` wiring vs shipped/withdrawn children; live map is `_spec/apps/starchess/index.puml` |
| `_spec/_plans/PLAN-ml-adjutant.md` | **ML Adjutant plan** (PLANNED) — the `ml/` workspace as a third script beside naive/strategic: Elo ladder, fog-filtered observation + action vectorisation, parallel self-play + determinization, and a native SCFEN `cp` evaluator that retires Stockfish |
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
- **Deploy reach**: "can this side land a deploy that covers X" has exactly one
  owner, `board/deploy-reach.ts` (`deployTargets` / `deployableUnits` /
  `deployCovers`). It is exhaustive over landing squares and affordable units, so
  **a `false` is a proof, not a heuristic** — callers gate material decisions on
  it. Never hand-roll a per-caller deploy simulation (a Marine-only one inside
  `captures.ts` is exactly what this replaced). Ask on the **POST-move** board
  when the question is a recapture, and pass an enemy mineral figure you are
  entitled to know. The landing rule is the validator's, not a guess: own-colour
  blocked, **any** King blocked (an enemy Command Center cannot be crushed),
  enemy non-King **kept** — the deploy crushes it. The separate question "should
  *I* deploy onto that square to crush it" is a *score* and stays in
  `ai/strategic/strategies/economy.ts` — do not conflate the two. Note the three
  deploy-landing derivations in `ai/` still disagree with the validator; see
  `_spec/packages/starchess-core/deploy-reach.puml` and
  `_spec/apps/starchess/core/adjutant/strategic/strategic-economy.puml`.
- **Adjutant CC targeting**: `ctx.enemyCC` is `findCC(map, enemy)` and is
  **never fog-filtered**. The naive script reads it directly and is omniscient by
  design; the strategic script is fog-honest and must resolve `targetCC` once
  from `isGuess = !vision.enemyCCVisible`, then aim every term at that. Never
  gate a fog branch on `enemyCC == null` — it is null only when the game is
  over, which is the bug that made every `_GUESS` weight dead code. See
  `_spec/apps/starchess/core/adjutant/cc-focus.puml`.
- **Adjutant cross-ply state**: four folds — the CC posterior (`CCIntel`), the
  known-vs-seen ledger (`KnownVsSeen`), the enemy-runner memory (`RunnerMemory`)
  and the retaliation record (`AttackerMemory`) — are folded forward by
  `ai/strategic/tracking.ts` in **starchess-core** — one owner, threaded by
  both hosts (`SingleScreen` for live play, `run/runMatch.ts` for the arena).
  These folds used to live in `packages/starchess-arena/src/players/`, where the
  app could not reach them and the arena's own player dropped them. Never
  re-implement a fold in a host: a per-host copy is what made the posterior
  restart from the home prior every turn.
- **Adjutant resolve evidence**: a settled resolve says things no pair of boards
  can (a mover's true `from → to`), and it is emitted with **no viewer**. Never
  hand a raw `EndScTurnResult` to a script: the hosts build a `ResolveWitness`
  via the single adapter `witnessFromEndTurn`, and `ai/strategic/witness.ts` is
  the fog gate. `runnerCrossings` is gated (vision read from `esr.afterB`, the
  board we were watching *from*); `ccAttackers` needs no gate and is honest
  anyway, because a Command Center that takes a hit knows it took one and the
  shot carries its own `from`. The two witness folds run once per **settled
  ply** — `settledResolves` in the app, the chip and settle points in the arena
  — which is a finer cadence than `foldTracking`'s per-turn approximation.
  **`beginScTurn` does not advance the clock**: a turn-open chip ply carries the
  same `turn` as the settle before it, so never dedupe a ply by turn number. A
  fold may gate *propagation* on the turn (the runner walk and decay do), but
  gating the whole fold throws away the chip's evidence — and a turn-open chip
  is the most common way a Command Center is ever shot.
- **Adjutant promotion defense**: an *enemy* marine's promotion distance is
  read in **turns, not squares** — a marine covers two ranks per turn (gas step
  in B + classical in C), so three squares out is two turns from a BattleShip on
  our back rank. One owner: `ai/strategic/runners.ts` (fog-honest scan, on the
  context) plus `strategic/strategies/runners.ts` (capture / block / cover, and
  the charge for walking the only blocker away). `nearPromoteRush` in
  `ai/strategies/mapControl.ts` is the *other* direction — our own marines — and
  is deliberately unchanged. A marine that leaves our vision is **remembered**,
  not forgotten: `foldRunnerMemory` carries a decaying possible-set forward per
  ply (see the cross-ply bullet above). Two rules that are easy to break by
  accident: **containment must be knowledge**, so `blockedBy` counts only our own
  units and mines (fog or not) plus occupants on lit/revealed squares — never a
  bare `map.has(s)`, which lets an enemy hiding in the dark damp a runner to a
  quarter; and the fold runs **exactly once per ply**, guarded by
  `RunnerMemory.turn`, because folding one turn twice advances every ghost two
  ranks too far. See
  `_spec/apps/starchess/core/adjutant/strategic/promotion-defense.puml`.
- **Adjutant CC retaliation**: firing on a Command Center reveals the shooter,
  so the strategic script takes that unit however possible — `AVENGE_CC_SHOT`
  9_000, under `CC_SAFETY` but over the promotion race, the check weights and
  `BATTLESHIP_ESCAPE`, with `AVENGE_THRIFT` picking *with what* and never *whether*.
  It is **capture-only** by design: no chase term and no positional pull, so a
  wanted square we cannot strike never warps the plan. The record
  (`ai/strategic/attackers.ts`) is a fact with an expiry — a point, not a
  posterior — pruned when the square is lit and empty and aged out after
  `ATTACKER_MEMORY_TURNS`. A shooter still *delivering* check is survival's
  business, not this concern's. See
  `_spec/apps/starchess/core/adjutant/strategic/cc-retaliation.puml`.
- **Adjutant weights**: the scoring strategies are *summed*, so what decides a
  move is the tier ordering, not the magnitudes. Assert an ordering claim in
  `__tests__/tactics/weightOrdering.test.ts` — never in a comment beside the
  constant, where a retune silently inverts it. Name every weight (no bare
  numbers in a scoring expression). Roster and enforced orderings:
  `_spec/apps/starchess/core/adjutant/weight-ladder.puml`.
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
