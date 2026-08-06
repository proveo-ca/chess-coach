import {
  getSideVision,
  placementToMap,
  scOutcome,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { MatchState } from "~/app/matchTypes";
import { fogWithGasUsedReveal } from "~/presentation/board/fogProjection";

export const displayedSnapshot = (state: MatchState): ScFenSnapshot => {
  // Terminal review: settled cursor + optional in-flight timeline overlays.
  if (state.phase === "gameOver") {
    const settled = state.settledSnapshots[state.reviewIndex];
    if (settled) {
      const tl = state.timeline;
      if (tl.active) {
        return {
          ...settled,
          placement: tl.displayPlacement ?? settled.placement,
          kingLives: tl.displayKingLives ?? settled.kingLives,
          mines: tl.displayMines ?? settled.mines,
          siegedRooks: tl.displaySiegedRooks
            ? [...tl.displaySiegedRooks]
            : settled.siegedRooks,
        };
      }
      return settled;
    }
  }
  const placement =
    state.timeline.displayPlacement ?? state.liveSnapshot.placement;
  // Snap `U:` = prior-resolve gas stamps (green aura when already visible).
  // Match `specialsUsed` = armed this planning window — do not merge into U:.
  // U: is not a fog pierce — hidden enemies stay hidden.
  const { specialsUsed: usedMarks, ...rest } = state.liveSnapshot;
  return {
    ...rest,
    placement,
    ...(usedMarks?.length
      ? { specialsUsed: [...usedMarks].sort() as Square[] }
      : {}),
  };
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
  const sieged = new Set(snap.siegedRooks ?? [...state.siegedRooks]);
  const base = getSideVision(snap.placement, state.viewer, {
    rookModeFor: (sq) => (sieged.has(sq) ? "siege" : "tank"),
    mines: snap.mines,
  });
  return fogWithGasUsedReveal(
    base,
    new Set(snap.specialsUsed ?? []),
    state.viewer,
    snap,
  );
};
