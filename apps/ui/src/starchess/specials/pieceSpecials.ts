import type { PieceSymbol, Square } from "chess.js";

import { hasUsedSpecialThisTurn, markSpecialUsed } from "~/starchess/starChessStore";
import { specialCopyFor, type SpecialCopy } from "~/starchess/primitives/specialCopy";
import type { SpecialKind } from "~/starchess/types";
import type { GasDeployTarget } from "~/starchess/features/GasDeploy";
import { canClassicalPawnDouble } from "~/starchess/specials/pawnDouble";
import { currentFen } from "~/store/gameStore";

/**
 * Per-piece special metadata. Activation lives in piece hooks
 * (`useCommandCenterDeploy`, `useVultureSpiderMine`, …) — not in Storybook stories.
 */
export type PieceSpecialDef = {
  piece: PieceSymbol;
  kind: SpecialKind | null;
  copy: SpecialCopy;
};

/** Handler outcome — `free` skips specials-used / once-per-turn marking. */
export type ArmResult = false | "armed" | "free";

const DEFS: Record<PieceSymbol, PieceSpecialDef> = {
  p: { piece: "p", kind: "pawnDouble", copy: specialCopyFor("p") },
  n: { piece: "n", kind: "knightMine", copy: specialCopyFor("n") },
  b: { piece: "b", kind: "bishopSnipe", copy: specialCopyFor("b") },
  r: { piece: "r", kind: "rookSiege", copy: specialCopyFor("r") },
  q: { piece: "q", kind: "queenWarp", copy: specialCopyFor("q") },
  k: { piece: "k", kind: "spawn", copy: specialCopyFor("k") },
};

export const pieceSpecialDef = (piece: PieceSymbol): PieceSpecialDef => DEFS[piece];

export type PieceSpecialArmHandlers = Partial<
  Record<PieceSymbol, (ctx: { square: Square; piece: PieceSymbol }) => ArmResult | boolean | void>
>;

/**
 * Routes a GasDeploy commit to the matching piece special activator.
 * `free` (e.g. classical pawn double) does not mark specials-used.
 * `armed` / `true` / `void` marks the square. `false` aborts.
 */
export const armPieceSpecial = (
  target: GasDeployTarget,
  handlers: PieceSpecialArmHandlers,
): boolean => {
  const def = pieceSpecialDef(target.piece);
  if (!def.copy.deployable) return false;
  const fn = handlers[target.piece];
  if (!fn) return false;

  const classicalFree =
    target.piece === "p" && canClassicalPawnDouble(currentFen(), target.square);

  if (!classicalFree && hasUsedSpecialThisTurn(target.square)) return false;

  const result = fn({ square: target.square, piece: target.piece });
  if (result === false) return false;
  if (result === "free") return true;
  // "armed" | true | void
  markSpecialUsed(target.square);
  return true;
};

export { markSpecialUsed, hasUsedSpecialThisTurn };
