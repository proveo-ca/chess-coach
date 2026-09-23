import { createSignal } from "solid-js";

import { resolveMode } from "~/services/runtimeMode";

import type { ScreenCapabilities } from "~/types/capabilities";

export type { BestMoveArrowMode, ScreenCapabilities } from "~/types/capabilities";

/**
 * Per-screen capability descriptor. Each screen sets its capabilities on
 * mount; hooks and components read the specific flags they care about
 * instead of branching on a single mode boolean.
 *
 * Kept in a dedicated module so `settingsStore` can depend on it without
 * risking a circular import with `gameStore`.
 */
const hasLlm = resolveMode().kind !== "web-no-llm";

export const COACH_CAPABILITIES: ScreenCapabilities = {
  hint: true,
  travel: true,
  historyNav: true,
  evalBarAlwaysVisible: false,
  aiOpponent: true,
  blunderDetection: true,
  continuousAnalysis: false,
  bestMoveArrow: "off",
  commentary: hasLlm,
  persistGame: true,
  historyBranching: false,
  freeColorControl: false,
  readOnly: false,
  opponentUsesPlayerPieceSet: false,
  flipBoard: false,
};

export const ANALYSIS_CAPABILITIES: ScreenCapabilities = {
  hint: false,
  travel: false,
  historyNav: true,
  evalBarAlwaysVisible: true,
  aiOpponent: false,
  blunderDetection: false,
  continuousAnalysis: true,
  bestMoveArrow: "both", // free analysis: best move for whichever side moves
  commentary: hasLlm,
  persistGame: false,
  historyBranching: true,
  freeColorControl: true,
  readOnly: false,
  opponentUsesPlayerPieceSet: true,
  flipBoard: true,
};

export const REVIEW_CAPABILITIES: ScreenCapabilities = {
  hint: false,
  travel: false,
  historyNav: false,
  evalBarAlwaysVisible: true,
  aiOpponent: false,
  blunderDetection: false,
  continuousAnalysis: true,
  // "off" default (game-list view, no active game); ReviewScreen sets
  // "player-only" for standard review and "both" in branch/analysis mode.
  bestMoveArrow: "off",
  commentary: hasLlm,
  persistGame: false,
  // historyBranching=true so past-position navigation doesn't lock the UI
  // behind the replay overlay — the user IS navigating past positions.
  historyBranching: true,
  freeColorControl: false,
  readOnly: false,
  opponentUsesPlayerPieceSet: false,
  flipBoard: false,
};

/**
 * LAN multiplayer (human-vs-human, no AI/coach). Engine + coach features are
 * all off. `freeColorControl: false` plus `activePlayerColor = my chosen color`
 * restricts input to the player's own pieces on their own turn. `readOnly`
 * starts true (board locked in the lobby) and the LanScreen flips it to false
 * once both players have pressed Start — see useMultiplayerGame.
 */
export const LAN_PLAYER_CAPABILITIES: ScreenCapabilities = {
  hint: false,
  travel: false,
  historyNav: false,
  evalBarAlwaysVisible: false,
  aiOpponent: false,
  blunderDetection: false,
  continuousAnalysis: false,
  bestMoveArrow: "off",
  commentary: false,
  persistGame: false,
  historyBranching: false,
  freeColorControl: false,
  readOnly: true,
  opponentUsesPlayerPieceSet: false,
  flipBoard: false,
};

/** Observers never interact with the board. */
export const LAN_OBSERVER_CAPABILITIES: ScreenCapabilities = {
  ...LAN_PLAYER_CAPABILITIES,
  readOnly: true,
};

export const [capabilities, setCapabilities] = createSignal<ScreenCapabilities>(COACH_CAPABILITIES);
