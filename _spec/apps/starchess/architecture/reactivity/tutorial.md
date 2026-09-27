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

## `tutorial/narrationSlot.ts`

- **One reader, one writer, no sync effect (R7).** `TutorialScreen` owns a
  `createNarrationSlot()`; the mounted host hands it a narration *accessor*
  once (`onNarration`), and the slot's memo reads through it. The module-global
  signal it replaced had three writers (`useLessonNarration`,
  `TutorialReviewHost`, a dead `ReviewDemoScreen` branch) each copying into it
  from an effect, so the screen judged the objective one pass late and the
  last writer won.
- **Narration is tagged with its lesson.** Hosts put the `lessonKey`
  (`story#epoch`) their board belongs to on the narration; `TutorialScreen`
  reads it through a memo that drops narration from any other lesson. On an
  in-app lesson change (section navs, Next) the route updates before the host
  re-seeds or remounts, so for one pass the slot still carries the previous
  lesson's board: the line fold baselined the old SCFEN, read the re-seed as a
  player move and retired the opening line unread (specials marine…ship,
  resolve combat-chain / king-hunt), and the objective judge could match the new
  lesson's gates against the old board. Pinned by the in-app walk in
  `__tests__/tutorial/lessonIntroAndFailure.test.tsx`.
- **Release is conditional**: a host's cleanup silences the slot only if it is
  still the current source — a keyed remount mounts the next host before the
  old one's cleanup runs.
- **`equals: sameStructure`** on the slot memo and on each host's narration
  memo: hosts rebuild the object on every board change (a unit select
  included), and three `TutorialScreen` effects read the whole value — an
  identical rebuild must not wake them.
- **`useLessonNarration`** derives the narration as a memo; the BattleShip
  watch is a memo fold (`prev` → `nextBattleShipWatch`), not a mutable `let`
  inside an effect.
- **`TutorialReviewHost`** reports `timelineActive || busy()`: the typewriter
  awaits resolve VFX while `busy`, so `completeWhen` waits for the Turn 3 end.

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

- **Queue cancel hint is context, not a global.** The host provides
  `createMemo(() => interactive() ? hintMarks().cancelQueued : null)` through
  `QueueHintProvider` around `BaseScreen`; `TurnBar` / `TurnBarSidebar` read
  `useQueueHint()` (default `null`). It replaced a module signal the host wrote
  from an effect and cleared on cleanup (R7).

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
  `createComputed(on(lessonKey))` → `store.loadLesson({ scfen, stored, gas })`,
  one store command that batches `cancelEffects()`, `LOAD_SCFEN` (the same
  `seedFromSnap` a fresh store uses) and the Storybook gas override
  (`setViewerGas`, read through `peek()`, not the host's `store.state()`).
  Measured: advance frame ~150ms at 20×, ~300 computations created, and the
  `[data-board-grid]` element survives the advance.
- **`createComputed`, not `createEffect`.** It runs in the pure phase, before
  render effects, so the store is already re-seeded when the new lesson's
  choreography mounts and dispatches its opening steps. This is the one
  accepted dispatch-from-computation: deferring it (effect, task) lets the new
  choreography dispatch onto the old board. The graph review flagged it; the
  ordering requirement keeps it.
- **`LessonScope`** — the lesson-scoped hooks (choreography, forced tank mode,
  narration) live in a DOM-free child keyed by `createMemo(on(lessonKey))`.
  Remounting it is cheap; it hands its `ChoreographyResult` up through a
  signal (`interactive` gating reads it), and resets it to `{}` on cleanup.
- **Folds keyed on the board's lesson** — `ccSeen` / `alertLatch` fold from
  their previous value and restart when the key changes, which is what a
  remount did. The key is the host's `boardKey`, not the route's `lessonKey`:
  the host bumps it in the same batch as `loadLesson`, so a fold never pairs the
  new lesson's key with the previous lesson's board. Keyed on the route, winning
  attack-3 (enemy CC seen on d5) and advancing opened attack-4 with a d5 ring —
  the fold read attack-3's board under attack-4's key and latched d5 as a
  sighting. `LessonScope` (choreography, narration tag) keys on `boardKey` too.
  Pinned by `__tests__/tutorial/lessonAdvanceBoardKey.test.tsx`. `alertLatch`
  restarts empty; `ccSeen` restarts on the enemy CC's home square
  (`emptyCCIntel(enemy).focus`), so an unseen CC rings its default location.
- **`autoArmTimer` is an accessor** (`() => props.armTimer ?? board.armTimer`)
  because lessons in one section disagree (several set `armTimer: false`).
  The store re-arms after a reset itself (`LOAD_SCFEN` → `armWhenIdle`, one task
  later, outside any effect); turn-open checks still only run through
  `armTimer`.

## `screens/TutorialScreen.tsx` — objective, line, coach

- **The line is a memo fold, not an effect.** `lineState` folds
  `(narration, lesson key, holdTick)` over its previous value
  (`holdTutorialLine` hold + the shown comment, when it landed, its hold);
  `line` is a memo over it. The ending handoff reads `line()` and so always
  sees the line the completing board produced — a memo is brought up to date
  on read, whatever order effects were created in. It replaced an effect that
  wrote `line` and an ending effect that was only correct because it was
  *created after* it.
- **Reading budget.** Time the closing line has already been on screen counts
  toward its hold (`performance.now() - shownAt`), so only a line that lands
  with the objective waits the full `lessonEndMessageMs`; a mid-lesson line the
  player has been reading doesn't re-charge.
- **Hold timer** — the only side effect left from the fold: an effect arms one
  `schedule(waitMs)` from `lineState().waitMs`, which bumps `holdTick`.
- **Coach state has one writer.** The lesson-key reset and the hide / leave /
  reveal logic are one effect keyed on `section|story|epoch`; two effects used
  to write `coachState` on the same lesson change.
- **The objective judge reads `outcome` untracked**: it is the only writer of
  `"active"` (on a key change), so tracking its own write only bought a no-op
  re-run.

