// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Assembles every input variable the Adjutant reads from one SCFEN snapshot.
 *
 * Built once per planning turn, then treated as read-only. Strategies receive
 * this object and nothing else — if a strategy needs a new board fact, it is
 * derived here rather than recomputed inside the scoring pass.
 */

import type { Square } from "chess.js";

import {
  findKing,
  isSquareAttackedBy,
  placementToMap,
  type ScPiece,
} from "../../board/placement";
import type { PieceColor, ScFenSnapshot } from "../../model/types";
import { cloneWithMove, enemyOf } from "./geometry";
import { DEFAULT_RNG } from "./rng";
import { gatherKingIntel } from "./kingIntel";
import { buildMaterialIntel, estimateStoredFor } from "./material";
import { hasHubPresence, hubMineTaken } from "./mines";
import { WEIGHTS, resolvePosture } from "./posture";
import { buildTacticalBoard } from "./tactical";
import type { AdjutantContext, AdjutantCtx, Move, MoveEval } from "./types";
import { buildVisionIntel } from "./vision";

export * from "./types";
export * from "./rng";
export * from "./geometry";
export * from "./pawns";
export * from "./mines";
export { countType, estimateStoredFor } from "./material";
export { gatherKingIntel } from "./kingIntel";
export { buildTacticalBoard } from "./tactical";
export { WEIGHTS, resolvePosture } from "./posture";
export { buildVisionIntel } from "./vision";

/**
 * Build the planning context, or `null` when the board has no Command Center (CC) for us
 * (nothing to plan for — the caller returns the snapshot untouched).
 */
export const buildAdjutantCtx = (
  snap: ScFenSnapshot,
  ctx?: AdjutantContext,
): AdjutantCtx | null => {
  const us: PieceColor = ctx?.color ?? "b";
  const enemy = enemyOf(us);

  const map = placementToMap(snap.placement);
  const king = findKing(map, us);
  if (!king) return null;

  const storedFor = ctx?.storedFor ?? estimateStoredFor(snap, us);
  const sieged: ReadonlySet<Square> = new Set(snap.siegedRooks ?? []);
  const enemyKing = findKing(map, enemy);

  const vision = buildVisionIntel(snap, map, us, enemy, enemyKing, sieged);
  const hubHeld = hasHubPresence(map, us);
  const posture = resolvePosture(hubHeld, vision.enemyKingVisible);

  return {
    snap,
    map,
    us,
    enemy,
    king,
    enemyKing,
    // An adjacent enemy Command Center (CC) counts: face-to-face command centers (CCs) chip each other.
    kingThreatened: isSquareAttackedBy(map, king, enemy),
    sieged,
    gas: snap.gas[us],
    posture,
    weights: WEIGHTS[posture],
    vision,
    intel: gatherKingIntel(map, vision.litSquares, vision.revealedPieces, enemy),
    tactical: buildTacticalBoard(map, us, enemy, king, sieged),
    material: buildMaterialIntel(map, us, storedFor),
    hubHeld,
    hubMineTaken: hubMineTaken(snap, us),
    storedFor,
    rng: ctx?.rng ?? DEFAULT_RNG,
  };
};

/**
 * Wrap a move so the post-move board and its safety test are computed at most
 * once, however many strategies ask for them.
 */
export const evaluateMove = (
  move: Move,
  ctx: AdjutantCtx,
): MoveEval | null => {
  const piece = ctx.map.get(move.from);
  if (!piece) return null;

  let afterMap: Map<Square, ScPiece> | undefined;
  const after = () => (afterMap ??= cloneWithMove(ctx.map, move, ctx.sieged));

  let safe: boolean | undefined;
  const destSafe = () =>
    (safe ??= !isSquareAttackedBy(after(), move.to, ctx.enemy));

  return { move, piece, isKingMove: piece.type === "k", after, destSafe };
};
