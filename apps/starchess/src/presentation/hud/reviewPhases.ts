/**
 * Observer DualNav review — one arrow = one full turn; phase chip tracks progress.
 */
import type { ReviewTurnPhase } from "~/types/review";
import type { ChipTone } from "~/types/ui";

export type { ReviewTurnPhase };

export const reviewPhaseLabel = (phase: ReviewTurnPhase): string => {
  switch (phase) {
    case "start":
      return "Start";
    case "check":
      return "Check";
    case "intent":
      return "Intent";
    case "resolve":
      return "Resolve";
    case "final":
      // Game over / last settled ply — no active phase.
      return "-";
  }
};

/** Brief hold so intent ghosts / check rings are readable before End plays. */
export const REVIEW_INTENT_HOLD_MS = 500;

/** Chip tone for the phase label (check / intent / resolve / idle). */
export const reviewPhaseChipTone = (phase: ReviewTurnPhase): ChipTone => {
  switch (phase) {
    case "check":
      return "check";
    case "intent":
      return "intent";
    case "resolve":
      return "resolve";
    default:
      return "default";
  }
};
