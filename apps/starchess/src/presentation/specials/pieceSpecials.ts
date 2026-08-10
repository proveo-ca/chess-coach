import type { PieceSymbol, Square } from "chess.js";

import type { MatchStore } from "~/types/match";
import {
  canPawnDoubleFree,
  hasUsedSpecialThisTurn,
} from "~/app/matchEconomy";
import type { GasDeployTarget } from "~/types/specials";
import { specialCopyFor, type SpecialCopy } from "~/presentation/hud/specialCopy";
import type { ScSpecialKind } from "@chess-coach/starchess-core";

/**
 * Per-piece special metadata. Activation lives in piece hooks
 * (command center deploy, vulture mine, …) — not in Storybook stories.
 */
export type PieceSpecialDef = {
  piece: PieceSymbol;
  kind: ScSpecialKind | null;
  copy: SpecialCopy;
};

/** Handler outcome — `free` / `pending` skip specials-used marking. */
export type ArmResult = false | "armed" | "free" | "pending";

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
  store: MatchStore,
  target: GasDeployTarget,
  handlers: PieceSpecialArmHandlers,
): boolean => {
  const def = pieceSpecialDef(target.piece);
  if (!def.copy.deployable) return false;
  const fn = handlers[target.piece];
  if (!fn) return false;

  const classicalFree =
    target.piece === "p" && canPawnDoubleFree(store, target.square);

  if (!classicalFree && hasUsedSpecialThisTurn(store, target.square)) return false;

  const result = fn({ square: target.square, piece: target.piece });
  if (result === false) return false;
  // `pending` = modal / targeting armed; mark when the action actually queues.
  if (result === "free" || result === "pending") return true;
  store.dispatch({ type: "MARK_SPECIAL_USED", square: target.square });
  return true;
};
