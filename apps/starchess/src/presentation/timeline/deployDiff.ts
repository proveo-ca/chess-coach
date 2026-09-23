/**
 * Diff placement strings → Command Center / put deploy cues (not relocates).
 * Mirrors apps/chess `deployCuesForBoardDiff`.
 */
import type { Square } from "chess.js";
import { placementToMap, type StarChessPiece } from "@chess-coach/starchess-core";

import { deployKindFor } from "~/presentation/animations/deployAnim";
import type { DeployCue, PieceColor } from "~/presentation/types";

type PieceAt = { type: StarChessPiece; color: PieceColor };

const packKey = (p: PieceAt) => `${p.color}${p.type}`;

export const deployCuesForPlacementDiff = (
  prevPlacement: string,
  nextPlacement: string,
  idPrefix = "deploy",
): DeployCue[] => {
  const prev = placementToMap(prevPlacement);
  const next = placementToMap(nextPlacement);

  const disappeared: { sq: Square; piece: PieceAt }[] = [];
  for (const [sq, piece] of prev) {
    const n = next.get(sq);
    if (!n || packKey(n) !== packKey(piece)) {
      disappeared.push({ sq, piece: { type: piece.type, color: piece.color } });
    }
  }

  const cues: DeployCue[] = [];
  let i = 0;
  for (const [sq, piece] of next) {
    const p = prev.get(sq);
    if (p && packKey(p) === packKey(piece)) continue;
    if (!deployKindFor(piece.type)) continue;

    const fromIdx = disappeared.findIndex((d) => packKey(d.piece) === packKey(piece));
    if (fromIdx >= 0) {
      disappeared.splice(fromIdx, 1);
      continue;
    }

    cues.push({
      id: `${idPrefix}-${piece.type}-${sq}-${i++}`,
      piece: piece.type,
      color: piece.color,
      at: sq,
    });
  }
  return cues;
};
