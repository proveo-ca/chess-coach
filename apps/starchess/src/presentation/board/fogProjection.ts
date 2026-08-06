import type { PieceSymbol, Square } from "chess.js";

import {
  getSideVision,
  mapToPlacement,
  placementToMap,
  type NerdVision,
  type ScFenSnapshot,
  type ScPiece,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { moveSquareAtElapsed } from "~/presentation/animations/moveTiming";

/**
 * Enemy units that already spent gas this turn stay visible through fog
 * (green special-used aura) without lighting the tile.
 */
export const fogWithGasUsedReveal = (
  base: NerdVision,
  specialsUsed: ReadonlySet<Square>,
  viewer: StarChessColor,
  snap: ScFenSnapshot,
): NerdVision => {
  if (specialsUsed.size === 0) return base;
  const map = placementToMap(snap.placement);
  const revealedPieces = new Set(base.revealedPieces);
  for (const sq of specialsUsed) {
    const piece = map.get(sq);
    if (!piece) continue;
    if (piece.color === viewer) continue;
    revealedPieces.add(sq);
  }
  return { litSquares: base.litSquares, revealedPieces };
};

export type MoveVisionCue = {
  id: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  /** When the slide CSS started (`progress === 1`). */
  startedAt: number;
};

/**
 * Clone occupancy with active movers relocated along their slide path so fog
 * updates square-by-square during MoveAnimation (SCFEN progressive path vision).
 * chess.js is never consulted — path boards may be temporarily kingless/odd.
 */
export function mapWithMovePathOccupancy(
  map: ReadonlyMap<Square, ScPiece>,
  moves: readonly MoveVisionCue[],
  nowMs: number,
): Map<Square, ScPiece> {
  if (moves.length === 0) return new Map(map);
  const next = new Map(map);
  let changed = false;
  for (const m of moves) {
    const at = moveSquareAtElapsed(m.from, m.to, m.piece, nowMs - m.startedAt);
    const onFrom = next.get(m.from);
    if (at === m.from && onFrom) continue;
    const piece = onFrom ?? next.get(m.to);
    if (!piece) continue;
    if (onFrom) next.delete(m.from);
    const onTo = next.get(m.to);
    if (
      m.to !== at &&
      onTo &&
      onTo.type === piece.type &&
      onTo.color === piece.color
    ) {
      next.delete(m.to);
    }
    // Overwrite destination/mid occupancy — SCFEN path discovery, not FEN legality.
    next.set(at, piece);
    changed = true;
  }
  return changed ? next : new Map(map);
}

/** @deprecated Prefer {@link mapWithMovePathOccupancy}; kept for UI Chess adapters. */
export function gameWithMovePathOccupancy(
  game: { fen: () => string },
  moves: readonly MoveVisionCue[],
  nowMs: number,
): { fen: () => string } {
  const map = mapWithMovePathOccupancy(
    placementToMap(game.fen().split(/\s+/)[0]!),
    moves,
    nowMs,
  );
  const placement = mapToPlacement(map);
  return { fen: () => `${placement} w - - 0 1` };
}

/**
 * DualNav / observer review — both sides' cumulative vision from one SCFEN snap.
 * Engine-only: placement + `S:` siege + `M:` mines via {@link getSideVision}.
 * // SPEC: _spec/apps/ui/starchess/demos.puml
 */
export const observerVisionFromSnap = (
  snap: ScFenSnapshot,
  opts?: { siegedRooks?: readonly Square[] },
): { w: NerdVision; b: NerdVision } => {
  const sieged = new Set(opts?.siegedRooks ?? snap.siegedRooks ?? []);
  const rookModeFor = (sq: Square) => (sieged.has(sq) ? "siege" : "tank");
  const visionOpts = { rookModeFor, mines: snap.mines };
  return {
    w: getSideVision(snap.placement, "w", visionOpts),
    b: getSideVision(snap.placement, "b", visionOpts),
  };
};

export type VisionCell = { col: number; row: number };

export const getVisionDisplayCells = (
  visible: ReadonlySet<Square>,
  files: readonly string[],
  ranks: readonly string[],
): VisionCell[] => {
  const cells: VisionCell[] = [];
  for (const square of visible) {
    const col = files.indexOf(square[0]!);
    const row = ranks.indexOf(square[1]!);
    if (col >= 0 && row >= 0) cells.push({ col, row });
  }
  return cells;
};

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

export function getVisionFogHolePaths(cells: readonly VisionCell[], radius = 0.15): string[] {
  const set = new Set(cells.map((cell) => `${cell.col},${cell.row}`));
  const has = (col: number, row: number) => set.has(`${col},${row}`);

  return cells.map(({ col, row }) => {
    const up = has(col, row - 1);
    const down = has(col, row + 1);
    const left = has(col - 1, row);
    const right = has(col + 1, row);
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
 * Observer dual-vision: stroke-only exterior edges of the lit union.
 * Internal edges between adjacent lit cells are omitted so zones can overlap
 * without a grid of interior borders.
 */
export function getVisionBorderPaths(cells: readonly VisionCell[]): string[] {
  const set = new Set(cells.map((cell) => `${cell.col},${cell.row}`));
  const has = (col: number, row: number) => set.has(`${col},${row}`);
  const n = (value: number) => Number(value.toFixed(4));
  const paths: string[] = [];

  for (const { col, row } of cells) {
    const x0 = col;
    const y0 = row;
    const x1 = col + 1;
    const y1 = row + 1;
    // Top / bottom / left / right — only when the neighbor is outside the union.
    if (!has(col, row - 1)) {
      paths.push(`M${n(x0)} ${n(y0)}L${n(x1)} ${n(y0)}`);
    }
    if (!has(col, row + 1)) {
      paths.push(`M${n(x0)} ${n(y1)}L${n(x1)} ${n(y1)}`);
    }
    if (!has(col - 1, row)) {
      paths.push(`M${n(x0)} ${n(y0)}L${n(x0)} ${n(y1)}`);
    }
    if (!has(col + 1, row)) {
      paths.push(`M${n(x1)} ${n(y0)}L${n(x1)} ${n(y1)}`);
    }
  }
  return paths;
}
