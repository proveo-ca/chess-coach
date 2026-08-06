/**
 * Cumulative fog — union of friendly-unit vision; mines light their own square.
 * Rules live in `@chess-coach/starchess-core`; SVG / animation helpers stay here.
 * // SPEC: _spec/apps/ui/starchess/starchess-mode.puml, _spec/apps/ui/starchess/resolve.puml
 */
import { Chess, type PieceSymbol, type Square } from "chess.js";

import { moveSquareAtElapsed } from "~/starchess/animations/moveTiming";

export type { NerdVision, PathVisionOpts } from "@chess-coach/starchess-core";
export {
  getNerdVision,
  getSideVision,
  getNerdVisibleSquares,
  pathRevealsTarget,
  pathRevealSteps,
  isPieceVisibleToSide,
  isMoverVisibleToSide,
} from "@chess-coach/starchess-core";

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
    const col = files.indexOf(square[0]!);
    const row = ranks.indexOf(square[1]!);
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
