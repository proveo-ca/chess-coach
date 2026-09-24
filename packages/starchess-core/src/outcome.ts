// SPEC: _spec/packages/starchess-core/resolve.puml
import type { StarChessColor } from "./model/types";

export type { StarChessColor };

export type ScOutcome =
  | { winner: StarChessColor; draw?: false }
  | { winner: null; draw: true };

/**
 * Terminal outcome from Command Center HP, or `null` while play continues.
 * Both Command Centers at 0 ⇒ draw; exactly one at 0 ⇒ the other side wins.
 * At the engine turn cap (MAX_GAME_TURNS), HP decides win/loss/draw.
 */
export const scOutcome = (snap: {
  ccLives: Record<StarChessColor, number>;
  turn?: number;
}): ScOutcome | null => {
  const dead = { w: snap.ccLives.w <= 0, b: snap.ccLives.b <= 0 };
  if (dead.w && dead.b) return { winner: null, draw: true };
  if (dead.w) return { winner: "b", draw: false };
  if (dead.b) return { winner: "w", draw: false };
  // Engine cap: at turn 45, compare CC HP (ccLives) — higher HP wins, equal draw
  if (snap.turn != null && snap.turn >= 45) {
    if (snap.ccLives.w > snap.ccLives.b) return { winner: "w", draw: false };
    if (snap.ccLives.b > snap.ccLives.w) return { winner: "b", draw: false };
    return { winner: null, draw: true };
  }
  return null;
};
