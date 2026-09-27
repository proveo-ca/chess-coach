# Reactivity — match store, BaseScreen, screens

Per-site rationale for `apps/starchess/src/app/**` and `apps/starchess/src/screens/**`.
Rules R1–R8 are defined in `../reactivity.md`; store topology is in `../../match-store.puml`.

## app/shellFields.ts

- **`createShellFields`** — the match shell is one signal **per top-level field**.
  It used to be a single signal, so every dispatch (selecting a unit, each
  timeline commit) woke every `store.shell().x` reader in the app, the 64 board
  squares included: at 20× CPU that was **300–450ms frames**. Now a reader
  subscribes to exactly the fields it reads, and a dispatch wakes only readers
  of fields whose value changed (`Object.is`).
- **Top-level only, on purpose.** Field values stay the reducer's immutable
  objects; a deep store would mutate history snapshots in place.
- **`view`** is a stable, read-only Proxy — each property read tracks that field
  alone. Writes / deletes through it throw (dispatch an action instead).
  **`read()`** is the current plain object, untracked — the reducer's input.
  **`write(next)`** replaces the snapshot and notifies only changed fields.
- **`field(key)`** signals are created lazily on first read, so an optional
  field that is absent today still tracks when it appears later.

## app/MatchStoreContext.tsx

- **`shell`** returns `shellFields.view` — per-field shell (above).
- **`peek()`** — untracked plain state for the store's own runners
  (`armTimer`, `ensureTurnOpenChecks`, `submitTurn`, review runners…). Those are
  called from screen effects; reading `state()` there would subscribe the
  calling effect to every field and every timeline commit (R1).
- **`dispatch`** reads its input through `peek()` — plain and untracked, so the
  reducer never sees the reactive view. The shell write and the timeline set
  run in one `batch`.
- **Displayed-snapshot memo** — built in its own `createRoot`, so a store made
  outside a component (tests, stories) still has an owner; when there *is* a
  creating owner, the root is disposed with it (`onCleanup`).

## app/selectors.ts

- **`displayedByStore` / `registerDisplayedSnapshot`** — one value-equal
  (`sameFlat`) displayed-snapshot memo per store, registered by
  `createMatchStore`. `displayedSnapshotFrom` spreads a fresh object and reads
  the whole `timeline()` signal, so without it every reader re-ran on every
  timeline commit even when nothing it shows had moved (R4).
- **`readDisplayedSnapshot`** — reactive read of shell + timeline via that memo;
  hand-built stores (tests) that never registered one fall back to a direct
  `displayedSnapshotFrom` fold.

## app/BaseScreen.tsx

- **`Slot`** — mounts a JSX-valued prop once and tests the *rendered* result for
  presence. `<Show when={props.x}>{props.x}</Show>` runs the getter twice — two
  fresh subtrees, one discarded (R3); `children()` resolves it a single time.
  Used for `guideBubble` and `header`.
- **`props.footerExtra`** is rendered bare, not under `<Show when>`, for the same
  reason (R3).
- **`NO_SQUARES` / `specialTargetSquares`** — a shared empty; a fresh `[]` per
  run would re-key the special-target `<For>` (R4).
- **`resolvePromotion`** — clear + queue (+ mark) is one user action, one graph
  pass (R6).
- **`commitSpecialTarget`** — a board-click special commits queue then mark in
  one pass (R6).
- **`cancelArmed`** — cancels the spawn arm and posts the "canister returned"
  reject: two stores, one pass (R6).
- **Auto-queue effect** — the script call runs under `untrack`: the script reads
  the store freely (e.g. `storedFor`), and those reads must not subscribe the
  effect to the whole state (R1).
- **Auto-End (`store.submitTurnNextTask`)** — tutorial Auto-End submits one task
  after the queue-ready effect (`scheduler.delay(0)`, R9), never inside the
  effect: SUBMIT_TURN starts the resolve timeline, and inside the effect's batch
  the timeline's coalesced TIMELINE_COMMIT patches land after TIMELINE_DONE — the
  cues clear before any `playingIds` reach the overlays, so the move VFX never
  renders and pieces teleport. The pending task is **store-owned**, not
  BaseScreen-owned: BaseScreen outlives a lesson change (the host only reloads
  its store), so a BaseScreen-owned task armed before a retry ended the fresh
  board's first turn. `cancelEffects` (every `LOAD_SCFEN` path) and store
  disposal drop it; a store tick does not. Found by the Quint model's
  `unguardedAutoEnd` switch — `_spec/apps/starchess/models/tutorial-lesson.puml`.
- **`autoQueueOpponent` (LiveLessonHost)** — a memo over `props.board.opponent`,
  not a constant read at host creation: the live-play section keeps one host
  across stories (only `lessonKey` changes), so a constant froze the first
  lesson's opponent — walking defense-1 → attack-3/4 left the adjutant inert,
  and attack-3 → defense-1 leaked one into a lesson without an opponent.
