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

## Cue clock sync (`syncToClock`)

The timeline's wall-clock pace is authoritative — multiplayer clients advance in
lockstep — so a cue's slot never stretches for a slow device. A CSS animation,
though, starts only once the browser has styled the new cue; under load that
first frame ate ~40% of a 500ms death slot and the cue unmounted mid-shatter.
`presentation/animations/clockSync.ts` (`syncToClock(el)`, a ref on each death /
attack / gas-drop cue root) fast-forwards the cue's animations to the time since
mount for its first two frames: a late cue drops its opening and still lands its
ending on time. Never fix a cut animation by making the timeline wait. The
detector is `apps/e2e/tests/vfx/vfx-fps-throttle.spec.ts`. The largest seek per cue is also the
menu CPU probe's signal (`onClockLag` → `vfxProbe.ts`, see `vfx-tier.puml`).

## Lite-tier death burst (`DeathAnimation.module.css`, `Shard lite`)

On the lite VFX tier each unit keeps **four art-picked parts** (`<Shard lite>`,
`data-shard-lite`) on their full-tier flight; every other shard's animation is
dropped and rides one `liteBurst` of the unit's svg instead of ~12 tracks of
its own. Every part stays drawn — a hidden shard is a hole. Pick the lite parts
that read as the unit (Tank keeps a
separate four in tank and siege mode). `liteBurst` holds full opacity to 30%
(through the boom flash) before an `ease-in` fade to `scale(1.08)`, so the four
flyers inside it stay readable for their whole flight. Booms and the Command
Center rubble keep their full-tier look. Tier selection itself: `vfx-tier.puml`.

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

## Auto-End must not dispatch from a reactive effect

`endTurnAfterQueue` (fog + specials lessons) ends the turn for the player.
It must submit the way the End **button** does — deferred to a task, not
dispatched inline from the `createEffect` that detects the queue threshold.

Submitting inside the effect's batch lands the timeline's coalesced
`TIMELINE_COMMIT` patches *after* `TIMELINE_DONE`. The reducer clears
`timeline.cues` on DONE, so every later commit carries `playingIds` that match
nothing: `useCombatOverlays.moveCues` returns empty for the whole resolve and
`MoveAnimation` never renders. The board still commits each placement, so
pieces appear to teleport — observed on `/tutorial/fog/bishop` as
`d4 → g7 → e5 → gone` with an empty overlay root.

Attack / KingDamage looked fine because they arrive on the *second* timeline
(turn-open checks), which races nothing.

Guard: `BaseScreen.endTurnLikeAClick`. See `timeline-commit-batching.mmd` for
the gate this interacts with.
