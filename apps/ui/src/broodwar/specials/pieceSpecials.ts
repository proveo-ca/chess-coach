import type { PieceSymbol, Square } from "chess.js";

import { specialCopyFor, type SpecialCopy } from "~/broodwar/primitives/specialCopy";
import type { SpecialKind } from "~/broodwar/types";
import type { GasDeployTarget } from "~/broodwar/features/GasDeploy";

/**
 * Per-piece special metadata. Activation lives in piece hooks
 * (`useCommandCenterDeploy`, `useVultureSpiderMine`, …) — not in Storybook stories.
 */
export type PieceSpecialDef = {
  piece: PieceSymbol;
  kind: SpecialKind | null;
  copy: SpecialCopy;
};

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
  Record<PieceSymbol, (ctx: { square: Square; piece: PieceSymbol }) => void>
>;

/**
 * Routes a GasDeploy commit to the matching piece special activator.
 * Gas is already spent by GasDeploy before this runs.
 */
export const armPieceSpecial = (
  target: GasDeployTarget,
  handlers: PieceSpecialArmHandlers,
): boolean => {
  const def = pieceSpecialDef(target.piece);
  if (!def.copy.deployable) return false;
  const fn = handlers[target.piece];
  if (!fn) return false;
  fn({ square: target.square, piece: target.piece });
  return true;
};
