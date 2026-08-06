/**
 * Cumulative fog — union of friendly-unit vision; mines light their own square.
 * Rules-side only (no SVG / animation). Display helpers stay in apps/ui vision.ts.
 * // SPEC: _spec/apps/ui/starchess/starchess-mode.puml, _spec/apps/ui/starchess/resolve.puml
 */
import { Chess, type Color, type Square } from "chess.js";

import { mapToPlacement, placementToMap } from "./placement";
import { rayBetween } from "./mines";
import type { RookMode } from "../model/types";

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
 * Returns fog-cleared tiles and any pieces revealed through fog for one unit.
 * Vision is geometric: pieces do not block it.
 *
 * Rook (Siege Tank) vision depends on mode at `source`:
 * - `tank` (default): bishop-sized 5×5
 * - `siege`: 9×9 (immobile — enforced by the board, not here)
 */
export function getNerdVision(
  game: Chess,
  source: Square | null,
  opts?: { rookModeFor?: (square: Square) => RookMode },
): NerdVision {
  const litSquares = new Set<Square>();
  const revealedPieces = new Set<Square>();
  if (!source) return { litSquares, revealedPieces };

  const piece = game.get(source);
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
      for (let file = 0; file < 8; file++) {
        for (let rank = 1; rank <= 8; rank++) {
          const square = squareAt(file, rank);
          // Queen ping: show the unit through fog, but keep its tile darkened.
          if (square && game.get(square)?.type === "q" && !litSquares.has(square)) {
            revealedPieces.add(square);
          }
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
 * Empty army ⇒ empty sets (full fog).
 */
export function getSideVision(
  game: Chess,
  color: Color,
  opts?: {
    rookModeFor?: (square: Square) => RookMode;
    mines?: readonly { at: Square; color: Color }[];
  },
): NerdVision {
  const litSquares = new Set<Square>();
  const revealedPieces = new Set<Square>();

  for (const row of game.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== color) continue;
      const unit = getNerdVision(game, cell.square, opts);
      for (const square of unit.litSquares) litSquares.add(square);
      for (const square of unit.revealedPieces) revealedPieces.add(square);
    }
  }

  for (const mine of opts?.mines ?? []) {
    if (mine.color === color) litSquares.add(mine.at);
  }

  for (const square of litSquares) revealedPieces.delete(square);

  return { litSquares, revealedPieces };
}

/** Fog-cleared tiles only (excludes bishop queen-pings that stay under fog). */
export function getNerdVisibleSquares(
  game: Chess,
  source: Square | null,
  opts?: { rookModeFor?: (square: Square) => RookMode },
): ReadonlySet<Square> {
  return getNerdVision(game, source, opts).litSquares;
}

export type PathVisionOpts = {
  rookModeFor?: (square: Square) => RookMode;
  mines?: readonly { at: Square; color: Color }[];
};

/**
 * resolve.puml — after walking each intermediate on `from→intentTo`, does side
 * vision (with the mover on that square) light or reveal `target`?
 */
export function pathRevealsTarget(
  placement: string,
  from: Square,
  intentTo: Square,
  viewer: Color,
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
  viewer: Color,
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
    const game = new Chess(`${mapToPlacement(board)} w - - 0 1`);
    const v = getSideVision(game, viewer, opts);
    if (v.litSquares.has(target) || v.revealedPieces.has(target)) return i + 1;
  }
  return null;
}

/**
 * Player-facing fog gate (not engine legality).
 * Own pieces are always visible; enemies only on lit tiles or `revealedPieces`.
 */
export function isPieceVisibleToSide(
  game: Chess,
  viewer: Color,
  square: Square,
  pieceColor: Color,
  opts?: { rookModeFor?: (square: Square) => RookMode },
): boolean {
  if (pieceColor === viewer) return true;
  const { litSquares, revealedPieces } = getSideVision(game, viewer, opts);
  return litSquares.has(square) || revealedPieces.has(square);
}

/**
 * Combat move-cue gate. A unit that attacked this resolve revealed its `from`
 * square for the shot; keep that reveal credit for its occupy/slide cue.
 */
export function isMoverVisibleToSide(
  game: Chess,
  viewer: Color,
  move: { from: Square; color: Color },
  revealedFrom: ReadonlySet<Square>,
  opts?: { rookModeFor?: (square: Square) => RookMode },
): boolean {
  return (
    move.color === viewer ||
    revealedFrom.has(move.from) ||
    isPieceVisibleToSide(game, viewer, move.from, move.color, opts)
  );
}
