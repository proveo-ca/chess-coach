// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Sole publisher into {@link tutorialNarrationStore} from a live lesson.
 * Previously copy-pasted across five hosts, each omitting a different field —
 * one publisher means every lesson reports the same shape.
 */
import { formatScFen } from "@chess-coach/starchess-core";
import { createEffect, onCleanup } from "solid-js";

import { displayedSnapshot } from "~/app/selectors";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import {
  resetTutorialNarration,
  setTutorialNarration,
} from "~/tutorial/tutorialNarrationStore";
import type { MatchStore } from "~/types/match";

export const useLessonNarration = (
  store: MatchStore,
  enabled: () => boolean,
): void => {
  createEffect(() => {
    if (!enabled()) return;
    const s = store.state();
    const snap = displayedSnapshot(s);
    setTutorialNarration({
      reviewPhase: liveMatchPhase({
        phase: s.phase,
        lastResolve: s.lastResolve,
        timelineActive: s.timeline.active,
        pendingPromotion: !!s.pendingPromotion,
      }),
      timelineActive: s.timeline.active,
      scfen: formatScFen(snap),
      turnStartChecksApplied: s.turnStartChecksApplied,
      queue: (snap.queue?.actions ?? []).map((a) => ({
        timing: a.timing,
        kind: a.kind,
        color: a.color,
      })),
      targetingKind: s.targeting?.kind ?? null,
      // Seed SCFEN uses turn 0 for the first planning window; +1 → 1-based
      // ordinal so turn-gated script lines fire on the right turn.
      turn: snap.turn + 1,
    });
  });

  onCleanup(() => {
    if (enabled()) resetTutorialNarration();
  });
};
