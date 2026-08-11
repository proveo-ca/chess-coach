/**
 * Tutorial completion flag — localStorage `starchess_tutorial_cleared`.
 * Default `false` until Go Home on King Hunt (live) win, or a future flow
 * marks the tutorial cleared.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */

export const TUTORIAL_CLEARED_KEY = "starchess_tutorial_cleared";

export const isTutorialCleared = (): boolean => {
  try {
    return localStorage.getItem(TUTORIAL_CLEARED_KEY) === "true";
  } catch {
    return false;
  }
};

export const setTutorialCleared = (cleared: boolean): void => {
  try {
    localStorage.setItem(TUTORIAL_CLEARED_KEY, cleared ? "true" : "false");
  } catch (e) {
    console.error("Failed to save StarChess tutorial cleared flag", e);
  }
};

/** King Hunt (live) final — offer complete modal when enemy CC dies and uncleared. */
export const shouldOfferTutorialComplete = (input: {
  tutorial: boolean;
  phase: string;
  /** Black king lives when the human plays White (king-hunt-live). */
  enemyKingLives: number;
  cleared: boolean;
}): boolean =>
  input.tutorial && input.phase === "gameOver" && input.enemyKingLives === 0 && !input.cleared;
