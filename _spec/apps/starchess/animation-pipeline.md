# StarChess animation pipeline

Solid presentation clock: **core resolve** produces an `EndScTurnResult`;
`playTimeline` compiles typed cues and drives the MatchStore via `TIMELINE_*`
actions. Components select timeline fields and render overlays — they do not
own the clock.

```
starchess-core endScTurn → EndScTurnResult
  → playTimeline (timelinePlayer.ts)
      schedules cues with Scheduler + runId guards
  → TimelineCommitGate (binder; coalesce same-turn onCommit)
  → MatchStore dispatch (dual-signal shell ∥ timeline):
      TIMELINE_START  (cues + placement)
      TIMELINE_COMMIT (placement / lives / mines / hide / progress …)
      TIMELINE_DONE
  → readDisplayedSnapshot + useCombatOverlays
  → AnimationStage / StarChessBoard / CombatOverlayRoot
```

Authoritative `liveSnapshot` is not rewritten mid-playback for intermediate
frames. Commits patch timeline presentation state until `TIMELINE_DONE`.
Terminal DualNav review keeps `phase: gameOver` and replays via the same
timeline path (`REVIEW_PLAY` → `playTimeline`).

## Square ownership (`deriveVisualFrame`)

Prefer deriving from clip phases in a selector (not a parallel hide map):

Priority (first claim wins):

1. **death** — `at`
2. **deploy** — `at`
3. **move** / **jump** — `from` (+ on-board `to`)
4. **attack** — `from`, unless source suppressed / death owns square
5. **kingDamage** — `at` if free
6. **static** — board glyph

## Impact meeting point (`impactMsFor`)

Kill→death meeting point is per `AttackAnimKind` (`impactTiming.ts`). Timeline
commits apply impact so death and hull suppression land together. Phase-1 waves
use max batch impact so victims sync.

## Scheduler role

Thin adapter only: `delay(ms, () => …)` with `runId` checks before commit/done.
No direct board writes from timers — only MatchStore dispatches.

## Commit gate (shipped)

Binder-internal coalesce between `playTimeline` callbacks and `dispatch`:

- Merge same-turn `onCommit` patches (last-write-wins per field).
- Flush via **`scheduler.delay(0)`** (not rAF).
- **Always flush synchronously** before `onDone`, next `onStart`, or cancel.
- Source: `presentation/timeline/timelineCommitGate.ts`.

## Perf status (2026-08-11)

| Phase | Lever | Status | Trace note |
| --- | --- | --- | --- |
| **Commit path** | Gate + structural share | **Shipped** | player FC 609→162ms |
| **Dual-signal** | `shell()` ∥ `timeline()` | **Shipped** | HUD skips progress-only ticks |
| **Light paint/GPU** | DPR, contain layout style, will-change active, trail caps | **Shipped** | paint max 7.5→1.1ms; DroppedFrame **not** fixed |
| **VFX density** | Paint-property audit, board phase ring, review caps (`capForDensity`) | **Shipped + measured (`…105537`)** | DroppedFrame **330 (8% of baseline) — met**; GPU main busy 8.3s (was ~39s) |

**Do not:** per-layer `Show`, component-owned clocks, change cue math / impact /
`deriveVisualFrame` priority, root `contain:paint` (clips trails), `transition` /
`@keyframes` on paint-only properties (outline-color, border-*-color, box-shadow).

Full design + shipped phase: [`architecture/timeline-perf.puml`](./architecture/timeline-perf.puml) ·
[`architecture/timeline-vfx-density.puml`](./architecture/timeline-vfx-density.puml).

## Key sources

| Piece | Path |
|---|---|
| Timeline player | `apps/starchess/src/presentation/timeline/timelinePlayer.ts` |
| Commit gate | `apps/starchess/src/presentation/timeline/timelineCommitGate.ts` |
| Match actions | `apps/starchess/src/types/match.ts` (`TIMELINE_*`) |
| Reducer + share | `apps/starchess/src/app/matchReducer.ts` · `timelineStructuralShare.ts` |
| Store (dual-signal) | `apps/starchess/src/app/MatchStoreContext.tsx` |
| Selectors | `apps/starchess/src/app/selectors.ts` |
| Visual frame | `apps/starchess/src/presentation/animations/visualFrame.ts` |
| Impact timing | `apps/starchess/src/presentation/animations/impactTiming.ts` |
| VFX caps / DPR | `apps/starchess/src/presentation/animations/vfxPerf.ts` |
| Combat root | `apps/starchess/src/presentation/animations/components/CombatOverlayRoot.tsx` |
| Perf HUD | `apps/starchess/src/debug/perfMonitor.ts` |
