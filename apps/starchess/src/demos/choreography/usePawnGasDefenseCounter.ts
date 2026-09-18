// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Pawn Gas Defense — enemy B b4→d2 once on T1 P-phase.
 * Seed Q stays empty; generic adjutant untouched.
 */
import { createEffect } from "solid-js";
import { placementToMap } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { ChoreographyResult } from "~/demos/choreography";
import type { MatchStore } from "~/types/match";

const COUNTER_TURN = 1;
const FROM: Square = "b4";
const TO: Square = "d2";

export const usePawnGasDefenseCounter = (
  store: MatchStore,
): ChoreographyResult => {
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
      if (map.get("b4")?.type !== "b" || map.get("b4")?.color !== "b") return;
      if (map.get("d2")?.type !== "r" || map.get("d2")?.color !== "w") return;
      if (map.get("c2")?.type !== "p" || map.get("c2")?.color !== "w") return;
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
