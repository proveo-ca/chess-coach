# Reactivity — presentation layer

Per-site rationale for the rules in [`../reactivity.md`](../reactivity.md)
(R1–R8) as applied under `apps/starchess/src/presentation/`. Source files carry
only their `// SPEC:` pointer; the *why* of each memo, equality and batch lives
here. Paint-side rationale (opaque veil, under-veil movers) is in
[`../../board-rendering.puml`](../../board-rendering.puml); the lite-tier death
burst is in [`../../animation-pipeline.md`](../../animation-pipeline.md).

## `board/memoEquals.ts`

Value `equals` comparators for memos that rebuild a collection every run (R4).
A memo over `new Set(...)` is a new value each time, so every per-square reader
downstream re-runs even when the content is identical; these stop the wave at
the memo that rebuilt it.

| Symbol | Equality |
|---|---|
| `sameSet` | same members, order-free |
| `sameList` | same elements, same order (`Object.is`) |
| `sameFlat` | flat records: same own keys, each value `Object.is`; array values compared by element (`sameList`) |
| `sameMap` | same keys, values equal under `eq` (default: `Object.is` or `sameFlat`) |

## `board/components/StarChessBoard.tsx`

- **`NO_SQUARE_SET` / `NO_FOG`** — stable empties; a fresh `new Set()` per run
  defeats every downstream `===` (R4).
- **`squareSet` / `squareSetOf`** — fold a list (or Set-or-list) prop into a
  Set memo, value-equal (`sameSet`) so identical content wakes no square.
- **`placement` → `map`** — memo the placement *string* first: a new snapshot
  with the same placement (a select, a timeline commit elsewhere) must not
  rebuild the `placementToMap` every square reads.
- **`fog`** (`sameFog`) — the slide tick and every snapshot rebuild re-derive
  vision, but 64 squares × 2 memos read it; only a changed lit / revealed set
  may wake them.
- **Per-square folds** (`legalSet`, `hintSet`, `gasHintSet`, `checkSet`,
  `firstBySquare` → `ghostBySquare` / `canisterBySquare`) — every list prop is
  folded **once** into a Set / Map here and each square wraps its lookup in its
  own memo (R5). A select or hint change then re-runs only the squares whose
  answer changed, not all 64 render effects each scanning the arrays. All are
  value-equal (R4) because hosts rebuild these lists on unrelated dispatches.
- **Membership selectors** (`isSelectedSq`, `isLit`, `isRevealed`, `isHidden`,
  `isLegalSq`, `isHintSq`, `isGasHintSq`, `isCheckSq` via `createSelector`, R5)
  — on a change only the squares whose answer flipped wake: a select touches
  two squares plus the legal targets instead of re-running a memo on all 64.
- **per-square `piece`** — value-equal on `type` + `color`: a new snapshot
  rebuilds every `ScPiece`, but a square re-renders only when its own unit
  changed.
- **per-square `shownMine`** — the colour of the mine the square shows, or
  `undefined`; one memo feeds both the data attribute and the `<Show>`.

## `board/components/LiveStarChessBoard.tsx`

- **`NO_SQUARES` / `NO_SQUARE_SET` / `NO_IDS`** — stable empties (R4); a fresh
  `[]` per read defeats every downstream equality check.
- **`snap`** (`sameFlat`) — `displayedSnapshotFrom` spreads a new object on
  every shell / timeline change it reads; field-equal snapshots must not wake
  the board.
- **`veilMoveIds`** (`sameSet`) — see *under-veil movers* in
  `board-rendering.puml` for which movers are selected and why.
- **`ccDamage`** — a memo over its own previous value (`prev` threaded into
  `ccDamageCuesFromBoard`); it was an effect writing a signal (R7).
- **`selectedProp` / `legalDestsProp` / `squareClickProp`** — conditional
  props hoisted into memos (R2): `prop={a() ? b : c}` compiles to a getter that
  builds a fresh memo on **every** read, and the board reads these from each of
  its 64 square computations (this was the 768-memos-per-click site).

