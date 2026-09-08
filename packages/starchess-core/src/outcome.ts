// SPEC: _spec/packages/starchess-core/resolve.puml
import type { StarChessColor } from "./model/types";

export type { StarChessColor };

export type ScOutcome =
  | { winner: StarChessColor; draw?: false }
  | { winner: null; draw: true };

/**
 * Terminal outcome from king HP, or `null` while play continues.
 * Both kings at 0 ⇒ draw; exactly one at 0 ⇒ the other side wins.
 * At the engine turn cap (MAX_GAME_TURNS), HP decides win/loss/draw.
 */
export const scOutcome = (snap: {
  kingLives: Record<StarChessColor, number>;
  turn?: number;
}): ScOutcome | null => {
  const dead = { w: snap.kingLives.w <= 0, b: snap.kingLives.b <= 0 };
  if (dead.w && dead.b) return { winner: null, draw: true };
  if (dead.w) return { winner: "b", draw: false };
  if (dead.b) return { winner: "w", draw: false };
  // Engine cap: at turn 45, compare CC HP (kingLives) — higher HP wins, equal draw
  if (snap.turn != null && snap.turn >= 45) {
    if (snap.kingLives.w > snap.kingLives.b) return { winner: "w", draw: false };
    if (snap.kingLives.b > snap.kingLives.w) return { winner: "b", draw: false };
    return { winner: null, draw: true };
  }
  return null;
};
