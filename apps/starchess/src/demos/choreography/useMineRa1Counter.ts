// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Spider Mine fog reveal — enemy Ra1 once on T2 P-phase, then auto-end.
 * Seed turn 0: marines d2/e2/f2 + hoverbike b2 for vision, white mine a4 vs
 * black mines c3/e4 + tank a8. On the third planning turn (snap.turn 2) the
 * black tank slides a8→a1, tripping the a4 mine — and the turn auto-ends so
 * the player watches it happen instead of having to move first.
 * Seed Q stays empty; generic adjutant untouched. Best-effort, never throws.
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
  let queued = false;
  let submitted = false;

  createEffect(() => {
    if (queued && submitted) return;
    try {
      const s = store.state();
      if (s.phase !== "planning" && s.phase !== "targeting") return;
      if (!s.turnStartChecksApplied || s.timeline.active) return;
      const snap = s.liveSnapshot;
      if (snap.turn !== COUNTER_TURN || snap.phase !== "P") return;
      const blackQueued = (snap.queue?.actions ?? []).some(
        (a) => a.color === "b",
      );
      if (!queued && !blackQueued) {
        const map = placementToMap(snap.placement);
        const origin = map.get(FROM);
        if (!origin || origin.type !== "r" || origin.color !== "b") return;
        const dest = map.get(TO);
        if (dest && dest.color === "b") return;
        queued = true;
        store.dispatch({
          type: "QUEUE_ACTION",
          action: { timing: "C", kind: "classical", color: "b", from: FROM, to: TO },
        });
        return;
      }
      if (!submitted) {
        // End the player's turn for them — the queued Ra1 resolves on its own.
        if (!blackQueued) return;
        submitted = true;
        store.submitTurn("end");
      }
    } catch {
      queued = false;
      submitted = false;
    }
  });

  // Gate input once the turn-3 auto-end is underway — the player watches.
  const interactive = createMemo(() => {
    if (submitted && store.state().liveSnapshot.turn === COUNTER_TURN) {
      return false;
    }
    return true;
  });

  return { interactive };
};
