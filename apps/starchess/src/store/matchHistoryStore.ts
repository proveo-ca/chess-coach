// SPEC: _spec/apps/starchess/replay-import.puml
/**
 * Finished StarChess matches — DualNav replay packages in localStorage.
 * Coach uses chess_coach_game_history; this key is StarChess-only.
 * Single owner for decode is packages/starchess-core/src/replay/record.ts
 * (historyFromRecord / validateArenaRecord) — this module re-exports it.
 */
import {
  formatScFen,
  normalizeSnapGas,
  type ArenaGameRecord,
} from "@chess-coach/starchess-core";

import { createPersistedStore } from "~/store/createPersistedStore";
import type { BoardVariant } from "~/types/board";
import type { MatchState } from "~/types/match";
import type { AdjutantKind } from "~/types/newGame";
import type {
  StarChessGameRecord,
  StarChessMatchResult,
} from "~/types/review";
import { clampPlayerName } from "~/utils/playerName";

export type { StarChessGameRecord, StarChessMatchResult };
export type { ArenaGameRecord };

/** Shared CoreChamp decode — {scfens, resolves} → DualNav settled plies. */
export { historyFromRecord, validateArenaRecord } from "@chess-coach/starchess-core";

export const MATCH_HISTORY_KEY = "starchess_match_history";

type HistoryState = {
  games: StarChessGameRecord[];
};

const MAX_GAMES = 100;

const [state, setState] = createPersistedStore<HistoryState>(MATCH_HISTORY_KEY, {
  games: [],
});

export const matchHistory = () => state.games;

export const getMatchById = (id: string): StarChessGameRecord | null =>
  state.games.find((g) => g.id === id) ?? null;

export const makeMatchId = (): string =>
  `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const resultForPlayer = (
  state: MatchState,
): StarChessMatchResult | null => {
  const o = state.outcome;
  if (!o) return null;
  if (o.draw) return "draw";
  if (!o.winner) return "draw";
  return o.winner === state.playerColor ? "win" : "loss";
};

export const recordFromMatchState = (
  match: MatchState,
  opts: {
    id: string;
    startedAt: string;
    map: BoardVariant;
    playerName?: string;
    opponent?: AdjutantKind;
  },
): StarChessGameRecord | null => {
  const result = resultForPlayer(match);
  if (!result) return null;
  const snaps =
    match.settledSnapshots.length > 0
      ? match.settledSnapshots
      : [match.liveSnapshot];
  return {
    id: opts.id,
    startedAt: opts.startedAt,
    endedAt: new Date().toISOString(),
    result,
    map: opts.map,
    playerColor: match.playerColor,
    // Records outlive the settings value — clamp on the way in.
    playerName: clampPlayerName(opts.playerName),
    opponent: opts.opponent,
    scfens: snaps.map((s) => formatScFen(normalizeSnapGas(s))),
    resolves: [...match.settledResolves],
  };
};

export const addMatchRecord = (record: StarChessGameRecord): void => {
  const without = state.games.filter((g) => g.id !== record.id);
  setState("games", [record, ...without].slice(0, MAX_GAMES));
};

/**
 * Arena import → local history. Adapts ArenaGameRecord to StarChessGameRecord
 * for list display; both satisfy historyFromRecord structurally.
 */
export const addArenaRecord = (record: ArenaGameRecord): StarChessGameRecord => {
  const winner = record.outcome.winner;
  const playerColor = "w" as const;
  let result: StarChessMatchResult = "draw";
  if (record.outcome.draw) result = "draw";
  else if (winner === playerColor) result = "win";
  else if (winner) result = "loss";
  const adapted: StarChessGameRecord = {
    id: record.id,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    result,
    map: (record.map as StarChessGameRecord["map"]) ?? "eclipse",
    playerColor,
    arenaPlayers: { w: record.players.w, b: record.players.b },
    scfens: record.scfens,
    resolves: record.resolves as StarChessGameRecord["resolves"],
  };
  addMatchRecord(adapted);
  return adapted;
};
