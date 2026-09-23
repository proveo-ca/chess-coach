import type { GameRecord } from "~/types/game";

const colorWord = (c: "w" | "b"): string => (c === "w" ? "White" : "Black");

// Strip a trailing " (...)" annotation from legacy opponent names that were
// stored as "Selena (Intermediate)" before the difficulty was split off.
const baseName = (s: string): string => s.replace(/\s*\([^)]*\)\s*$/, "").trim();

const opponentLabel = (g: GameRecord): string =>
  baseName(g.opponentName || g.opponentRace || "Selena");

/**
 * Human-readable label for a recorded game, e.g. "Juan (White) vs Selena (Black)".
 * The player's name is user-supplied (the browser exposes no usable identity);
 * it falls back to "You" when unset. Colors are derived from `playerColor`.
 */
export const formatGameLabel = (g: GameRecord): string => {
  const player = g.playerName?.trim() || "You";
  const opponent = opponentLabel(g);
  const opponentColor: "w" | "b" = g.playerColor === "w" ? "b" : "w";
  return `${player} (${colorWord(g.playerColor)}) vs ${opponent} (${colorWord(opponentColor)})`;
};

/**
 * Compact mobile Review matchup line, e.g. "Win (White) vs Selena".
 */
export const formatReviewMatchup = (g: GameRecord): string => {
  const resultLabel =
    g.result === "ongoing" ? "In Progress" : g.result.charAt(0).toUpperCase() + g.result.slice(1);
  return `${resultLabel} (${colorWord(g.playerColor)}) vs ${opponentLabel(g)}`;
};
