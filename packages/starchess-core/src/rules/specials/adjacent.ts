import type { Square } from "../../model/square";
import type { ScFenSnapshot, StarChessColor } from "../../model/types";
import { findKing, placementToMap } from "../../board/placement";

/** Empty squares adjacent to `origin` (king spawn ring). */
export const adjacentSquares = (
  origin: Square,
  occupied: ReadonlySet<Square>,
): Square[] => {
  const file = origin.charCodeAt(0) - 97;
  const rank = Number(origin[1]);
  const out: Square[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const f = file + df;
      const r = rank + dr;
      if (f < 0 || f > 7 || r < 1 || r > 8) continue;
      const sq = `${String.fromCharCode(97 + f)}${r}` as Square;
      if (!occupied.has(sq)) out.push(sq);
    }
  }
  return out;
};

/**
 * Command Center spawn ring anchor.
 *
 * - **B** (gas before classical): ring around the living king; planning occupancy.
 * - **F** (classical then gas): ring around the **post-move** king square when a
 *   same-side classical relocates the king; the vacated origin counts as empty.
 */
export const spawnKingAnchor = (
  snap: ScFenSnapshot,
  color: StarChessColor,
  timing: "B" | "F",
): { king: Square | null; occupied: ReadonlySet<Square> } => {
  const map = placementToMap(snap.placement);
  const king = findKing(map, color);
  const occupied = new Set(map.keys());
  if (!king) return { king: null, occupied };
  if (timing !== "F") return { king, occupied };

  const c = (snap.queue?.actions ?? []).find(
    (a) => a.timing === "C" && a.color === color,
  );
  if (!c || c.from !== king) return { king, occupied };

  occupied.delete(c.from);
  occupied.add(c.to);
  return { king: c.to, occupied };
};
