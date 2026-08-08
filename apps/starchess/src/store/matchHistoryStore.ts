/**
 * Finished StarChess matches — DualNav replay packages in localStorage.
 * Coach uses chess_coach_game_history; this key is StarChess-only.
 */
import {
  formatScFen,
  parseScFen,
  type EndScTurnResult,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import { createPersistedStore } from "~/store/createPersistedStore";
import type { BoardVariant } from "~/types/board";
import type { MatchState } from "~/types/match";
import type {
  StarChessGameRecord,
  StarChessMatchResult,
} from "~/types/review";

export type { StarChessGameRecord, StarChessMatchResult };

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
    playerName: opts.playerName,
    scfens: snaps.map((s) => formatScFen(s)),
    resolves: [...match.settledResolves],
  };
};

export const addMatchRecord = (record: StarChessGameRecord): void => {
  const without = state.games.filter((g) => g.id !== record.id);
  setState("games", [record, ...without].slice(0, MAX_GAMES));
};

/** Rebuild DualNav snaps from a persisted record. */
export const historyFromRecord = (
  record: StarChessGameRecord,
): { settledSnapshots: ScFenSnapshot[]; settledResolves: EndScTurnResult[] } => {
  const settledSnapshots = record.scfens.map((s) => parseScFen(s));
  return {
    settledSnapshots,
    settledResolves: record.resolves,
  };
};
