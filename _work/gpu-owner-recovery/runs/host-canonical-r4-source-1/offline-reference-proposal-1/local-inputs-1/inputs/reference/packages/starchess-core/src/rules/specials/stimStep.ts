// SPEC: _spec/packages/starchess-core/sc-moves.puml, _spec/packages/starchess-core/turn-queue-sequence.puml
import type { Square } from "../../model/square";
import type { StarChessColor } from "../../model/types";

/** One square forward for a Marine, or null if off-board. */
export const marineSingleTarget = (
  square: Square,
  color: StarChessColor,
): Square | null => {
  const file = square[0]!;
  const rank = Number(square[1]);
  const dest = color === "w" ? rank + 1 : rank - 1;
  if (dest < 1 || dest > 8) return null;
  return `${file}${dest}` as Square;
};

/**
 * Rank eligibility for the free classical double.
 *
 * Positional, not historical — a marine deployed onto rank 2 gets the double
 * having never “started” there. Marines can also be deployed onto their own
 * back rank (the Command Center ring reaches d1/f1 from a Command Center on e1), so the
 * band extends behind the start rank: denying it there would tax deploying
 * behind the Command Center with a lost tempo that no rule expresses.
 *
 * Sole owner of this rule. Move generation, shape validation and the
 * classical-after-B rewrite all read it — they must never disagree, or the
 * board offers a double the resolver refuses to land.
 */
export const canMarineDoubleStep = (
  square: Square,
  color: StarChessColor,
): boolean => {
  const rank = Number(square[1]);
  return color === "w" ? rank <= 2 : rank >= 7;
};
