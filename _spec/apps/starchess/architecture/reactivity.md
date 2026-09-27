# StarChess reactivity rules (Solid)

A click on one unit must wake roughly the computations whose answer changed —
two squares, the legal targets, the HUD line that names the selection. It used
to wake **1,434 computations and create 822 new ones** (fog tutorial, King
select), which at 20× CPU was a 300–450ms frame. Every rule below is a pattern
measured doing that.

Measure with the dev probe: open any route with `?debug=reactivity`, then in the
console `__reactivity.reset()`, interact, `__reactivity.top(20)` (re-runs per
creation site) and `__reactivity.created(20)` (computations created — should be
~0 for an interaction that mounts nothing). Sites are lines of Vite's
*transformed* module: `curl http://localhost:5175/starchess/src/<file>` and read
that line. Source: `apps/starchess/src/debug/reactivityProbe.ts`.

## R1 — `store.state()` subscribes to everything

`state()` spreads the whole shell plus the timeline, so a memo or effect that
calls it re-runs on **every** dispatch and every timeline commit. In reactive
scope read `store.shell().<field>` / `store.timeline()`; keep `state()` for
event handlers, timers and untracked code (`untrack(store.state)`).

## R2 — a conditional prop builds a memo per read

`prop={a() ? b : c}` (also `&&`, `||`, `??` over a signal) compiles to
`get prop() { return _$memo(() => !!a())() ? b : c }`. Every read creates a
computation. Read once in one owner it is garbage; read from a list item
(64 squares) or a callback (timer, observer — no owner) it is the fan-out that
made `LiveStarChessBoard` create 768 memos per click, and the
"computations created outside a `createRoot`" spam. Hoist to a named
`createMemo` in the parent and pass `prop={thing()}`; in a child that reads a
prop from a callback, read it through a memo created in the component body.

## R3 — JSX-valued props are re-rendered per read

`header={fooHeader()}` is a getter that runs `fooHeader()` — builds new DOM
and computations — each time the child reads `props.header`. Check presence
with a plain flag, never `props.header != null`; read the element once (in
the JSX slot where it mounts).

## R4 — fresh empties and rebuilt objects defeat equality

`[]`, `{}` or `new Set()` inside a memo or getter is a new value every run, so
every downstream `===` fails. Use module constants for empties
(`const NO_SQUARES: readonly Square[] = []`), and give memos over rebuilt
objects a value `equals` (the board's per-square `piece` compares type +
colour).

## R5 — per-item work reads O(1) from shared memos

Fold each list prop once into a `Set` / `Map` memo; each item wraps its own
answer in `createMemo(() => set().has(square))` so its render effect re-runs
only when *its* answer flips. Never `props.list.includes(square)` inside 64
render effects.

## R6 — batch multi-dispatch handlers

Outside an effect, each signal write propagates immediately. A handler that
dispatches twice (clear, then select) runs the graph twice. Wrap multi-write
handlers and timer callbacks in `batch`.

## R7 — derive, don't sync

An effect that reads signals only to write another signal is a memo written
the long way, and runs one extra pass. Use `createMemo`; keep effects for the
outside world (DOM, timers, storage).

## R8 — remount only when state must reset

A keyed `<Show>` rebuilds the whole subtree. Key it on what must start fresh
(a retry epoch), not on values an update could carry.

## R9 — time has one owner

Solid's graph is synchronous: it answers "what changed", never "when". A raw
`setTimeout` is invisible to it — no owner disposes it, a read inside the
callback tracks nothing, and a 0 ms hop used to escape a batch hides a
dispatch-from-effect (R7). So:

- Only `adapters/browser` touches `setTimeout` / `setInterval`; the lint rule
  `proveo-starchess/no-raw-timer` fails everything else (tests excepted).
- Component and effect code uses `createDelay` / `createRepeat` from
  `~/adapters/timers`: the cancel registers on the current owner, so unmount —
  or the effect's next run — cancels it. Arm it inside `createEffect(on(dep, …))`
  when only `dep` should re-arm it.
- Code that outlives one owner (a cancel map keyed by square, a player object,
  a click-deferred submit) uses `schedule` / `repeat` and owns the cancel.
- An awaited pause uses `sleep(ms, signal)`: aborting settles it, so a cancelled
  sequence never hangs on a promise that cannot resolve.
- A fetch deadline is `AbortSignal.timeout(ms)` joined by hand with the owner's
  controller (one per-fetch controller both abort) — no timer to forget on the
  throw path. Not `AbortSignal.any`: Chrome 116 / Safari 17.4 only, above the
  build's baseline, and its reason would surface a `TimeoutError` message in
  the import error chrome instead of the `AbortError` users saw before.
- A store's own timers (turn timeout, timeline, review runner) die with its
  owner: `createMatchStore` cancels them in its `onCleanup`, so a screen left
  mid-turn never auto-submits into a store nobody renders.
- A phase ladder (idle → act → hold, looped) is **derived from time**, not
  scheduled: `createPhaseClock(steps, cycleMs)` (`presentation/animations/phaseLoop.ts`)
  memoizes `{ cycle, phase }` over one owner-bound `createFrameClock()` (rAF,
  frame timestamps) and runs each step once per cycle in offset order — a frame
  that jumps several steps runs every one it crossed; a gap longer than one
  cycle (background tab) resumes at the current cycle instead of replaying
  stale ones. No timer set exists to halt, so no step can be cancelled by the
  next cycle's start. Offsets start at 0, ascend, and stay `< cycleMs` (dev
  throws). Timing is pinned per demo in `__tests__/demos/demoPhaseTiming.test.tsx`.
- `requestAnimationFrame` and `queueMicrotask` are frame and microtask hooks,
  not wall-clock timers; they stay allowed, but a frame callback that must be
  cancellable goes through `frame(fn) → Cancel` (`~/adapters/timers`, port
  `Frames`).

Owner map: `timers.puml`.

## Where each rule is applied

Per-site rationale (why a memo exists, what it compares, the measured cost it
removed) lives beside the rules, one file per source area — code carries only
its `// SPEC:` pointer:

- `reactivity/presentation.md` — board, combat overlays, HUD, animations
- `reactivity/app-screens.md` — match store, BaseScreen, every screen
- `reactivity/tutorial.md` — lesson hosts, narration, choreography
- `reactivity/components.md` — components, stores, hooks, the probe itself

## Owners

- Shell granularity: `app/shellFields.ts` (one signal per field).
- Board per-square memos: `presentation/board/components/StarChessBoard.tsx`.
- VFX pacing and tiers are separate: `_spec/apps/starchess/vfx-tier.puml`.
