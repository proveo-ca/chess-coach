// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * King Defense II — apply turn-open checks on mount so the opening damage is
 * on the board before the player plans.
 */
import { defineChoreography } from "~/demos/choreography/defineChoreography";
import type { LessonChoreography } from "~/demos/choreography";

export const useKingDefenseIIChecks: LessonChoreography = defineChoreography({
  steps: [{ onMount: true, ensureTurnOpenChecks: true }],
  interactive: (store) => {
    const s = store.state();
    return s.turnStartChecksApplied && !s.timeline.active && (s.phase === "planning" || s.phase === "targeting");
  },
});
