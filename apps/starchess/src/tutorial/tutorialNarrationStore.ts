/**
 * Tutorial narration bridge — demos push MatchStore phase; header reads Selena lines.
 */
import { createSignal } from "solid-js";

import type { ReviewTurnPhase } from "~/types/review";

/** Compact live intent queue entry for completeWhen / reactions. */
export type TutorialQueueAction = {
  timing: string;
  kind: string;
  color: string;
};

export type TutorialNarrationState = {
  reviewPhase?: ReviewTurnPhase;
  timelineActive?: boolean;
  /** Live `formatScFen` for script `scfen` reactions. */
  scfen?: string;
  /** 1-based planning ordinal (`snap.turn + 1`; seed turn 0 → 1). */
  turn?: number;
  /** Live SCFEN queue actions (intent) — preferred over wire regex for stacks. */
  queue?: readonly TutorialQueueAction[];
  /** Live targeting mode (`bishopSnipe`, `queenWarp`, `spawn`, …). */
  targetingKind?: string | null;
  /** Tutorial typewriter cursor (Turn Resolution steppers). */
  typewriterTurn?: number;
  typewriterBeat?: "turn" | "check" | "intent" | "resolve";
};

export const [tutorialNarration, setTutorialNarration] =
  createSignal<TutorialNarrationState>({});

export const resetTutorialNarration = () => setTutorialNarration({});
