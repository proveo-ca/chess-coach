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
 * Turn 15 onward: neither step's turn gate matches and the already-wired
 * naive `adjutant` (board.opponent: "adjutant") plans normally — `adjutant`
 * defers whenever a same-color action is already queued, which is all a
 * scripted turn here ever relies on. Also renders the King Hunt graduation
 * modal, composed in rather than re-declared as a second `board.choreography`.
 */
import { defineChoreography } from "~/demos/choreography/defineChoreography";
import type { LessonChoreography } from "~/demos/choreography";
import { useKingHuntGraduation } from "~/demos/choreography/useKingHuntGraduation";

const TURN_HOVERBIKE_THREAT = 13;
const TURN_TANK_DEPLOY = 14;

export const useTurtledOpeningScript: LessonChoreography = defineChoreography({
  steps: [
    {
      turn: TURN_HOVERBIKE_THREAT,
      when: (map) => {
        const hoverbike = map.get("c5");
        return hoverbike?.type === "n" && hoverbike.color === "b";
      },
      actions: () => [{ timing: "C", kind: "classical", color: "b", from: "c5", to: "d3" }],
    },
    {
      turn: TURN_TANK_DEPLOY,
      when: (map) => {
        const cc = map.get("b7");
        const marine = map.get("b6");
        if (cc?.type !== "k" || cc.color !== "b") return false;
        if (marine?.type !== "p" || marine.color !== "b") return false;
        return !map.has("a6");
      },
      actions: () => [
        { timing: "B", kind: "deploy", color: "b", from: "b7", to: "a6", unit: "r" },
        { timing: "B", kind: "stimStep", color: "b", from: "b6", to: "b5" },
        { timing: "C", kind: "classical", color: "b", from: "a6", to: "a1" },
      ],
    },
  ],
  compose: useKingHuntGraduation,
});
