import {
  getSideVision,
  placementToMap,
  scOutcome,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import type { MatchState } from "~/app/matchTypes";
import { fogWithGasUsedReveal } from "~/presentation/board/fogProjection";

export const displayedSnapshot = (state: MatchState): ScFenSnapshot => {
  // Terminal review seeks settled history; live resolve still uses liveSnapshot.
  if (state.phase === "gameOver" && !state.timeline.active) {
    const settled = state.settledSnapshots[state.reviewIndex];
    if (settled) {
      const placement = state.timeline.displayPlacement ?? settled.placement;
      return { ...settled, placement };
    }
  }
  const placement =
    state.timeline.displayPlacement ?? state.liveSnapshot.placement;
  return { ...state.liveSnapshot, placement };
};

export const isTerminal = (state: MatchState) =>
  state.phase === "gameOver" || state.liveSnapshot.phase === "O";

export const canSubmit = (state: MatchState) =>
  state.phase === "planning" || state.phase === "targeting";

export const pieceMap = (state: MatchState) =>
  placementToMap(displayedSnapshot(state).placement);

export const outcomeLabel = (state: MatchState): string | null => {
  if (!isTerminal(state)) return null;
  const o = state.outcome ?? scOutcome(state.liveSnapshot);
  if (!o) return "Game over";
  if (o.draw) return "Draw";
  return `${o.winner === "w" ? "White" : "Black"} wins`;
};

export const fogForViewer = (state: MatchState) => {
  const snap = displayedSnapshot(state);
  const base = getSideVision(snap.placement, state.viewer, {
    rookModeFor: (sq) => (state.siegedRooks.has(sq) ? "siege" : "tank"),
    mines: snap.mines,
  });
  return fogWithGasUsedReveal(base, state.specialsUsed, state.viewer, snap);
};
