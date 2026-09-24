// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Plan simulation — what the board looks like after a candidate resolves.
 *
 * Used for exactly one question the strategies cannot answer on their own:
 * does this plan leave our Command Center (CC) off every chip-capable ray?
 */

import type { Square } from "chess.js";

import {
  findCC,
  isSquareAttackedBy,
  mapToPlacement,
  type ScPiece,
} from "../../board/placement";
import { rewriteClassicalAfterB } from "../../resolve/submit-turn";
import { charonStrikeTarget } from "../../rules/specials/mechaCharon";
import type { PieceColor, ScAction, ScActionInput } from "../../model/types";

/**
 * Occupancy after one action resolves. Actions that do not move or remove a
 * unit (spiderMine / siegeMode) leave the board unchanged.
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

  if (action.kind === "deploy") {
    const unit = "unit" in action ? action.unit : undefined;
    if (unit) next.set(to, { type: unit, color: us });
    return next;
  }
  if (action.kind === "charonMissiles") {
    // Charon removes the aimed ship when it is the first ship on its ray —
    // which may be the checker. Fire-and-forget like the resolver.
    if (!charonStrikeTarget(next, action.from, to, action.color)) return next;
    next.delete(to);
    return next;
  }
  if (
    action.kind === "classical" ||
    action.kind === "stimStep" ||
    action.kind === "tacticalJump"
  ) {
    const piece = next.get(from);
    // A classical move onto a command center (CC) square is dropped: the mover stays put.
    if (!piece || (action.kind === "classical" && next.get(to)?.type === "k")) {
      return next;
    }
    // A sieged tank fires without relocating (the resolver refuses to move it),
    // so the victim dies but the tank keeps blocking its own square.
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
 * Marine stacks (B+C on the same vector) relocate twice — mid, then far.
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

/** True when the plan leaves our Command Center (CC) off every chip-capable attack ray. */
export const clearsCheck = (
  map: Map<Square, ScPiece>,
  actions: readonly ScActionInput[],
  sieged: ReadonlySet<Square>,
  us: PieceColor,
  enemy: PieceColor,
): boolean => {
  const after = simulatePlan(map, actions, sieged, us);
  const commandCenter = findCC(after, us);
  return !!commandCenter && !isSquareAttackedBy(after, commandCenter, enemy);
};
