/**
 * Best-move arrow overlay mode:
 *   - "off"         — never shown
 *   - "player-only" — only on the human (activePlayerColor) turn (review of a
 *                     human-vs-AI game: advice is for the human, not the AI reply)
 *   - "both"        — best move for whichever side is to move (free analysis)
 */
export type BestMoveArrowMode = "off" | "player-only" | "both";

/** Per-screen capability descriptor (shared by screens, stores, and starchess). */
export type ScreenCapabilities = {
  // UI affordances
  hint: boolean; // show hint button
  travel: boolean; // space-bar time-travel on blunders
  historyNav: boolean; // show move-history back/forward navigation
  evalBarAlwaysVisible: boolean; // eval bar visible during live play

  // Engine / coach behavior
  aiOpponent: boolean; // AI responds + advice after human move
  blunderDetection: boolean; // hover blunder detection + shocked emotion
  continuousAnalysis: boolean; // stockfish runs even when not player's turn
  bestMoveArrow: BestMoveArrowMode; // continuous best-move arrow overlay mode
  commentary: boolean; // LLM-generated move commentary

  // Persistence
  persistGame: boolean; // moves write to localStorage (Coach only)

  // Board interaction
  historyBranching: boolean; // past-history moves branch instead of lock UI
  freeColorControl: boolean; // can touch any color on its turn
  readOnly: boolean; // disables all piece interaction (used by ReviewScreen)

  // Visual
  opponentUsesPlayerPieceSet: boolean; // both sides render with player's piece set
  flipBoard: boolean; // show flip board button
};