- **`bannerBack`** — hoisted because `MobileBanner` reads `onBack` from its click
  handler; a ternary prop there builds an ownerless memo per click (R2).
  `bannerResources` / `bannerTurn` hoisted likewise.
- **`coachEmotion`** — one read of the host's getter chain per change, not one
  per avatar read.
- **`overlay`** — hoisted: re-evaluated on every overlay resize / phase flip (R2).
  `liveHud`, `boardFog`, `dynamicGasDock` hoisted likewise.
- **`reviewNav`** — one object per change, because `TurnBarSidebar` reads
  `props.review` many times (R4). Gated on `ended` so live play never tracks
  the review fields.

## screens/MenuRoute.tsx

- **Arrival delay** — `createDelay(CHESS_MOCKUP_READ_MS)` in the component body:
  the Chess mockup stays readable for 480 ms, then the arrival plays. The
  component owner cancels it on unmount (R9).

## screens/menuSky/MenuArrival.tsx

- **Beat ladder** — `createDelay` per beat inside `createEffect(on(surface))`:
  a surface flip mid-arrival disposes the run and cancels every pending beat.
  It used to return `() => timers.forEach(clearTimeout)` from the `on` callback,
  which Solid keeps as the effect's value — never as a cleanup — so a
  chess → starchess → chess flip still fired the beats and `onArrived`.

## screens/menuSky/DebrisMarinePlayground.tsx

- **Loop pauses** — `sleep(ms, life.signal)`; unmount aborts `life`, which
  settles the pending pause so the loop reaches its `cancelled` check and exits
  instead of hanging on a promise nothing resolves.

## screens/MenuScreen.tsx

- **`tutorialAction` / `creditsAction`** — hoisted: `MenuTextItem` reads
  `onAction` from its click handler, where a ternary prop builds an ownerless
  memo per click (R2).

## screens/ReviewScreen.tsx

- **`ArenaLibrary` list load** — `onMount`, not `createEffect`: a one-shot fetch,
  not a derivation; nothing there should track (R7).
- **Export / import handlers** — the error/message signal pair (+ `navigate`)
  are written in one `batch` (R6).
- **`ReviewDetail` `matchTitle` / `achievements`** — built once, like `pack`:
  object props rebuilt per read defeat equality downstream (R4).

## screens/SingleScreen.tsx

- **Session-persist effect** — tracks only the persisted shell fields
  (`liveSnapshot`, `economies`, `playerColor`, `phase`); `state()` would also wake
  on every timeline commit and rewrite localStorage per animation frame (R1).
  The full state is then read `untrack(store.state)`.
- **Terminal-record effect** — gates on `shell().phase` alone; the full state is
  read once, untracked (R1).
- **`onAnotherGame`** — five signal writes + a navigate in one `batch`: one pass,
  one remount (R6). `onReplay` batches likewise.

## screens/TutorialScreen.tsx

- **`NEXT_LESSON_ACTION` / `RETRY_LESSON_ACTION`** — stable CTAs; a fresh
  `{ kind }` per read re-fires every `props.action` reader (R4). `bubbleAction`
  is a memo for the same reason.
- **`FogSection`** — the lesson id is read once, `untrack`ed: the caller's keyed
  `<Show>` remounts `FogSection` per lesson, so the id is fixed for its life.
  `boardHints` is hoisted: a ternary over a call builds a memo per read (R2),
  and `liveHints` returns a fresh array per call (R4). Ternaries over literals
  (e.g. `boardVariant`, `pieceSet`) compile flat and stay inline.
- **Skin-demo timer / `selectSkin`** — skin flip + hint release land in one
  `batch` (R6).
- **`lessonHints`** — per-mount hint memo: one array per outcome flip, not one
  per read (R4).
- **`headerEmotion`** — hoisted: a ternary prop builds a memo per read, and
  `CoachAvatar` reads it often (R2).
- **`bubbleVariant` / `bubbleAutoAdvanceMs` / `bubbleLineKey`** — hoisted
  bubble props: `TutorialGuideBubble` reads `lineKey` from its dismiss click,
  where a ternary prop builds an ownerless memo (R2); the other two are read
  from several of its memos.
- **`footerObjective`** — hoisted: a ternary prop builds a memo per read (R2).

## `screens/TutorialScreen.tsx` — section hosts, not per-lesson remounts

- `FogLesson` / `SpecialsLesson` / `LivePlayLesson` are components created
  inside `TutorialScreen`, one per `<Match>`: the `Switch` remounts only when
  the **section** changes (different chrome props). Within a section the
  lesson changes through reactive `board` / `beats` / `lessonKey` props — see
  `reactivity/tutorial.md` for how the host resets.
- `sectionBoard(stage)` / `sectionBeats(stage)` keep their previous value
  unless `section() === stage`: during a section switch a stale run would
  otherwise ask `lessonBoard(stage, storyIdOfOtherSection)`, which throws.
- The resolve section keeps its keyed `<Show>`: switching replay rebuilds the
  review timeline on purpose.
