// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Spider Mine fog reveal — enemy Ra1 once on T2 P-phase, then auto-end.
 * Seed turn 0: marines d2/e2/f2 + hoverbike b2 for vision, white mine a4 vs
 * black mines c3/e4 + tank a8. On the third planning turn (snap.turn 2) the
 * black tank slides a8→a1, tripping the a4 mine — and the turn auto-ends so
 * the player watches it happen instead of having to move first.
 *
 * The queue + submit run in a microtask on purpose: this hook's effect fires
 * while the turn-open dispatch is still unwinding (its setShell notifies
 * synchronously), and a nested submitTurn there gets its TIMELINE_START
 * clobbered when the outer dispatch writes its pre-submit timeline back.
 * Deferring puts both dispatches at the top of the stack — same pattern as
 * `useKingDefenseOpening`. Seed Q stays empty; generic adjutant untouched.
 * Best-effort, never throws.
 */
import { createEffect, createMemo } from "solid-js";
import { placementToMap } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { ChoreographyResult } from "~/demos/choreography";
import type { MatchStore } from "~/types/match";

const COUNTER_TURN = 2;
const FROM: Square = "a8";
const TO: Square = "a1";

export const useMineRa1Counter = (store: MatchStore): ChoreographyResult => {
  let armed = false;

  createEffect(() => {
    if (armed) return;
    const s = store.state();
    if (s.phase !== "planning" && s.phase !== "targeting") return;
    if (!s.turnStartChecksApplied || s.timeline.active) return;
    const snap = s.liveSnapshot;
    if (snap.turn !== COUNTER_TURN || snap.phase !== "P") return;
    armed = true;
    queueMicrotask(() => {
      try {
        const cur = store.state();
        if (cur.phase !== "planning" && cur.phase !== "targeting") return;
        const live = cur.liveSnapshot;
        if (live.turn !== COUNTER_TURN || live.phase !== "P") return;
        const blackQueued = (live.queue?.actions ?? []).some(
          (a) => a.color === "b",
        );
        if (!blackQueued) {
          const map = placementToMap(live.placement);
          const origin = map.get(FROM);
          if (!origin || origin.type !== "r" || origin.color !== "b") return;
          const dest = map.get(TO);
          if (dest && dest.color === "b") return;
          store.dispatch({
            type: "QUEUE_ACTION",
            action: {
              timing: "C",
              kind: "classical",
              color: "b",
              from: FROM,
              to: TO,
            },
          });
        }
        store.submitTurn("end");
      } catch {
        /* never throw */
      }
    });
  });

  // Gate input once the turn-3 auto-end is underway — the player watches.
  const interactive = createMemo(() => {
    const s = store.state();
    if (s.liveSnapshot.turn !== COUNTER_TURN) return true;
    return s.phase === "planning" || s.phase === "targeting";
  });

  return { interactive };
};
