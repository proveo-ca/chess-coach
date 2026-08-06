// SPEC: _spec/apps/ui/starchess/resolve.puml
import type { StarChessColor } from "./model/types";

export type { StarChessColor };

export type ScOutcome =
  | { winner: StarChessColor; draw?: false }
  | { winner: null; draw: true };

/**
 * Terminal outcome from king HP, or `null` while play continues.
 * Both kings at 0 ⇒ draw; exactly one at 0 ⇒ the other side wins.
 */
export const scOutcome = (snap: {
  kingLives: Record<StarChessColor, number>;
}): ScOutcome | null => {
  const dead = { w: snap.kingLives.w <= 0, b: snap.kingLives.b <= 0 };
  if (dead.w && dead.b) return { winner: null, draw: true };
  if (dead.w) return { winner: "b" };
  if (dead.b) return { winner: "w" };
  return null;
};
