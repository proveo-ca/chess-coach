/**
 * Human-readable labels for StarChess matches (live Single + Review detail).
 * Mirrors Coach `formatGameLabel` / result line — Blue/Red · Adjutant.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import type { StarChessColor } from "@chess-coach/starchess-core";

import type { StarChessGameRecord, StarChessMatchResult } from "~/types/review";
import { displayPlayerName } from "~/utils/playerName";

const colorWord = (c: StarChessColor): string => (c === "w" ? "Blue" : "Red");

const resultWord = (r: StarChessMatchResult): string =>
  r.charAt(0).toUpperCase() + r.slice(1);

/** Live `/single` header — locked opponent from New Game setup. */
export const LIVE_ADJUTANT_MATCH_TITLE = "Game vs Adjutant (Script)";

/**
 * Result line for Review detail, e.g. "Win (Blue)".
 */
export const formatMatchResultTitle = (g: StarChessGameRecord): string =>
  `${resultWord(g.result)} (${colorWord(g.playerColor)})`;

export const formatScriptLabel = (id: string): string => {
  // "adjutant-naive" → "adjutant (naive)", "adjutant-strategic" → "adjutant (strategic)"
  const parts = id.split("-");
  if (parts.length >= 2) return `${parts[0]} (${parts.slice(1).join("-")})`;
  return id;
};

/**
 * Matchup line, e.g. "Alex (Blue) vs Adjutant (Red)".
 * Player name falls back to "You" when unset. For arena imports, shows
 * both scripts (max 2 lines): "adjutant (naive) (Blue) vs adjutant (strategic) (Red)".
 */
export const formatMatchLabel = (g: StarChessGameRecord): string => {
  if (g.arenaPlayers) {
    const wLabel = formatScriptLabel(g.arenaPlayers.w);
    const bLabel = formatScriptLabel(g.arenaPlayers.b);
    return `${wLabel} (Blue) vs ${bLabel} (Red)`;
  }
  const player = displayPlayerName(g.playerName);
  const opponentColor: StarChessColor = g.playerColor === "w" ? "b" : "w";
  return `${player} (${colorWord(g.playerColor)}) vs Adjutant (${colorWord(opponentColor)})`;
};
