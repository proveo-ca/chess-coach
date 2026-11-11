// SPEC: _spec/game-core.puml
import type { ScMine, ScPiece, Square, StarChessColor } from "./types";
import { parseSquare, sq } from "./board";

export const MAX_MINES_PER_SIDE = 3;

export const rayBetween = (from: Square, to: Square): Square[] => {
  const { file: ff, rank: fr } = parseSquare(from);
  const { file: tf, rank: tr } = parseSquare(to);
  const df = tf - ff;
  const dr = tr - fr;
  if (df !== 0 && dr !== 0 && Math.abs(df) !== Math.abs(dr)) return [];
  if (df === 0 && dr === 0) return [];
  const out: Square[] = [];
  let file = ff + Math.sign(df);
  let rank = fr + Math.sign(dr);
  while (file !== tf || rank !== tr) {
    const mid = sq(file, rank);
    if (mid) out.push(mid);
    file += Math.sign(df);
    rank += Math.sign(dr);
  }
  return out;
};

export const firstBlockerOnRay = (map: Map<Square, ScPiece>, from: Square, to: Square): Square | null => {
  for (const mid of rayBetween(from, to)) {
    if (map.has(mid)) return mid;
  }
  return null;
};

export const pathContactSquares = (from: Square, to: Square, pieceType: ScPiece["type"]): Square[] =>
  pieceType === "n" || pieceType === "k" ? [] : rayBetween(from, to);

export const minesFor = (mines: readonly ScMine[] | undefined, color: StarChessColor): ScMine[] =>
  (mines ?? []).filter(mine => mine.color === color);

export const mineAt = (mines: readonly ScMine[] | undefined, at: Square): ScMine | undefined =>
  (mines ?? []).find(mine => mine.at === at);

export const formatMinesExtra = (mines: readonly ScMine[]): string | null => {
  if (mines.length === 0) return null;
  const pack = (color: StarChessColor) => minesFor(mines, color).map(mine => mine.at).sort().join("");
  return `M:w:${pack("w")};b:${pack("b")}`;
};

export const parseMinesExtra = (extra: string | undefined): ScMine[] => {
  if (!extra || !extra.startsWith("M:")) return [];
  return extra.slice(2).split(";").flatMap(raw => {
    const color = raw.startsWith("w:") ? "w" : raw.startsWith("b:") ? "b" : null;
    if (!color) return [];
    const squares = raw.slice(2);
    const out: ScMine[] = [];
    for (let i = 0; i + 1 < squares.length; i += 2) {
      const at = squares.slice(i, i + 2);
      if (/^[a-h][1-8]$/.test(at)) out.push({ color, at: at as Square });
    }
    return out;
  });
};

export const assertMineCap = (mines: readonly ScMine[], color: StarChessColor): void => {
  if (minesFor(mines, color).length > MAX_MINES_PER_SIDE) {
    throw Object.assign(new Error(`SCFEN mines: ${color} exceeds cap ${MAX_MINES_PER_SIDE}`), { code: "SC_SPECIAL" as const });
  }
};
