/**
 * Plan simulation — what the board looks like after a candidate resolves.
 *
 * Used for exactly one question the strategies cannot answer on their own:
 * does this plan leave our King off every chip-capable ray?
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/opponent-strategy.puml
 */

import type { Square } from "chess.js";

import {
  findKing,
  isSquareAttackedBy,
  mapToPlacement,
  type ScPiece,
} from "../../board/placement";
import { rewriteClassicalAfterB } from "../../resolve/submit-turn";
import type { PieceColor, ScAction, ScActionInput } from "../../model/types";

/**
 * Occupancy after one action resolves. Actions that do not move or remove a
 * unit (knightMine / rookSiege) leave the board unchanged.
 */
const simulateAction = (
  map: Map<Square, ScPiece>,
  action: ScActionInput,
  sieged: ReadonlySet<Square>,
  us: PieceColor,
): Map<Square, ScPiece> => {
  const next = new Map(map);
  const { from, to } = action;
  if (!to) return next;

  if (action.kind === "spawn") {
    const unit = "unit" in action ? action.unit : undefined;
    if (unit) next.set(to, { type: unit, color: us });
    return next;
  }
  if (action.kind === "bishopSnipe") {
    // Charon removes the target queen — which may be the checker.
    next.delete(to);
    return next;
  }
  if (
    action.kind === "classical" ||
    action.kind === "pawnDouble" ||
    action.kind === "queenWarp"
  ) {
    const piece = next.get(from);
    // A classical move onto a king square is dropped: the mover stays put.
    if (!piece || (action.kind === "classical" && next.get(to)?.type === "k")) {
      return next;
    }
    // A sieged rook fires without relocating (the resolver refuses to move it),
    // so the victim dies but the rook keeps blocking its own square.
    if (piece.type === "r" && sieged.has(from)) {
      next.delete(to);
      return next;
    }
    const promotion = "promotion" in action ? action.promotion : undefined;
    next.delete(from);
    next.set(to, { type: promotion ?? piece.type, color: piece.color });
    return next;
  }
  return next;
};

/**
 * Apply a candidate plan in resolve order.
 *
 * Pawn/queen stacks (B+C on the same vector) relocate twice — mid, then far.
 * That folding is `rewriteClassicalAfterB`'s job, and the simulation borrows it
 * verbatim so a plan we score can never land somewhere the resolver would not
 * put it (the rewrite also declines on a blocked landing and outside the
 * double-step band, which a hand-rolled shift misses).
 */
export const simulatePlan = (
  map: Map<Square, ScPiece>,
  actions: readonly ScActionInput[],
  sieged: ReadonlySet<Square>,
  us: PieceColor,
): Map<Square, ScPiece> => {
  let next = map;
  // `seq` is unused by the rewrite; index order is already resolve order here.
  const folded = rewriteClassicalAfterB(
    actions.map((a, seq) => ({ ...a, seq }) as ScAction),
    mapToPlacement(map),
  );
  for (const action of folded) {
    next = simulateAction(next, action, sieged, us);
  }
  return next;
};

/** True when the plan leaves our King off every chip-capable attack ray. */
export const clearsCheck = (
  map: Map<Square, ScPiece>,
  actions: readonly ScActionInput[],
  sieged: ReadonlySet<Square>,
  us: PieceColor,
  enemy: PieceColor,
): boolean => {
  const after = simulatePlan(map, actions, sieged, us);
  const king = findKing(after, us);
  return !!king && !isSquareAttackedBy(after, king, enemy);
};
