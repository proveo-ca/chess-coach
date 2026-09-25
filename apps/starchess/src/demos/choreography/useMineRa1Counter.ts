// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Spider Mine fog reveal — enemy Ra1 once on T2 P-phase, then auto-end.
 * Seed turn 0: marines d2/e2/f2 + hoverbike b2 for vision, white mine a4 vs
 * black mines c3/e4 + tank a8. On the third planning turn (snap.turn 2) the
 * black tank slides a8→a1, tripping the a4 mine — and the turn auto-ends so
 * the player watches it happen instead of having to move first.
 *
 * `defer` (a queueMicrotask) matters here: this step's guard passes while the
 * turn-open dispatch is still unwinding (its setShell notifies synchronously),
 * and a nested submitTurn there gets its TIMELINE_START clobbered when the
 * outer dispatch writes its pre-submit timeline back. Deferring puts both
 * dispatches at the top of the stack. `once` arms the step immediately (before
 * the microtask even runs) so it never re-enters, regardless of what the
 * deferred re-check finds — matching `armed = true` set ahead of the original
 * hook's own `queueMicrotask`. `skipQueuedGuard` is required because this step
 * must still submit the turn even when black is already queued — the standard
 * "already queued" guard would otherwise skip it entirely. Seed Q stays empty;
 * generic adjutant untouched. Best-effort, never throws.
 */
import type { Square } from "chess.js";

import { defineChoreography } from "~/demos/choreography/defineChoreography";
import type { LessonChoreography } from "~/demos/choreography";

const COUNTER_TURN = 2;
const FROM: Square = "a8";
const TO: Square = "a1";

export const useMineRa1Counter: LessonChoreography = defineChoreography({
  steps: [
    {
      turn: COUNTER_TURN,
      once: true,
      defer: true,
      skipQueuedGuard: true,
      run: ({ store, map, snap }) => {
        const blackQueued = (snap.queue?.actions ?? []).some((a) => a.color === "b");
        if (!blackQueued) {
          const origin = map.get(FROM);
          if (!origin || origin.type !== "r" || origin.color !== "b") return false;
          const dest = map.get(TO);
          if (dest && dest.color === "b") return false;
          store.dispatch({
            type: "QUEUE_ACTION",
            action: { timing: "C", kind: "classical", color: "b", from: FROM, to: TO },
          });
        }
        store.submitTurn("end");
        return true;
      },
    },
  ],
  // Gate input once the turn-3 auto-end is underway — the player watches.
  interactive: (store) => {
    const s = store.state();
    if (s.liveSnapshot.turn !== COUNTER_TURN) return true;
    return s.phase === "planning" || s.phase === "targeting";
  },
});
