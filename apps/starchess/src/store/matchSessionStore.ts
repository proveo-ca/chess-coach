/**
 * Persist live StarChess match for refresh resume — SCFEN + map + human team.
 */
import { formatScFen, type StarChessColor } from "@chess-coach/starchess-core";

import type { BoardVariant } from "~/types/board";
import type { MatchState } from "~/types/match";

export const MATCH_SESSION_KEY = "starchess_match_session";

export type MatchSessionBlob = {
  v: 1;
  id: string;
  startedAt: string;
  scfen: string;
  map: BoardVariant;
  playerColor: StarChessColor;
  economies: {
    w: { stored: number; deployed: number };
    b: { stored: number; deployed: number };
  };
};

export const matchSessionFromState = (
  state: MatchState,
  map: BoardVariant,
  meta: { id: string; startedAt: string },
): MatchSessionBlob => ({
  v: 1,
  id: meta.id,
  startedAt: meta.startedAt,
  scfen: formatScFen(state.liveSnapshot),
  map,
  playerColor: state.playerColor,
  economies: {
    w: { ...state.economies.w },
    b: { ...state.economies.b },
  },
});

export const saveMatchSession = (blob: MatchSessionBlob): void => {
  try {
    localStorage.setItem(MATCH_SESSION_KEY, JSON.stringify(blob));
  } catch (e) {
    console.error("Failed to save StarChess match session", e);
  }
};

export const loadMatchSession = (): MatchSessionBlob | null => {
  try {
    const raw = localStorage.getItem(MATCH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MatchSessionBlob;
    if (parsed?.v !== 1 || typeof parsed.scfen !== "string") return null;
    if (parsed.playerColor !== "w" && parsed.playerColor !== "b") return null;
    if (typeof parsed.id !== "string" || typeof parsed.startedAt !== "string") {
      return null;
    }
    return parsed;
  } catch (e) {
    console.error("Failed to load StarChess match session", e);
    return null;
  }
};

export const clearMatchSession = (): void => {
  try {
    localStorage.removeItem(MATCH_SESSION_KEY);
  } catch (e) {
    console.error("Failed to clear StarChess match session", e);
  }
};
