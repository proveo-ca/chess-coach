import type { PieceSymbol, Square } from "chess.js";

import type { MatchStore } from "~/types/match";
import { hasUsedSpecialThisTurn } from "~/app/matchEconomy";
import type { GasDeployTarget, ArmResult } from "~/presentation/specials/types";
import { specialCopyFor, type SpecialCopy } from "~/presentation/specials/copy";
import type { ScSpecialKind } from "@chess-coach/starchess-core";

/**
 * Per-piece special metadata. Activation lives in piece hooks
 * (command center deploy, hoverbike mine, …) — not in Storybook stories.
 */
export type PieceSpecialDef = {
  piece: PieceSymbol;
  kind: ScSpecialKind | null;
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
  Record<PieceSymbol, (ctx: { square: Square; piece: PieceSymbol }) => ArmResult | boolean | void>
>;

/**
 * Routes a GasDeploy commit to the matching piece special activator.
 * `armed` / `true` / `void` marks the square. `false` aborts.
 */
export const armPieceSpecial = (
  store: MatchStore,
  target: GasDeployTarget,
  handlers: PieceSpecialArmHandlers,
): boolean => {
  const def = pieceSpecialDef(target.piece);
  if (!def.copy.deployable) return false;
  const fn = handlers[target.piece];
  if (!fn) return false;

  // One special per unit per turn, no exceptions — the engine refuses a stacked
  // queue anyway (`assertQueueShape`); this keeps the HUD from offering it.
  if (hasUsedSpecialThisTurn(store, target.square)) return false;

  const result = fn({ square: target.square, piece: target.piece });
  if (result === false) return false;
  // `pending` = modal / targeting armed; mark when the action actually queues.
  if (result === "pending") return true;
  store.dispatch({ type: "MARK_SPECIAL_USED", square: target.square });
  return true;
};
