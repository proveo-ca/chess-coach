/**
 * Cumulative fog — union of friendly-unit vision; mines light their own square.
 * Rules-side only (no SVG / animation). SCFEN placement maps are authoritative —
 * chess.js FEN load is never consulted.
 * // SPEC: _spec/apps/ui/starchess/starchess-mode.puml, _spec/apps/ui/starchess/resolve.puml
 */
import type { Square } from "chess.js";

import { placementToMap, type ScPiece } from "./placement";
import { rayBetween } from "./mines";
import type { RookMode, StarChessColor } from "../model/types";

const FILES = "abcdefgh";

const squareAt = (file: number, rank: number): Square | null => {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}` as Square;
};

const addSquare = (visible: Set<Square>, file: number, rank: number) => {
  const square = squareAt(file, rank);
  if (square) visible.add(square);
};

const addRectangle = (
  visible: Set<Square>,
  sourceFile: number,
  sourceRank: number,
  radius: number,
) => {
  for (let fileOffset = -radius; fileOffset <= radius; fileOffset++) {
    for (let rankOffset = -radius; rankOffset <= radius; rankOffset++) {
      addSquare(visible, sourceFile + fileOffset, sourceRank + rankOffset);
    }
  }
};

/** Axis-aligned N×N vision centered on the unit (even N leans +file/+rank). */
const addSquareGrid = (
  visible: Set<Square>,
  sourceFile: number,
  sourceRank: number,
  size: number,
) => {
  const half = (size - 1) / 2;
  const minOffset = -Math.floor(half);
  const maxOffset = Math.ceil(half);
  for (let fileOffset = minOffset; fileOffset <= maxOffset; fileOffset++) {
    for (let rankOffset = minOffset; rankOffset <= maxOffset; rankOffset++) {
      addSquare(visible, sourceFile + fileOffset, sourceRank + rankOffset);
    }
  }
};

/**
 * Nerd fog vision for one unit.
 * `litSquares` clear fog; `revealedPieces` show units through fog without lighting the tile.
 */
export type NerdVision = {
  litSquares: ReadonlySet<Square>;
  revealedPieces: ReadonlySet<Square>;
};

/**
 * Occupancy for fog math. Prefer SCFEN placement / piece maps.
 * Duck-typed `{ fen() }` (e.g. chess.js Chess) is accepted only as a convenience
 * adapter for legacy callers — never as a legality oracle.
 */
export type VisionBoard =
  | ReadonlyMap<Square, ScPiece>
  | string
  | { fen: () => string };

/** Normalize any {@link VisionBoard} into a mutable occupancy map. */
export function visionMap(board: VisionBoard): Map<Square, ScPiece> {
  if (typeof board === "string") return placementToMap(board);
  if (board instanceof Map) return board;
  const duck = board as { fen?: () => string };
  if (typeof duck.fen === "function") {
    return placementToMap(duck.fen().split(/\s+/)[0]!);
  }
  return new Map(board as ReadonlyMap<Square, ScPiece>);
}

/**
 * Returns fog-cleared tiles and any pieces revealed through fog for one unit.
 * Vision is geometric: pieces do not block it.
 *
 * Rook (Siege Tank) vision depends on mode at `source`:
 * - `tank` (default): bishop-sized 5×5
 * - `siege`: 9×9 (immobile — enforced by the board, not here)
 */
export function getNerdVision(
  board: VisionBoard,
  source: Square | null,
  opts?: { rookModeFor?: (square: Square) => RookMode },
): NerdVision {
  const map = visionMap(board);
  const litSquares = new Set<Square>();
  const revealedPieces = new Set<Square>();
  if (!source) return { litSquares, revealedPieces };

  const piece = map.get(source);
  if (!piece) return { litSquares, revealedPieces };

  const sourceFile = FILES.indexOf(source[0]!);
  const sourceRank = Number(source[1]);

  switch (piece.type) {
    case "k":
      addRectangle(litSquares, sourceFile, sourceRank, 1);
      break;

    case "p": {
      litSquares.add(source);
      const direction = piece.color === "w" ? 1 : -1;
      for (const fileOffset of [-1, 0, 1]) {
        addSquare(litSquares, sourceFile + fileOffset, sourceRank + direction);
      }
      addSquare(litSquares, sourceFile, sourceRank + direction * 2);
      break;
    }

    case "n":
      for (let fileOffset = -2; fileOffset <= 2; fileOffset++) {
        for (let rankOffset = -2; rankOffset <= 2; rankOffset++) {
          const corner = Math.abs(fileOffset) === 2 && Math.abs(rankOffset) === 2;
          const borderMiddle =
            (fileOffset === 0 && Math.abs(rankOffset) === 2) ||
            (rankOffset === 0 && Math.abs(fileOffset) === 2);
          if (!corner && !borderMiddle) {
            addSquare(litSquares, sourceFile + fileOffset, sourceRank + rankOffset);
          }
        }
      }
      break;

    case "b":
      addRectangle(litSquares, sourceFile, sourceRank, 2);
      for (const [square, occ] of map) {
        // Queen ping: show the unit through fog, but keep its tile darkened.
        if (occ.type === "q" && !litSquares.has(square)) {
          revealedPieces.add(square);
        }
      }
      break;

    case "r": {
      // Tank: 5×5 (same as bishop). Siege: 9×9.
      const mode = opts?.rookModeFor?.(source) ?? "tank";
      if (mode === "siege") {
        addSquareGrid(litSquares, sourceFile, sourceRank, 9);
      } else {
        addRectangle(litSquares, sourceFile, sourceRank, 2);
      }
      break;
    }

    case "q":
      addSquareGrid(litSquares, sourceFile, sourceRank, 7);
      break;
  }

  return { litSquares, revealedPieces };
}

/**
 * Cumulative fog vision for one side: union of every friendly unit's vision.
 * Empty army ⇒ empty sets (full fog). Kingless / odd SCFEN placements still work —
 * chess.js FEN validation is never applied.
 */
export function getSideVision(
  board: VisionBoard,
  color: StarChessColor,
  opts?: {
    rookModeFor?: (square: Square) => RookMode;
    mines?: readonly { at: Square; color: StarChessColor }[];
  },
): NerdVision {
  const map = visionMap(board);
  const litSquares = new Set<Square>();
  const revealedPieces = new Set<Square>();

  for (const [square, piece] of map) {
    if (piece.color !== color) continue;
    const unit = getNerdVision(map, square, opts);
    for (const lit of unit.litSquares) litSquares.add(lit);
    for (const rev of unit.revealedPieces) revealedPieces.add(rev);
  }

  for (const mine of opts?.mines ?? []) {
    if (mine.color === color) litSquares.add(mine.at);
  }

  for (const square of litSquares) revealedPieces.delete(square);

  return { litSquares, revealedPieces };
}

/** Fog-cleared tiles only (excludes bishop queen-pings that stay under fog). */
export function getNerdVisibleSquares(
  board: VisionBoard,
  source: Square | null,
  opts?: { rookModeFor?: (square: Square) => RookMode },
): ReadonlySet<Square> {
  return getNerdVision(board, source, opts).litSquares;
}

export type PathVisionOpts = {
  rookModeFor?: (square: Square) => RookMode;
  mines?: readonly { at: Square; color: StarChessColor }[];
};

/**
 * resolve.puml — after walking each intermediate on `from→intentTo`, does side
 * vision (with the mover on that square) light or reveal `target`?
 */
export function pathRevealsTarget(
  placement: string,
  from: Square,
  intentTo: Square,
  viewer: StarChessColor,
  target: Square,
  opts?: PathVisionOpts,
): boolean {
  return pathRevealSteps(placement, from, intentTo, viewer, target, opts) != null;
}

/**
 * How many ray intermediates must the mover reach before `target` is lit/revealed?
 * `null` = never along this path. `0` = already visible with the mover on `from`
 * (caller usually checks start vision separately).
 */
export function pathRevealSteps(
  placement: string,
  from: Square,
  intentTo: Square,
  viewer: StarChessColor,
  target: Square,
  opts?: PathVisionOpts,
): number | null {
  const mids = rayBetween(from, intentTo);
  if (mids.length === 0) return null;
  const base = placementToMap(placement);
  const piece = base.get(from);
  if (!piece || piece.color !== viewer) return null;

  for (let i = 0; i < mids.length; i++) {
    const mid = mids[i]!;
    const board = new Map(base);
    board.delete(from);
    board.set(mid, piece);
    const v = getSideVision(board, viewer, opts);
    if (v.litSquares.has(target) || v.revealedPieces.has(target)) return i + 1;
  }
  return null;
}

/**
 * Player-facing fog gate (not engine legality).
 * Own pieces are always visible; enemies only on lit tiles or `revealedPieces`.
 */
export function isPieceVisibleToSide(
  board: VisionBoard,
  viewer: StarChessColor,
  square: Square,
  pieceColor: StarChessColor,
  opts?: { rookModeFor?: (square: Square) => RookMode },
): boolean {
  if (pieceColor === viewer) return true;
  const { litSquares, revealedPieces } = getSideVision(board, viewer, opts);
  return litSquares.has(square) || revealedPieces.has(square);
}

/**
 * Combat move-cue gate. A unit that attacked this resolve revealed its `from`
 * square for the shot; keep that reveal credit for its occupy/slide cue.
 */
export function isMoverVisibleToSide(
  board: VisionBoard,
  viewer: StarChessColor,
  move: { from: Square; color: StarChessColor },
  revealedFrom: ReadonlySet<Square>,
  opts?: { rookModeFor?: (square: Square) => RookMode },
): boolean {
  return (
    move.color === viewer ||
    revealedFrom.has(move.from) ||
    isPieceVisibleToSide(board, viewer, move.from, move.color, opts)
  );
}
