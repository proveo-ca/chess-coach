/**
 * Human-readable labels for StarChess matches (live Single + Review detail).
 * Mirrors Coach `formatGameLabel` / result line — Blue/Red · Adjutant.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import { ADJUTANT_DEFINITIONS, type StarChessColor } from "@chess-coach/starchess-core";

import type { AdjutantKind } from "~/types/newGame";
import type { StarChessGameRecord, StarChessMatchResult } from "~/types/review";
import { displayPlayerName } from "~/utils/playerName";

const colorWord = (c: StarChessColor): string => (c === "w" ? "Blue" : "Red");

const resultWord = (r: StarChessMatchResult): string =>
  r.charAt(0).toUpperCase() + r.slice(1);

/** Opponent script as the New Game modal names it. */
export const adjutantKindLabel = (kind: AdjutantKind): string =>
  ADJUTANT_DEFINITIONS.find((definition) => definition.id === kind)!.label;

/** Live `/single` header — reflects the opponent chosen in New Game setup. */
export const liveAdjutantMatchTitle = (kind: AdjutantKind): string =>
  `Game vs ${adjutantKindLabel(kind)}`;

/** @deprecated Use {@link liveAdjutantMatchTitle} — this cannot name the strategic script. */
export const LIVE_ADJUTANT_MATCH_TITLE = liveAdjutantMatchTitle("naive");

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
  // Records written before the opponent was selectable carry no script.
  const opponent = g.opponent ? adjutantKindLabel(g.opponent) : "Adjutant";
  return `${player} (${colorWord(g.playerColor)}) vs ${opponent} (${colorWord(opponentColor)})`;
};
