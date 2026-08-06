import type { Square } from "chess.js";

import type { NerdVision, ScFenSnapshot, StarChessColor } from "@chess-coach/starchess-core";
import { placementToMap } from "@chess-coach/starchess-core";

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
