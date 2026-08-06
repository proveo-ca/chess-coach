import {
  getSideVision,
  placementToMap,
  scOutcome,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import { Chess } from "chess.js";

import type { MatchState } from "~/app/matchTypes";
import { fogWithGasUsedReveal } from "~/presentation/board/fogProjection";

export const displayedSnapshot = (state: MatchState): ScFenSnapshot => {
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
  let game: Chess;
  try {
    game = new Chess(`${snap.placement} ${state.viewer} - - 0 1`);
  } catch {
    game = new Chess();
  }
  const base = getSideVision(game, state.viewer, {
    rookModeFor: (sq) => (state.siegedRooks.has(sq) ? "siege" : "tank"),
    mines: snap.mines,
  });
  return fogWithGasUsedReveal(base, state.specialsUsed, state.viewer, snap);
};
