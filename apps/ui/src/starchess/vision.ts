/**
 * Cumulative fog — union of friendly-unit vision; mines light their own square.
 * // SPEC: _spec/apps/ui/starchess/starchess-mode.puml, _spec/apps/ui/starchess/resolve.puml
 */
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

import { moveSquareAtElapsed } from "~/starchess/animations/moveTiming";
import { mapToPlacement, placementToMap } from "~/starchess/board";
import { rayBetween } from "~/starchess/mines";
import type { RookMode } from "~/starchess/types";

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

/** Display-grid cells for SVG fog masking (col/row in left→right, top→bottom order). */
export type VisionCell = { col: number; row: number };

/**
 * Maps visible algebraic squares onto the current board display grid.
 */
export function getVisionDisplayCells(
  visible: ReadonlySet<Square>,
  files: readonly string[],
  ranks: readonly string[],
): VisionCell[] {
  const cells: VisionCell[] = [];
  for (const square of visible) {
    const col = files.indexOf(square[0]);
    const row = ranks.indexOf(square[1]);
    if (col >= 0 && row >= 0) cells.push({ col, row });
  }
  return cells;
}

/**
 * Fog-hole path for one lit cell. Radius applies only on exterior corners of the
 * vision union so the fog overlay curves around bounds — square elements stay
 * sharp (no border-radius).
 */
export function buildFogHoleCellPath(
  col: number,
  row: number,
  radius: number,
  corners: { tl: boolean; tr: boolean; bl: boolean; br: boolean },
): string {
  const r = Math.min(Math.max(radius, 0), 0.49);
  const x0 = col;
  const y0 = row;
  const x1 = col + 1;
  const y1 = row + 1;
  const rtl = corners.tl ? r : 0;
  const rtr = corners.tr ? r : 0;
  const rbr = corners.br ? r : 0;
  const rbl = corners.bl ? r : 0;
  const n = (value: number) => Number(value.toFixed(4));

  let d = `M${n(x0 + rtl)} ${n(y0)}`;
  d += `H${n(x1 - rtr)}`;
  d += rtr > 0 ? `A${n(rtr)} ${n(rtr)} 0 0 1 ${n(x1)} ${n(y0 + rtr)}` : `L${n(x1)} ${n(y0)}`;
  d += `V${n(y1 - rbr)}`;
  d += rbr > 0 ? `A${n(rbr)} ${n(rbr)} 0 0 1 ${n(x1 - rbr)} ${n(y1)}` : `L${n(x1)} ${n(y1)}`;
  d += `H${n(x0 + rbl)}`;
  d += rbl > 0 ? `A${n(rbl)} ${n(rbl)} 0 0 1 ${n(x0)} ${n(y1 - rbl)}` : `L${n(x0)} ${n(y1)}`;
  d += `V${n(y0 + rtl)}`;
  d += rtl > 0 ? `A${n(rtl)} ${n(rtl)} 0 0 1 ${n(x0 + rtl)} ${n(y0)}` : `L${n(x0)} ${n(y0)}`;
  d += "Z";
  return d;
}

/**
 * Fog-overlay hole paths for the visible union. Only exterior silhouette corners
 * are rounded — individual tiles are not given a border-radius.
 */
export function getVisionFogHolePaths(cells: readonly VisionCell[], radius = 0.15): string[] {
  const set = new Set(cells.map((cell) => `${cell.col},${cell.row}`));
  const has = (col: number, row: number) => set.has(`${col},${row}`);

  return cells.map(({ col, row }) => {
    const up = has(col, row - 1);
    const down = has(col, row + 1);
    const left = has(col - 1, row);
    const right = has(col + 1, row);
    // Keep 1-wide tips from becoming pill shapes; still round the fog union gently.
    const tip = (!left && !right) || (!up && !down);
    const cornerRadius = tip ? Math.min(radius, 0.1) : radius;
    return buildFogHoleCellPath(col, row, cornerRadius, {
      tl: !up && !left,
      tr: !up && !right,
      bl: !down && !left,
      br: !down && !right,
    });
  });
}

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

  const sourceFile = FILES.indexOf(source[0]);
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
 *
 * Attackers under fog are **not** permanently revealed here — ChessBoard adds
 * active `attackCues[].from` to `revealedPieces` for the shot, and the combat
 * hook carries that same origin credit into the attacker's occupy/slide cue
 * (fog punishment until they fire).
 */
export function getSideVision(
  game: Chess,
  color: Color,
  opts?: {
    rookModeFor?: (square: Square) => RookMode;
    /** Friendly Spider Mines light only their own square (MODE rule 1). */
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

  // Bishop queen-pings that land on a tile already lit by another unit stay lit, not "revealed only".
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

export type MoveVisionCue = {
  id: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  /** When the slide CSS started (`progress === 1`). */
  startedAt: number;
};

/**
 * Clone `game` with active movers relocated along their slide path so fog
 * updates square-by-square during MoveAnimation (SCFEN progressive path vision).
 * Handles both pre-commit occupancy (`from`) and native moves already on `to`.
 */
export function gameWithMovePathOccupancy(
  game: Chess,
  moves: readonly MoveVisionCue[],
  nowMs: number,
): Chess {
  if (moves.length === 0) return game;
  const next = new Chess(game.fen());
  let changed = false;
  for (const m of moves) {
    const at = moveSquareAtElapsed(m.from, m.to, m.piece, nowMs - m.startedAt);
    const onFrom = next.get(m.from);
    if (at === m.from && onFrom) continue;
    const piece = onFrom ?? next.get(m.to);
    if (!piece) continue;
    if (onFrom) next.remove(m.from);
    const onTo = next.get(m.to);
    if (
      m.to !== at &&
      onTo &&
      onTo.type === piece.type &&
      onTo.color === piece.color
    ) {
      next.remove(m.to);
    }
    next.put({ type: piece.type, color: piece.color }, at);
    changed = true;
  }
  return changed ? next : game;
}

export type PathVisionOpts = {
  rookModeFor?: (square: Square) => RookMode;
  mines?: readonly { at: Square; color: Color }[];
};

/**
 * resolve.puml — after walking each intermediate on `from→intentTo`, does side
 * vision (with the mover on that square) light or reveal `target`?
 * Leaping pieces have no intermediates (caller should skip).
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
 * square for the shot; keep that reveal credit for its occupy/slide cue even if
 * the mid-resolve FEN removed the friendly spotter that used to light it.
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
