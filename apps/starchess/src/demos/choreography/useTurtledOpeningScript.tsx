// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Turtled Opponent — enemy's first two live turns (relative turns 2-3; the
 * lesson seeds relative turn 1 in the board SCFEN's own queue). Turn 13: the
 * a6 Hoverbike (having already mined a6 and retreated to c5 on relative
 * turn 1) queues c5->d3, threatening the ally Command Center two hops out —
 * if the player doesn't capture it first, it dies to the queued move instead
 * of landing. Turn 14: the Command Center deploys a Tank on a6, gas-pushes
 * the b6 Marine, then rides the Tank a6->a1 (which the ally's own a3 mine,
 * laid on turn 13, detonates mid-slide if the ally Hoverbike has already
 * vacated a3 this same turn).
 *
 * Turn 15 onward: this hook stops injecting and the already-wired naive
 * `adjutant` (board.opponent: "adjutant") plans normally — `adjutant` defers
 * whenever a same-color action is already queued, which is all a scripted
 * turn here ever relies on. Also renders the King Hunt graduation modal,
 * composed in rather than re-declared as a second `board.choreography`.
 */
import { createEffect } from "solid-js";
import { placementToMap } from "@chess-coach/starchess-core";

import type { ChoreographyContext, ChoreographyResult } from "~/demos/choreography";
import { useKingHuntGraduation } from "~/demos/choreography/useKingHuntGraduation";
import type { MatchStore } from "~/types/match";

const TURN_HOVERBIKE_THREAT = 13;
const TURN_TANK_DEPLOY = 14;

export const useTurtledOpeningScript = (
  store: MatchStore,
  ctx: ChoreographyContext,
): ChoreographyResult => {
  let queuedTurn: number | null = null;

  createEffect(() => {
    try {
      const s = store.state();
      if (s.phase !== "planning" && s.phase !== "targeting") return;
      if (!s.turnStartChecksApplied || s.timeline.active) return;
      const snap = s.liveSnapshot;
      if (snap.phase !== "P") return;
      if (queuedTurn === snap.turn) return;
      if ((snap.queue?.actions ?? []).some((a) => a.color === "b")) {
        queuedTurn = snap.turn;
        return;
      }

      if (snap.turn === TURN_HOVERBIKE_THREAT) {
        const map = placementToMap(snap.placement);
        const hoverbike = map.get("c5");
        if (hoverbike?.type !== "n" || hoverbike.color !== "b") return;
        store.dispatch({
          type: "QUEUE_ACTION",
          action: { timing: "C", kind: "classical", color: "b", from: "c5", to: "d3" },
        });
        queuedTurn = snap.turn;
        return;
      }

      if (snap.turn === TURN_TANK_DEPLOY) {
        const map = placementToMap(snap.placement);
        const cc = map.get("b7");
        const marine = map.get("b6");
        if (cc?.type !== "k" || cc.color !== "b") return;
        if (marine?.type !== "p" || marine.color !== "b") return;
        if (map.has("a6")) return;
        store.dispatch({
          type: "QUEUE_ACTION",
          action: { timing: "B", kind: "deploy", color: "b", from: "b7", to: "a6", unit: "r" },
        });
        store.dispatch({
          type: "QUEUE_ACTION",
          action: { timing: "B", kind: "stimStep", color: "b", from: "b6", to: "b5" },
        });
        store.dispatch({
          type: "QUEUE_ACTION",
          action: { timing: "C", kind: "classical", color: "b", from: "a6", to: "a1" },
        });
        queuedTurn = snap.turn;
        return;
      }

      queuedTurn = snap.turn;
    } catch {
      /* never throw */
    }
  });

  return useKingHuntGraduation(store, ctx);
};
