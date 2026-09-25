// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * King Defense — resolve the pre-queued Turn 1 bishop slide (Bh4→g3) on mount
 * so the player *sees* the check land, then hand control over.
 */
import { defineChoreography } from "~/demos/choreography/defineChoreography";
import type { LessonChoreography } from "~/demos/choreography";

export const useKingDefenseOpening: LessonChoreography = defineChoreography({
  steps: [
    {
      onMount: true,
      turn: 0,
      when: (_map, snap) => (snap.queue?.actions ?? []).some((a) => a.color === "b"),
      submitTurn: "end",
    },
  ],
  // Suppress input until the Turn 1 bishop resolve has settled (turn ≥ 1, idle).
  interactive: (store) => {
    const s = store.state();
    return s.liveSnapshot.turn >= 1 && !s.timeline.active && (s.phase === "planning" || s.phase === "targeting");
  },
});
