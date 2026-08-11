# StarChess animation pipeline

Solid presentation clock: **core resolve** produces an `EndScTurnResult`;
`playTimeline` compiles typed cues and drives the MatchStore via `TIMELINE_*`
actions. Components select timeline fields and render overlays — they do not
own the clock.

```
starchess-core endScTurn → EndScTurnResult
  → playTimeline (timelinePlayer.ts)
      schedules cues with Scheduler + runId guards
  → MatchStore dispatch:
      TIMELINE_START  (cues + placement)
      TIMELINE_COMMIT (placement / lives / mines / hide / progress …)
      TIMELINE_DONE
  → selectors + createMemo
  → AnimationStage / StarChessBoard / combat overlays
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

## Key sources

| Piece | Path |
|---|---|
| Timeline player | `apps/starchess/src/presentation/timeline/timelinePlayer.ts` |
| Match actions | `apps/starchess/src/types/match.ts` (`TIMELINE_*`) |
| Reducer | `apps/starchess/src/app/matchReducer.ts` |
| Store wiring | `apps/starchess/src/app/MatchStoreContext.tsx` |
| Visual frame | `apps/starchess/src/presentation/animations/visualFrame.ts` |
| Impact timing | `apps/starchess/src/presentation/animations/impactTiming.ts` |
