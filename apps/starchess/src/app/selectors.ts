import {
  getSideVision,
  placementToMap,
  scOutcome,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { MatchState } from "~/app/matchTypes";
import type { MatchShell, MatchStore, TimelineState } from "~/types/match";
import { tankModeForSieged } from "~/presentation/board/tankMode";

/** Pure: shell + timeline display* (not playingIds / progress / trails). */
export const displayedSnapshotFrom = (
  shell: MatchShell,
  tl: Pick<
    TimelineState,
    | "active"
    | "displayPlacement"
    | "displayCCLives"
    | "displayMines"
    | "displaySiegedTanks"
  >,
): ScFenSnapshot => {
  // Terminal review: settled cursor + optional in-flight timeline overlays.
  if (shell.phase === "gameOver") {
    const settled = shell.settledSnapshots[shell.reviewIndex];
    if (settled) {
      // Active playback OR mid-wave soft-done (display kept, active cleared).
      if (tl.active || tl.displayPlacement != null) {
        return {
          ...settled,
          placement: tl.displayPlacement ?? settled.placement,
          ccLives: tl.displayCCLives ?? settled.ccLives,
          mines: tl.displayMines ?? settled.mines,
          siegedTanks: tl.displaySiegedTanks
            ? [...tl.displaySiegedTanks]
            : settled.siegedTanks,
        };
      }
      return settled;
    }
  }
  const placement = tl.displayPlacement ?? shell.liveSnapshot.placement;
  // Snap `U:` + planning arm marks → green aura / Charon pods until turn-open checks.
  // U: is not a fog pierce — hidden enemies stay hidden.
  const { specialsUsed: usedMarks, ...rest } = shell.liveSnapshot;
  const used = new Set<Square>(usedMarks ?? []);
  for (const sq of shell.specialsUsed) used.add(sq);
  return {
    ...rest,
    placement,
    ...(used.size ? { specialsUsed: [...used].sort() as Square[] } : {}),
  };
};

export const displayedSnapshot = (state: MatchState): ScFenSnapshot =>
  displayedSnapshotFrom(state, state.timeline);

/** Reactive read: shell + timeline (call inside createMemo). */
export const readDisplayedSnapshot = (store: MatchStore): ScFenSnapshot =>
  displayedSnapshotFrom(store.shell(), store.timeline());

export const isTerminal = (state: MatchShell | MatchState) =>
  state.phase === "gameOver" || state.liveSnapshot.phase === "O";

export const canSubmit = (state: MatchShell | MatchState) =>
  state.phase === "planning" || state.phase === "targeting";

export const pieceMap = (state: MatchState) =>
  placementToMap(displayedSnapshot(state).placement);

export const outcomeLabel = (state: MatchShell | MatchState): string | null => {
  if (!isTerminal(state)) return null;
  const o = state.outcome ?? scOutcome(state.liveSnapshot);
  if (!o) return "Game over";
  if (o.draw) return "Draw";
  return `${o.winner === "w" ? "White" : "Black"} wins`;
};

export const fogForViewer = (state: MatchState) => {
  const snap = displayedSnapshot(state);
  const sieged = new Set(snap.siegedTanks ?? [...state.siegedTanks]);
  return getSideVision(snap.placement, state.viewer, {
    tankModeFor: tankModeForSieged(sieged),
    mines: snap.mines,
  });
};
