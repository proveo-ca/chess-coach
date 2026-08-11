/**
 * Per-screen capability descriptor for StarChess.
 * Adapted from apps/ui `ScreenCapabilities` — only flags that StarChess chrome
 * and board input actually branch on (no coach/engine/LLM affordances).
 */
export type ScreenCapabilities = {
  // Board interaction
  /** Disables piece interaction (maps, pure observer review). */
  readOnly: boolean;
  /** Can touch either color on its turn (analysis-style demos). */
  freeColorControl: boolean;

  // Visual / chrome
  /** Show flip-board control in SideRailTools. */
  flipBoard: boolean;
  /**
   * Tutorial shell — Home only (hide vision radios even when reviewing).
   */
  homeOnly?: boolean;
};