## `board/components/StaticScfenBoard.tsx`

- **`fog`** — hoisted (R2): the board reads `fog` from many computations.

## `board/hooks/useBoardInput.ts`

- **`pendingPromotion`** — reads `store.shell().pendingPromotion`, not
  `state()`, which wakes on every dispatch and commit (R1).
- **`onSquareClick` / `resolvePromotion`** — wrapped in `batch` (R6): a handler
  dispatches up to four times (select + dests, spend + queue + mark); batched,
  the board runs one pass instead of one per dispatch. Writes still land
  immediately inside the batch, so the mid-handler `store.state()` checks see
  them.

## `animations/components/AnimationStage.tsx`

- **`snap`** — memo: the board reads `snapshot` from many computations; a FEN
  host would otherwise re-parse (and hand out a new object) on every read.
- **`specialUsedSquares`** — memo: as a getter prop it rebuilt the Set on every
  overlay read.
- **`NO_HIDDEN`** — stable empty (R4).

## `animations/components/CombatOverlayRoot.tsx`

- **`hullCues`** (`sameList`) — overlay hulls minus the veil movers. Hoisted
  (R2): inline, the ternary built a memo and a fresh filtered array on every
  read of `cues`; value-equal so a frame rebuild with the same cue objects
  keeps the array identity.

## `animations/components/MoveAnimation.tsx`

- **`aimPose`** — one memo per mover (R2): `InlineHoverbike` reads `aimPose`
  four times, and the inline ternary built a memo + a fresh pose on each read.

## `animations/tankModeStore.ts`

- **`clearSiegedTanks`** — no-op when already clear; a fresh empty Map would
  wake every reader (R4). **`setTankMode`** likewise returns `prev` when the
  siege bit does not change.
- **`siegedTanksList`** — cached per `modes` value: callers pass the list as a
  prop, so a fresh array per read defeats equality.

## `combat/hooks/useCombatOverlays.ts`

- **`stablePlaying<…>()` instances** — created per hook, not per module: two
  boards (live + review, Storybook grids) used to share one id-keyed cache and
  hand each other's cue objects back.
- **`hideSquares` memo** — value-equal (`sameSet`, R4).

## `combat/hooks/useIntentOverlays.ts`

- **`useBoardVision`** — value-equal (`sameFlat`, R4).

## `hud/components/BoardSideRail.tsx` · `hud/components/MatchBoardHost.tsx`

- **`controlsVisible ?? "controls" in props`** / **`"children" in props`** —
  presence tested with `in`, not `props.x != null`: reading the getter renders
  the JSX an extra time just to test presence (R3).

## `hud/components/DeployModal.tsx`

- **per-unit `affordable`** — memo: read by both `class` and `disabled`, and
  `deployedMaterial` parses the placement.

## `hud/components/GasRack.tsx`

- **`gas`** — memo: every slot, label and count reads it; they wake only when
  the number moves.
- **`reserveCount`** — memo: each reserve slot's render effect reads it; a
  resolve re-ran them per commit.
- **`finishCancel`, return-to-dock, pointer down / move / up** — `batch` (R6):
  position + hover (and drag + hover clears) land in one pass per pointer
  event.

## `hud/components/ResourceBar.tsx`

- **`stored`** — calls `displayedStoredMaterial(ctx, …)`, which
  reads only the shell fields it needs; the old `ctx.state()` touches
  subscribed the memo to every dispatch and commit (R1).

## `hud/components/TurnBar.tsx` · `hud/components/TurnBarSidebar.tsx`

Both share the 200ms deadline timer, so the same sites apply:

- **`resolveOnEnd` / `onTimeout`** (and `reviewing` in the sidebar) — props the
  timer reads go through memos made in the component body: the interval has no
  owner, so a conditional prop getter read there builds an orphan memo per tick
  (R2).
- **timeout handler** — clear deadline + submit + host callback in one `batch`
  (R6).
