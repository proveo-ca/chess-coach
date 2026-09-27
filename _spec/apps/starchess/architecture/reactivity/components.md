# Reactivity — components, stores, hooks, probe

Per-site rationale for the rules in `../reactivity.md` (R1–R8). Code carries
only its `// SPEC:` pointer; the why lives here. Paths are under
`apps/starchess/src/`.

## `debug/reactivityProbe.ts` — the probe

- **What:** dev-only count of how many computations re-run per interaction,
  grouped by the source line that created them.
- **Enable:** `?debug=reactivity`, dev build only (`DEV` is undefined in prod,
  so `initReactivityProbe` is a no-op there).
- **Console API** (`window.__reactivity`):
  - `reset()` — clear both tallies; do this, then interact.
  - `top(n = 25)` — re-runs per creation site since the last reset.
  - `created(n = 25)` — computations created since the last reset (remount
    churn; ~0 for an interaction that mounts nothing).
  - `totals()` — `{ runs, created }` sums.
- **Mechanics:** Solid's `DEV.hooks.afterCreateOwner` fires for every owner;
  computations (memos, effects, render effects) carry `fn`, which is wrapped to
  count runs. Owners without `fn` (roots) are skipped. The creation site is the
  first `/src/` frame of the creating stack, skipping the probe's own frames;
  no such frame → `(framework)`. Sites are lines of Vite's *transformed*
  module (see `../reactivity.md` for how to map them back).

## `main.tsx`

- `initReactivityProbe()` runs **before `render()`**: the hook only sees owners
  created after it is installed, so a later call would miss every computation
  of the first mount.

## `components/atoms/CoachAvatar.tsx`

- `pinned` memo — the ambient `setInterval` callback has no owner. Hosts pass
  `emotion` / `sleeping` as expressions (R2), so a raw `props.*` read from the
  interval would build an unowned memo every tick. The memo is created in the
  component body and the interval reads it.
- `emotion` memo — read twice in the root's attributes, and hosts pass
  `emotion` as a conditional; one memo instead of a memo per read.

## `components/features/AchievementBubbles.tsx`

- `box` memo per bubble — four props of `AchievementBubbleLife` read the box;
  compute `squareBoxStyle` once per board resize.

## `components/features/AchievementCard.tsx`

- `row` memo — read by tint, icon, title and description; one catalog lookup
  per level change.
- `METER_STEPS` module constant — a literal `[1…5]` in `<For each>` is a fresh
  array per render (R4).

## `components/features/AchievementsModal.tsx`

- `career` memo — one `careerAchievementLevels()` for the whole grid; each call
  parses localStorage and scans match history. Passed into `unlockedLevel`.
- `level` memo per card — the card reads `level` several times; scan the unlock
  file once.
- `onOpen` memo hoisted out of the JSX — a conditional `onOpen={…? … : …}` would
  build a memo on every read by the card (R2).

## `components/features/NewAchievementsModal.tsx`

- `row` is a plain value, not an accessor — the `earned` item's fields are plain
  values, so one lookup at item creation suffices, not one per read.

## `components/features/SideRailTools.tsx`

- Reads `store.shell().<field>` (phase, viewer, playerColor, arenaPlayers), never
  `store.state()`: `state()` would wake these on every dispatch and timeline
  commit (R1).

## `components/features/TutorialGuideBubble.tsx`

- `variant` / `counting` memos — hosts pass these props as conditionals (a memo
  per read, R2) and each is read 2–3 times in the bubble.

## `components/features/TutorialHudLabels.tsx`

- `enabled` memo in the component body — the host passes an expression, and a
  raw `props.enabled` read from the rAF / MutationObserver callbacks (no owner)
  would build an unowned memo each time.
- The observer lives inside a `createEffect` gated on `enabled()`, not in
  `onMount`: watch the DOM only while labels are wanted, since every mutation of
  the game (VFX included) schedules a layout read.

## `hooks/useMatchHistoryFilters.ts`

- `NO_GAMES` — shared empty page; a fresh `[]` from `visibleGames` would
  re-notify every reader (R4).

## `store/achievementStore.ts`

- `unlockedLevel(shortId, career?)` — `career` defaults to a fresh
  `careerAchievementLevels()` read (localStorage + history scan); a gallery
  rendering every family passes one shared value instead (see
  `AchievementsModal`).

## `store/createPersistedStore.ts`

- `written` — the last blob on disk. The mirror effect skips when the new JSON
  equals it, which drops the boot-time write-back of what was just read and
  every no-op write. Matters because the match-history blob is megabytes.

## Tests

- `__tests__/shellFields.test.ts` — `createShellFields` (one signal per shell
  field): a reader wakes only when a field it read changes; optional fields
  absent at first read are still tracked; the reducer's immutable values are
  kept; the view spreads to a plain snapshot and refuses writes.
- `__tests__/matchStore/matchStoreDualSignal.test.ts` — a timeline commit keeps
  `store.shell()` identity (and every shell field) while `timeline()` changes.
