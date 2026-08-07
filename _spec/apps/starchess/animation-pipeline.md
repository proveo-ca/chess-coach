# StarChess animation pipeline

Solid + Flux: the presentation clock **dispatches**; a pure **reducer** owns frames; components only **select and render**.

```
core resolve (starchess-core endScTurn)
  → compileAnimationPlan (typed clips + absolute ms)
  → dispatch ANIMATION_* actions
  → animationReducer → PresentationFrame
  → Solid selectors (createMemo)
  → AnimationStage / ObserverStarChessBoard
```

Authoritative `liveSnapshot` does not mutate mid-playback. Intermediate placement/lives/mines live on the presentation frame until `ANIMATION_DONE`.

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

Kill→death meeting point is per `AttackAnimKind` (`impactTiming.ts`). The reducer applies impact as one action so death and hull suppression land in the same frame. Phase-1 waves use max batch impact so victims sync.

## Scheduler role

Thin adapter only: `delay(ms, () => dispatch({ type, runId, ... }))`. Every callback checks `runId` before reducing. No direct board writes from timers.