- **`seconds`** — memo: read by three props per 200ms tick; the ring
  re-renders only when the value moves.
- **`displayedTurn`** — turn scalar memo: `readDisplayedSnapshot` spreads a new
  snapshot on every call.
- **`sideQueue`** — memo: the readers below (four in `TurnBar`, three in the
  sidebar) each re-filtered and re-sorted the queue.
- **`chipDirection`** (`TurnBar`) — hoisted (R2): every queue chip reads it.

## `timeline/timelineCommitGate.ts`

- **`onStart`** — pending-commit flush + `TIMELINE_START` in one `batch` (R6),
  one graph pass.
- **`bindTimeline` `onDone`** — `gate.flush()` + host `onDone` batched likewise.

## `StarChessBoard.tsx` — clickability lives on the grid (R2/R5)

Each square used to render `role={props.onSquareClick ? "button" : undefined}`.
Solid folds every dynamic attribute of an element into one render effect, so
that read subscribed all 64 square effects to interactivity — which flips at
the start and end of every resolve (≈130 square re-renders per move). Squares
are now always `role="button"`; the grid alone carries `data-interactive` and
`aria-disabled`. The `onClick` stays per square: Solid delegates it and it
reads the handler only at click time.

## `MoveAnimation.tsx` — the Command Center slides on the compositor

The Command Center was the one mover left on `MoveAnimation`'s fallback
branch: `squareBoxStyle(sq())` jumped its `left`/`top` from origin to
destination when `progress` flipped, and `.mover`'s
`transition: left, top` animated that — a layout property, so every frame of
the slide needed the main thread. Under load (20× CPU) the CC visibly
stuttered while every other unit, on `humanoidSlide` (`translate`), kept
gliding on the compositor. The fallback now uses `slideMoverStyle` + the
shared `.moverSlide` class (the same `humanoidSlide` keyframes, started on the
same `started()` kick as Tank / Mecha / BattleShip). `data-square` still
reports `from → to` for the VFX harness.

Left as-is: `.ccDamageSlot` keeps its `left`/`top` transition — it moves a
*parked* CC's fire overlay on placement commits and review seeks; during a CC
move `visibleCCDamage` drops that slot and the mover carries the fire.

## `fogProjection.ts` `mapWithMovePathOccupancy` — a mover never displaces a unit it passes over

Progressive path fog places each sliding unit on the square it is crossing
at that tick. It used to `set` that square unconditionally, so a unit
passing *over* an occupied square deleted the occupant from the vision map.
In `live-play-attack-1` the enemy Hoverbike's L (b8 → c8 → **d8** → d7)
elbows over the player's BattleShip on d8: for ~100ms the BattleShip was
gone, its vision with it, and b8 / c8 / c7 / d7 / d8 flashed dark. A mover
now only claims an empty mid-square (or its own destination); while another
unit holds the square it is crossing, the mover keeps its previous square for
vision. Pinned by `__tests__/fogProjection.test.ts` ("never displaces a unit
the mover passes over"), which walks that exact path tick by tick.

## Timers (R9)

- `GasRack` `GAS_RETURN_MS` (240) = `.ghostReturning` `left`/`top` transition
  (220ms, `GasRack.module.css`) + 20ms slack; the cancel lives in a plain
  `schedule` because the drop handler, not an owner, arms it. Retune both together.
- `TurnBar` / `TurnBarSidebar` `TURN_DEADLINE_TICK_MS` (200) is the 200ms
  deadline poll above, now a mount-owned `createRepeat`.
- `CoachAvatar` helm uses `schedule` + a kept cancel: the drop arms inside a
  nested `requestAnimationFrame`, which has no owner, so `createDelay` would
  not register its cleanup there.
- `useAutoDeploy` keys `schedule` cancels by cue id: a pending deploy must
  survive the occupancy effect's re-runs.
- `ccDamageOverlay` boom and `MoveAnimation` settle use `createDelay` inside
  their effect: every re-run ends the pending phase anyway, so the run-scoped
  cancel is exact.
