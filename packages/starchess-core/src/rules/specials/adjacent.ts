import type { Square } from "../../model/square";

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
