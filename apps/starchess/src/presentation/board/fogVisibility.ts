// SPEC: _spec/apps/starchess/core/board/planning-projection.puml, _spec/apps/starchess/architecture/board-entities.puml
/**
 * Sole app fog-visibility predicate for planning projections.
 * Matches core submit-turn isTargetVisible (lit ∪ revealed for a side).
 */
import type { Square } from "chess.js";
import {
  getSideVision,
  isPieceVisibleToSide,
  type ScMine,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { rookModeForSieged } from "~/presentation/board/rookMode";

export type FogVisionOpts = {
  siegedRooks?: readonly Square[];
  mines?: readonly ScMine[];
};

const visionOpts = (opts?: FogVisionOpts) => ({
  rookModeFor: rookModeForSieged(opts?.siegedRooks ?? []),
  mines: opts?.mines ? [...opts.mines] : undefined,
});

/**
 * Can `side` see `square` (lit or revealed)? Same rule as engine check fog.
 * Used by intent check rings via collectLegalKingChecks.isTargetVisible.
 */
export const isSquareVisibleToSide = (
  placement: string,
  side: StarChessColor,
  square: Square,
  opts?: FogVisionOpts,
): boolean => {
  const v = getSideVision(placement, side, visionOpts(opts));
  return v.litSquares.has(square) || v.revealedPieces.has(square);
};

/** Factory matching collectLegalKingChecks `isTargetVisible(color, square)`. */
export const targetVisibleGate = (placement: string, opts?: FogVisionOpts) => {
  const vo = visionOpts(opts);
  const visionW = getSideVision(placement, "w", vo);
  const visionB = getSideVision(placement, "b", vo);
  return (color: StarChessColor, square: Square) => {
    const v = color === "w" ? visionW : visionB;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };
};

/**
 * Mines `viewer` may act on: own mines always, hostile mines only while their
 * tile is lit / revealed — the same gate the engine attack phase uses, so the
 * "attack the mine" affordance never reveals a mine the viewer cannot see.
 * `fog: false` (observer / fog-off gallery) keeps every mine.
 * // SPEC: _spec/packages/starchess-core/resolve.puml
 */
export const minesVisibleToViewer = (
  placement: string,
  viewer: StarChessColor,
  mines: readonly ScMine[] | undefined,
  fog: boolean,
  opts?: FogVisionOpts,
): ScMine[] => {
  const all = mines ? [...mines] : [];
  if (!fog || all.length === 0) return all;
  const gate = targetVisibleGate(placement, { ...opts, mines: all });
  return all.filter((m) => m.color === viewer || gate(viewer, m.at));
};

/**
 * Piece-on-square gate (occupancy / FX) — core isPieceVisibleToSide + shared rook mode.
 */
export const pieceVisibleToViewer = (
  placement: string,
  viewer: StarChessColor,
  square: Square,
  pieceColor: StarChessColor,
  opts?: FogVisionOpts,
): boolean =>
  isPieceVisibleToSide(placement, viewer, square, pieceColor, visionOpts(opts));
