// SPEC: _spec/game-core.puml
import type { StarChessColor } from "./types";
import { MAX_GAME_TURNS } from "./constants";

export type ScOutcome =
  | { winner: StarChessColor; draw?: false }
  | { winner: null; draw: true };

export const scOutcome = (snap: { ccLives: Record<StarChessColor, number>; turn?: number }): ScOutcome | null => {
  const dead = { w: snap.ccLives.w <= 0, b: snap.ccLives.b <= 0 };
  if (dead.w && dead.b) return { winner: null, draw: true };
  if (dead.w) return { winner: "b", draw: false };
  if (dead.b) return { winner: "w", draw: false };
  if (snap.turn != null && snap.turn >= MAX_GAME_TURNS) {
    if (snap.ccLives.w > snap.ccLives.b) return { winner: "w", draw: false };
    if (snap.ccLives.b > snap.ccLives.w) return { winner: "b", draw: false };
    return { winner: null, draw: true };
  }
  return null;
};
