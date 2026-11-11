// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Pawn Gas Defense — enemy B b4→d2 once on T11 P-phase.
 * Seed Q stays empty; generic adjutant untouched.
 */
import type { Square } from "chess.js";

import { defineChoreography } from "~/demos/choreography/defineChoreography";
import type { LessonChoreography } from "~/demos/choreography";

const COUNTER_TURN = 11;
const FROM: Square = "b4";
const TO: Square = "d2";

export const usePawnGasDefenseCounter: LessonChoreography = defineChoreography({
  steps: [
    {
      turn: COUNTER_TURN,
      when: (map) =>
        map.get("b4")?.type === "b" &&
        map.get("b4")?.color === "b" &&
        map.get("d2")?.type === "r" &&
        map.get("d2")?.color === "w" &&
        map.get("c2")?.type === "p" &&
        map.get("c2")?.color === "w",
      actions: () => [{ timing: "C", kind: "classical", color: "b", from: FROM, to: TO }],
    },
  ],
});
