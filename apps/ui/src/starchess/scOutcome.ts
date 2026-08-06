/**
 * Terminal outcome of a StarChess position, derived from king HP.
 *
 * // SPEC: _spec/apps/ui/starchess/resolve.puml
 *
 * HP is the single source of truth (it is already carried in the SCFEN wire
 * format), so there is no persisted winner field to drift out of sync. A draw is
 * reachable because face-to-face kings chip each other simultaneously: equal HP
 * drains to 0/0 in the same resolve pass.
 */

import type { ScFenSnapshot, StarChessColor } from "~/starchess/types";

export type ScOutcome =
  | { winner: StarChessColor; draw?: false }
  | { winner: null; draw: true };

/**
 * The outcome of `snap`, or `null` while play continues.
 * Both kings at 0 ⇒ draw; exactly one at 0 ⇒ the other side wins.
 */
export const scOutcome = (snap: {
  kingLives: ScFenSnapshot["kingLives"];
}): ScOutcome | null => {
  const dead = { w: snap.kingLives.w <= 0, b: snap.kingLives.b <= 0 };
  if (dead.w && dead.b) return { winner: null, draw: true };
  if (dead.w) return { winner: "b" };
  if (dead.b) return { winner: "w" };
  return null;
};
