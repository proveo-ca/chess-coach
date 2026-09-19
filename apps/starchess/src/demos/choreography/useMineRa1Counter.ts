// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Spider Mine fog reveal — enemy Ra1 once on T2 P-phase.
 * Seed turn 0: marines d2/e2/f2 vs black mines c3/e4 + tank a8.
 * On the third planning turn (snap.turn 2) the black tank slides a8→a1,
 * exploring the fog so the player sees what uncovering a mine looks like.
 * Seed Q stays empty; generic adjutant untouched. Best-effort, never throws.
 */
import { createEffect } from "solid-js";
import { placementToMap } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { ChoreographyResult } from "~/demos/choreography";
import type { MatchStore } from "~/types/match";

const COUNTER_TURN = 2;
const FROM: Square = "a8";
const TO: Square = "a1";

export const useMineRa1Counter = (store: MatchStore): ChoreographyResult => {
  let queued = false;

  createEffect(() => {
    if (queued) return;
    try {
      const s = store.state();
      if (s.phase !== "planning" && s.phase !== "targeting") return;
      if (!s.turnStartChecksApplied || s.timeline.active) return;
      const snap = s.liveSnapshot;
      if (snap.turn !== COUNTER_TURN || snap.phase !== "P") return;
      if ((snap.queue?.actions ?? []).some((a) => a.color === "b")) return;
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
    } catch {
      queued = false;
    }
  });

  return {};
};
