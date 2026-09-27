# Reactivity: tutorial hosts, narration, choreography

Per-site rationale for the rules in `../reactivity.md` (R1–R8), applied to the
lesson hosts (`apps/starchess/src/demos/**`) and the tutorial bridge
(`apps/starchess/src/tutorial/**`). Code carries only its `// SPEC:` pointer.

## `tutorial/sameStructure.ts`

- **`sameStructure`** — deep value equality for the tutorial's rebuilt plain
  data (R4): hint marks, narration covers / trajectories / queue. Each is
  recomputed from the SCFEN as fresh arrays and objects, so identity says
  "changed" on every run; passed as `equals`, it lets a memo or signal hold
  its old value when the content is the same. Plain arrays and records only —
  no `Map` / `Set` / class instances.

## `tutorial/useLessonNarration.ts`

- **`LessonBoard`** — the live board as the tutorial reads it; one instance is
  shared by narration (`useLessonNarration`) and the hint marks in
  `LiveLessonHost`, so both read the same memos.
- **`createLessonBoard`** — per-field memos over shell + timeline (R1). A unit
  select changes neither the SCFEN nor the phase, so nothing here re-runs on
  it; reading `store.state()` re-ran all of it, and the tactics scans with it,
  on every dispatch.
  - `covers` / `trajectories`: the tactics scans are pure in
    `(scfen, viewer)`; `sameStructure` keeps an identical rescan from reading
    as a change downstream.
  - `queue`: rebuilt from the live queue on every run, so the same actions
    must compare equal (`sameStructure`).

## `tutorial/tutorialNarrationStore.ts`

- **`tutorialNarration` signal** uses `equals: sameStructure`: hosts publish a
  rebuilt object on every board change (a unit select included), and three
  `TutorialScreen` effects read the whole value — an identical publish must
  not wake them.

## `demos/LiveLessonHost.tsx`

- **`useForcedTankMode`** — reads shell fields only (`placement`,
  `siegedCount`) (R1): a unit select must not re-force every rook.
- **`NO_SQUARES` / `NO_ARROWS`** — shared empties (R4): a fresh `[]` per run
  would fail every `===` downstream.
- **`hintMarks`** — reads the per-field `LessonBoard` memos, not
  `store.state()` (R1), and holds its value on identical content (R4,
  `sameStructure`): `resolveTutorialHint` rebuilds every array on each call.
- **`hintSquares` / `hintGasSquares` / `hintArrows` / `endTurnAfterQueue`** —
  hoisted memos: a ternary prop builds a memo per read (R2).
- **`ccSight`** — where the enemy Command Center stands and whether we see
  it. Only the `king` / `cc` alert latches ask, and only a new SCFEN can
  change the answer. The `try` guards a mid-animation placement, which can be
  unreadable for a frame (answer: not visible).
- **`ccSeen` / `alertLatch`** — folds, not effects (R7): each is its previous
  value advanced by the new sighting. An effect writing a signal here ran one
  extra pass per change.
- **`autoQueueOpponent`** — static per lesson; hoisted so the prop is not a
  conditional getter (R2).

## `demos/ReviewDemoScreen.tsx`

- **`snap` / `timelineActive` / `reviewIndex`** — shell + timeline, not
  `store.state()` (R1): every memo below them used to wake on every dispatch
  and every timeline commit of a resolve replay.
- **`reviewNavDisabled`** — one memo, not a fresh object per read; each nav
  reads it twice (R4). Equality is field-wise on `back` / `forward`.
- **`header`** — the header getter is read once (R3): `Show when` plus its
  child built it twice.

## `demos/TutorialReviewHost.tsx`

- **`NO_ARROWS`** — shared empty (R4): a fresh `[]` per run would fail the
  board's `===`.
- **`snap` / `scfen` / `timelineActive`** — shell + timeline, not
  `store.state()` (R1), which also woke on fields the board never draws.
- **`sidebarReview`** — one object per change, not one per `props.review`
  read.
- **`props.footerExtra`** — read once (R3); a `Show` on it built the element
  twice.

## `demos/choreography/defineChoreography.ts`

- **Step dispatch** — the spend and every queued action run inside one
  `batch` (R6), so they cost one propagation; `submitTurn` stays outside so it
  reads a settled graph.
- **`createStepGate`** — the guard's inputs (`phase`, `checksApplied`,
  `timelineActive`, `liveSnapshot`) as their own memos (R1): `store.state()`
  woke every step on every dispatch — a unit select, each timeline commit — to
  re-test a guard that only a phase, turn-open or live-snapshot change can
  flip.

## `demos/choreography/useKingHuntGraduation.tsx`

- **`enemyDown`** — a boolean memo over shell fields (R1): the offer effect
  wakes when the answer flips, not on every dispatch and timeline commit.
  Behaviour (offer on every run, `cleared` gates only the menu) is in
  `_spec/apps/starchess/tutorial/hints-and-coach.md` §9.

## `demos/LiveLessonHost.tsx` — board stays mounted across lessons (R8)

- **One store per section, reset in place.** A lesson advance or retry used to
  remount the whole host (store, `BaseScreen`, board, HUD): ~3,800 computations
  created and a ~265ms frame at 20× CPU. Now `TutorialScreen` passes
  `lessonKey` (`story#retryEpoch`) and the host re-seeds its store instead:
  `createComputed(on(lessonKey))` → `cancelEffects()` then `LOAD_SCFEN` (the
  same `seedFromSnap` a fresh store uses), plus the Storybook gas override.
  Measured: advance frame ~150ms at 20×, ~300 computations created, and the
  `[data-board-grid]` element survives the advance.
- **`createComputed`, not `createEffect`.** It runs in the pure phase, before
  render effects, so the store is already re-seeded when the new lesson's
  choreography mounts and dispatches its opening steps.
- **`LessonScope`** — the lesson-scoped hooks (choreography, forced tank mode,
  narration) live in a DOM-free child keyed by `createMemo(on(lessonKey))`.
  Remounting it is cheap; it hands its `ChoreographyResult` up through a
  signal (`interactive` gating reads it), and resets it to `{}` on cleanup.
- **Folds keyed on the lesson** — `ccSeen` / `alertLatch` fold from their
  previous value; the fold now carries the `lessonKey` it belongs to and
  restarts from empty when the key changes, which is what a remount did.
- **`autoArmTimer` is an accessor** (`() => props.armTimer ?? board.armTimer`)
  because lessons in one section disagree (several set `armTimer: false`).
  `BaseScreen`'s arm effect reacts to `liveSnapshot`, so it re-arms itself
  after a reset; turn-open checks still only run through `armTimer`.
