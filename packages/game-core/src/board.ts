// SPEC: _spec/game-core.puml
import type { ScPiece, Square, StarChessColor } from "./types";

const FILES = "abcdefgh";

export const hasExactCCPair = (placement: string): boolean => {
  let white = 0, black = 0;
  for (const char of placement) {
    if (char === "K") white++;
    else if (char === "k") black++;
  }
  return white === 1 && black === 1;
};

export const sq = (file: number, rank: number): Square | null => {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}` as Square;
};

export const parseSquare = (square: Square): { file: number; rank: number } => ({
  file: square.charCodeAt(0) - 97,
  rank: Number(square[1]),
});

export const placementToMap = (placement: string): Map<Square, ScPiece> => {
  const map = new Map<Square, ScPiece>();
  const ranks = placement.split("/");
  if (ranks.length !== 8) throw new Error(`Bad placement: ${placement}`);
  for (let r = 0; r < 8; r++) {
    const rank = 8 - r;
    let file = 0;
    for (const ch of ranks[r]!) {
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
        continue;
      }
      const color: StarChessColor = ch === ch.toUpperCase() ? "w" : "b";
      const type = ch.toLowerCase() as ScPiece["type"];
      const square = sq(file, rank);
      if (!square) throw new Error(`Bad square at ${file},${rank}`);
      map.set(square, { type, color });
      file += 1;
    }
  }
  return map;
};

export const tankSquaresInPlacement = (placement: string): Square[] => {
  const out: Square[] = [];
  for (const [square, piece] of placementToMap(placement)) {
    if (piece.type === "r") out.push(square);
  }
  return out;
};

export const mapToPlacement = (map: Map<Square, ScPiece>): string => {
  const ranks: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = map.get(sq(file, rank)!);
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      row += piece.color === "w" ? piece.type.toUpperCase() : piece.type;
    }
    if (empty) row += String(empty);
    ranks.push(row);
  }
  return ranks.join("/");
};

export const attacksSquare = (map: Map<Square, ScPiece>, from: Square, to: Square): boolean => {
  if (from === to) return false;
  const attacker = map.get(from);
  if (!attacker) return false;
  const { file: ff, rank: fr } = parseSquare(from);
  const { file: tf, rank: tr } = parseSquare(to);
  const df = tf - ff;
  const dr = tr - fr;
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  const clearRay = () => {
    const stepF = Math.sign(df);
    const stepR = Math.sign(dr);
    let file = ff + stepF;
    let rank = fr + stepR;
    while (file !== tf || rank !== tr) {
      const mid = sq(file, rank);
      if (mid && map.has(mid)) return false;
      file += stepF;
      rank += stepR;
    }
    return true;
  };
  switch (attacker.type) {
    case "n":
      return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
    case "k":
      return adf <= 1 && adr <= 1;
    case "p":
      return adr === 1 && adf === 1 && dr === (attacker.color === "w" ? 1 : -1);
    case "b":
      return adf === adr && adf > 0 && clearRay();
    case "r":
      return ((df === 0 && dr !== 0) || (dr === 0 && df !== 0)) && clearRay();
    case "q":
      return ((adf === adr && adf > 0) || (df === 0 && dr !== 0) || (dr === 0 && df !== 0)) && clearRay();
    default:
      return false;
  }
};

export const isSquareAttackedBy = (map: Map<Square, ScPiece>, to: Square, byColor: StarChessColor): boolean => {
  for (const [from, piece] of map) {
    if (piece.color === byColor && attacksSquare(map, from, to)) return true;
  }
  return false;
};

export const findCC = (map: Map<Square, ScPiece>, color: StarChessColor): Square | null => {
  for (const [square, piece] of map) {
    if (piece.type === "k" && piece.color === color) return square;
  }
  return null;
};

export type CCCheck = { color: StarChessColor; piece: ScPiece["type"]; from: Square; to: Square };

export const collectLegalCCChecks = (
  placement: string,
  opts?: { isTargetVisible?: (color: StarChessColor, square: Square) => boolean },
): CCCheck[] => {
  const map = placementToMap(placement);
  const canSee = opts?.isTargetVisible ?? (() => true);
  const out: CCCheck[] = [];
  for (const ccColor of ["w", "b"] as const) {
    const ccSquare = findCC(map, ccColor);
    if (!ccSquare) continue;
    const enemy: StarChessColor = ccColor === "w" ? "b" : "w";
    if (!canSee(enemy, ccSquare)) continue;
    for (const [from, piece] of map) {
      if (piece.color === enemy && attacksSquare(map, from, ccSquare)) {
        out.push({ color: enemy, piece: piece.type, from, to: ccSquare });
      }
    }
  }
  out.sort((a, b) => a.color !== b.color ? (a.color === "w" ? -1 : 1) : a.from.localeCompare(b.from));
  return out;
};

export const isCCInCheck = (map: Map<Square, ScPiece>, color: StarChessColor): boolean => {
  const square = findCC(map, color);
  return square !== null && isSquareAttackedBy(map, square, color === "w" ? "b" : "w");
};

export const toClassicFen = (
  placement: string,
  sideToMove: StarChessColor = "w",
  halfmove = 0,
  fullmove = 1,
): string => `${placement} ${sideToMove} - - ${halfmove} ${fullmove}`;
