/**
 * Tutorial narration bridge — demos push MatchStore phase; header reads Selena lines.
 */
import { createSignal } from "solid-js";

import type { ReviewTurnPhase } from "~/types/review";

export type TutorialNarrationState = {
  reviewPhase?: ReviewTurnPhase;
  timelineActive?: boolean;
  /** Live `formatScFen` for script `scfen` reactions. */
  scfen?: string;
  /** 1-based planning ordinal (`snap.turn + 1`; seed turn 0 → 1). */
  turn?: number;
};

export const [tutorialNarration, setTutorialNarration] =
  createSignal<TutorialNarrationState>({});

export const resetTutorialNarration = () => setTutorialNarration({});
