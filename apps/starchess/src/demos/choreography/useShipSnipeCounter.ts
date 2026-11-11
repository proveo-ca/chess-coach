// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Ship Snipe Counter — scripted black B tacticalJump d5→f1 once on T21.
 * F-vs-F cannot catch a warp (white sorts first inside a timing),
 * so the enemy warps in B (specialBefore) and the player's F snipe
 * (specialAfter) catches the ship after it lands. Generic adjutant
 * untouched.
 */
import type { Square } from "chess.js";

import { defineChoreography } from "~/demos/choreography/defineChoreography";
import type { LessonChoreography } from "~/demos/choreography";

const COUNTER_TURN = 21;
const FROM: Square = "d5";
const TO: Square = "f1";

export const useShipSnipeCounter: LessonChoreography = defineChoreography({
  steps: [
    {
      turn: COUNTER_TURN,
      when: (map) => {
        const origin = map.get(FROM);
        return !!origin && origin.type === "q" && origin.color === "b" && !map.has(TO);
      },
      actions: () => [{ timing: "B", kind: "tacticalJump", color: "b", from: FROM, to: TO }],
    },
  ],
});
