// SPEC: _spec/game-core.puml
import type { ScMine, ScPiece, Square, StarChessColor, TankMode } from "./types";
import { parseSquare, placementToMap, sq } from "./board";
import { rayBetween } from "./mines";

export type SideVision = { litSquares: ReadonlySet<Square>; revealedPieces: ReadonlySet<Square> };
export type VisionBoard = ReadonlyMap<Square, ScPiece> | string;
export type VisionOptions = { tankModeFor?: (square: Square) => TankMode; mines?: readonly ScMine[] };

export const visionMap = (board: VisionBoard): Map<Square, ScPiece> =>
  typeof board === "string" ? placementToMap(board) : board instanceof Map ? board : new Map(board);

export function getUnitVision(board: VisionBoard, source: Square | null, opts?: VisionOptions): SideVision {
  const map = visionMap(board);
  const litSquares = new Set<Square>();
  const revealedPieces = new Set<Square>();
  const piece = source ? map.get(source) : undefined;
  if (!source || !piece) return { litSquares, revealedPieces };
  const { file, rank } = parseSquare(source);
  const add = (df: number, dr: number): void => {
    const at = sq(file + df, rank + dr);
    if (at) litSquares.add(at);
  };
  const grid = (radius: number): void => {
    for (let df = -radius; df <= radius; df++) {
      for (let dr = -radius; dr <= radius; dr++) add(df, dr);
    }
  };
  switch (piece.type) {
    case "k": grid(1); break;
    case "p": {
      litSquares.add(source);
      const dir = piece.color === "w" ? 1 : -1;
      for (const df of [-1, 0, 1]) add(df, dir);
      add(0, 2 * dir);
      break;
    }
    case "n":
      for (let df = -2; df <= 2; df++) {
        for (let dr = -2; dr <= 2; dr++) {
          const corner = Math.abs(df) === 2 && Math.abs(dr) === 2;
          const middle = (df === 0 && Math.abs(dr) === 2) || (dr === 0 && Math.abs(df) === 2);
          if (!corner && !middle) add(df, dr);
        }
      }
      break;
    case "b":
      grid(2);
      for (const [at, occupant] of map) {
        if (occupant.type === "q" && !litSquares.has(at)) revealedPieces.add(at);
      }
      break;
    case "r": grid(opts?.tankModeFor?.(source) === "siege" ? 4 : 2); break;
    case "q": grid(3); break;
  }
  return { litSquares, revealedPieces };
}

export function getSideVision(board: VisionBoard, color: StarChessColor, opts?: VisionOptions): SideVision {
  const map = visionMap(board);
  const litSquares = new Set<Square>();
  const revealedPieces = new Set<Square>();
  for (const [at, piece] of map) {
    if (piece.color !== color) continue;
    const unit = getUnitVision(map, at, opts);
    for (const lit of unit.litSquares) litSquares.add(lit);
    for (const revealed of unit.revealedPieces) revealedPieces.add(revealed);
  }
  for (const mine of opts?.mines ?? []) {
    if (mine.color === color) litSquares.add(mine.at);
  }
  for (const at of litSquares) revealedPieces.delete(at);
  return { litSquares, revealedPieces };
}

export type PathQueryTap = { step: (mid: Square, visible: boolean) => void; returned: (value: number | null) => void };

export function pathRevealStepsKernel(
  placement: string, from: Square, intentTo: Square, viewer: StarChessColor, target: Square,
  opts?: VisionOptions, tap?: PathQueryTap,
): number | null {
  const returned = (value: number | null): number | null => { tap?.returned(value); return value; };
  const mids = rayBetween(from, intentTo);
  if (mids.length === 0) return returned(null);
  const base = placementToMap(placement);
  const piece = base.get(from);
  if (!piece || piece.color !== viewer) return returned(null);
  for (let i = 0; i < mids.length; i++) {
    const mid = mids[i]!;
    const board = new Map(base);
    board.delete(from);
    board.set(mid, piece);
    const vision = getSideVision(board, viewer, opts);
    const visible = vision.litSquares.has(target) || vision.revealedPieces.has(target);
    tap?.step(mid, visible);
    if (visible) return returned(i + 1);
  }
  return returned(null);
}

export const pathRevealSteps = (
  placement: string, from: Square, intentTo: Square, viewer: StarChessColor, target: Square, opts?: VisionOptions,
): number | null => pathRevealStepsKernel(placement, from, intentTo, viewer, target, opts);

export const pathRevealsTarget = (
  placement: string, from: Square, intentTo: Square, viewer: StarChessColor, target: Square, opts?: VisionOptions,
): boolean => pathRevealSteps(placement, from, intentTo, viewer, target, opts) !== null;

export const isPieceVisibleToSide = (
  board: VisionBoard, viewer: StarChessColor, square: Square, pieceColor: StarChessColor, opts?: VisionOptions,
): boolean => {
  if (pieceColor === viewer) return true;
  const vision = getSideVision(board, viewer, opts);
  return vision.litSquares.has(square) || vision.revealedPieces.has(square);
};

export const isMoverVisibleToSide = (
  board: VisionBoard, viewer: StarChessColor, move: { from: Square; color: StarChessColor },
  revealedFrom: ReadonlySet<Square>, opts?: VisionOptions,
): boolean => move.color === viewer || revealedFrom.has(move.from) || isPieceVisibleToSide(board, viewer, move.from, move.color, opts);
