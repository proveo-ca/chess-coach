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
      // Active playback OR mid-wave soft-done (display kept, active cleared).
      if (tl.active || tl.displayPlacement != null) {
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
  // Snap `U:` + planning arm marks → green aura / Charon pods until turn-open checks.
  // U: is not a fog pierce — hidden enemies stay hidden.
  const { specialsUsed: usedMarks, ...rest } = state.liveSnapshot;
  const used = new Set<Square>(usedMarks ?? []);
  for (const sq of state.specialsUsed) used.add(sq);
  return {
    ...rest,
    placement,
    ...(used.size ? { specialsUsed: [...used].sort() as Square[] } : {}),
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
