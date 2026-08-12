// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * King Defense — resolve the pre-queued Turn 1 bishop slide (Bh4→g3) on mount
 * so the player *sees* the check land, then hand control over.
 */
import { createMemo, onMount } from "solid-js";

import type { ChoreographyResult } from "~/demos/choreography";
import type { MatchStore } from "~/types/match";

export const useKingDefenseOpening = (store: MatchStore): ChoreographyResult => {
  let openingSubmitted = false;

  onMount(() => {
    queueMicrotask(() => {
      if (openingSubmitted) return;
      const s = store.state();
      const blackQueued = (s.liveSnapshot.queue?.actions ?? []).filter(
        (a) => a.color === "b",
      );
      if (s.liveSnapshot.turn !== 0 || blackQueued.length === 0) return;
      openingSubmitted = true;
      store.submitTurn("end");
    });
  });

  // Suppress input until the Turn 1 bishop resolve has settled (turn ≥ 1, idle).
  const interactive = createMemo(() => {
    const s = store.state();
    return (
      s.liveSnapshot.turn >= 1 &&
      !s.timeline.active &&
      (s.phase === "planning" || s.phase === "targeting")
    );
  });

  return { interactive };
};
