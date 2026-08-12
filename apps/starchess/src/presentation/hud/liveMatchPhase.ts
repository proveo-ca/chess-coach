// SPEC: _spec/apps/starchess/architecture/board-entities.puml
/**
 * Derive live / review phase label for TurnBar + TurnBarSidebar chips.
 */
import type { EndScTurnResult } from "@chess-coach/starchess-core";

import type { MatchPhase } from "~/types/match";
import { isCheckOnlyResolve } from "~/presentation/hud/isCheckOnlyResolve";
import type { ReviewTurnPhase } from "~/presentation/hud/reviewPhases";
import { reviewPhaseLabel } from "~/presentation/hud/reviewPhases";

export { reviewPhaseLabel };

/** Live match → review-phase vocabulary for the TurnBar chip. */
export const liveMatchPhase = (input: {
  phase: MatchPhase;
  lastResolve: EndScTurnResult | null;
  timelineActive: boolean;
  /** Last-rank picker — intent chrome while the modal is open. */
  pendingPromotion?: boolean;
}): ReviewTurnPhase => {
  const { phase, lastResolve, timelineActive, pendingPromotion } = input;
  if (phase === "gameOver") return "final";
  if (phase === "resolving" || timelineActive) {
    if (lastResolve && isCheckOnlyResolve(lastResolve)) return "check";
    return "resolve";
  }
  if (pendingPromotion || phase === "planning" || phase === "targeting") {
    return "intent";
  }
  return "start";
};
