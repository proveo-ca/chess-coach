// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * King Attack #1 — the enemy's *second* turn. The SCFEN wire carries one queue,
 * so turn 11's retreat lives on the seed and this hook supplies turn 12: the
 * Command Center deploys a Siege Tank onto the square its hoverbike vacated and
 * shoots the BattleShip that was hiding there.
 *
 * It only ever runs on the failure branch. Clearing b7 on turn 11 lands both
 * checkers, which takes the HP-2 Command Center to 0 at the turn-12 open — the
 * match is over before planning reopens and this effect never fires. A player
 * who left b7 alive gets one checker instead, survives to turn 12, and loses the
 * ship (attacks resolve before moves, so by then it cannot be saved) — which is
 * what `restartWhen` reads to send them back for another try.
 */
import { createEffect } from "solid-js";
import { UNIT_COST, placementToMap } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { ChoreographyResult } from "~/demos/choreography";
import type { MatchStore } from "~/types/match";

/** Enemy turn this counterattack belongs to (seed is turn 11). */
const COUNTER_TURN = 12;
/** Command Center square the deploy anchors on, and the vacated ring square. */
const ENEMY_CC: Square = "a8";
const DEPLOY_AT: Square = "b8";

export const useKingAttackTankCounter = (store: MatchStore): ChoreographyResult => {
  let queued = false;

  createEffect(() => {
    if (queued) return;
    const s = store.state();
    if (s.phase !== "planning" && s.phase !== "targeting") return;
    if (!s.turnStartChecksApplied || s.timeline.active) return;

    const snap = s.liveSnapshot;
    if (snap.turn !== COUNTER_TURN || snap.phase !== "P") return;
    if ((snap.queue?.actions ?? []).some((a) => a.color === "b")) return;

    const map = placementToMap(snap.placement);
    // Command Center gone, ring square retaken, or no ship left to shoot at.
    if (map.get(ENEMY_CC)?.type !== "k") return;
    if (map.has(DEPLOY_AT)) return;
    const ship = [...map].find(
      ([, piece]) => piece.type === "q" && piece.color === "w",
    )?.[0];
    if (!ship) return;

    queued = true;
    store.dispatch({ type: "SPEND_STORED", color: "b", amount: UNIT_COST.r });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "B",
        kind: "deploy",
        color: "b",
        from: ENEMY_CC,
        to: DEPLOY_AT,
        unit: "r",
      },
    });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: "b",
        from: DEPLOY_AT,
        to: ship,
      },
    });
  });

  return {};
};
