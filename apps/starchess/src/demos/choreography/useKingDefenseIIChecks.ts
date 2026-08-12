// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * King Defense II — apply turn-open checks on mount so the opening damage is
 * on the board before the player plans.
 */
import { createMemo, onMount } from "solid-js";

import type { ChoreographyResult } from "~/demos/choreography";
import type { MatchStore } from "~/types/match";

export const useKingDefenseIIChecks = (store: MatchStore): ChoreographyResult => {
  onMount(() => {
    queueMicrotask(() => {
      store.ensureTurnOpenChecks();
    });
  });

  const interactive = createMemo(() => {
    const s = store.state();
    return (
      s.turnStartChecksApplied &&
      !s.timeline.active &&
      (s.phase === "planning" || s.phase === "targeting")
    );
  });

  return { interactive };
};
