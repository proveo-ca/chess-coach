// SPEC: _spec/game-core.puml
import type { ScMine, ScPiece, SpawnPiece, Square, StarChessColor } from "./types";
import { attacksSquare, parseSquare, placementToMap, sq } from "./board";
import { mineAt } from "./mines";

export const marineSingleTarget = (square: Square, color: StarChessColor): Square | null => {
  const rank = Number(square[1]) + (color === "w" ? 1 : -1);
  return rank < 1 || rank > 8 ? null : `${square[0]}${rank}` as Square;
};

export const canMarineDoubleStep = (square: Square, color: StarChessColor): boolean =>
  color === "w" ? Number(square[1]) <= 2 : Number(square[1]) >= 7;

export type ScMove = {
  from: Square;
  to: Square;
  piece: ScPiece["type"];
  color: StarChessColor;
  capture: ScPiece | null;
  promotes: boolean;
  promotion?: SpawnPiece;
  firesInPlace: boolean;
  dropsAtResolve: boolean;
  isMarineDoubleStep: boolean;
  hostileMineOnTo: boolean;
};

export type ScMoveOptions = {
  siegedTanks?: ReadonlySet<Square> | readonly Square[];
  mines?: readonly ScMine[];
};

const ALL_SQUARES: Square[] = Array.from({ length: 64 }, (_, index) => sq(Math.floor(index / 8), index % 8 + 1)!);

const hostileMine = (mines: readonly ScMine[] | undefined, at: Square, color: StarChessColor): boolean => {
  const mine = mineAt(mines, at);
  return !!mine && mine.color !== color;
};

type MoveBase = Pick<ScMove, "from" | "to" | "piece" | "color" | "capture"> &
  Partial<Pick<ScMove, "promotes" | "promotion" | "isMarineDoubleStep" | "firesInPlace" | "dropsAtResolve">>;

const pushMove = (out: ScMove[], base: MoveBase, mines: readonly ScMine[] | undefined): void => {
  out.push({
    from: base.from,
    to: base.to,
    piece: base.piece,
    color: base.color,
    capture: base.capture,
    promotes: base.promotes ?? false,
    ...(base.promotion ? { promotion: base.promotion } : {}),
    firesInPlace: base.firesInPlace ?? false,
    dropsAtResolve: base.dropsAtResolve ?? base.capture?.type === "k",
    isMarineDoubleStep: base.isMarineDoubleStep ?? false,
    hostileMineOnTo: hostileMine(mines, base.to, base.color),
  });
};

const marineMoves = (map: Map<Square, ScPiece>, from: Square, piece: ScPiece, mines: readonly ScMine[] | undefined, out: ScMove[]): void => {
  const { file, rank } = parseSquare(from);
  const dir = piece.color === "w" ? 1 : -1;
  const lastRank = piece.color === "w" ? 8 : 1;
  const tryQuiet = (to: Square, doubleStep: boolean): void => {
    if (map.has(to)) return;
    const promotes = parseSquare(to).rank === lastRank;
    pushMove(out, {
      from, to, piece: "p", color: piece.color, capture: null, promotes,
      ...(promotes ? { promotion: "q" as const } : {}), isMarineDoubleStep: doubleStep,
    }, mines);
  };
  const forward = sq(file, rank + dir);
  if (forward) tryQuiet(forward, false);
  if (canMarineDoubleStep(from, piece.color) && forward && !map.has(forward)) {
    const second = sq(file, rank + 2 * dir);
    if (second) tryQuiet(second, true);
  }
  for (const df of [-1, 1]) {
    const to = sq(file + df, rank + dir);
    if (!to) continue;
    const victim = map.get(to);
    if (victim?.color === piece.color) continue;
    if (!victim && !hostileMine(mines, to, piece.color)) continue;
    const promotes = parseSquare(to).rank === lastRank;
    pushMove(out, {
      from, to, piece: "p", color: piece.color, capture: victim ?? null, promotes,
      ...(promotes ? { promotion: "q" as const } : {}),
    }, mines);
  }
};

export const scMovesFrom = (map: Map<Square, ScPiece>, from: Square, color: StarChessColor, opts?: ScMoveOptions): ScMove[] => {
  const piece = map.get(from);
  if (!piece || piece.color !== color) return [];
  const out: ScMove[] = [];
  if (piece.type === "p") {
    marineMoves(map, from, piece, opts?.mines, out);
    return out;
  }
  const sieged = piece.type === "r" && new Set(opts?.siegedTanks).has(from);
  for (const to of ALL_SQUARES) {
    if (to === from) continue;
    if (sieged ? to[0] !== from[0] && to[1] !== from[1] : !attacksSquare(map, from, to)) continue;
    const victim = map.get(to);
    if (victim?.color === color) continue;
    pushMove(out, { from, to, piece: piece.type, color, capture: victim ?? null, firesInPlace: sieged }, opts?.mines);
  }
  return out;
};

export const scMovesFor = (map: Map<Square, ScPiece>, color: StarChessColor, opts?: ScMoveOptions): ScMove[] => {
  const out: ScMove[] = [];
  for (const [from, piece] of map) {
    if (piece.color === color) out.push(...scMovesFrom(map, from, color, opts));
  }
  return out;
};

export const canClassicalMarineDouble = (placement: string, square: Square): boolean => {
  const map = placementToMap(placement);
  const piece = map.get(square);
  return !!piece && piece.type === "p" && scMovesFrom(map, square, piece.color).some(move => move.isMarineDoubleStep);
};

export const isScMoveShape = (piece: ScPiece["type"], from: Square, to: Square, color?: StarChessColor): boolean => {
  if (from === to) return false;
  const { file: ff, rank: fr } = parseSquare(from);
  const { file: tf, rank: tr } = parseSquare(to);
  const df = tf - ff;
  const dr = tr - fr;
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  switch (piece) {
    case "n": return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
    case "k": return adf <= 1 && adr <= 1;
    case "p": {
      if (color == null) return (adf === 0 && (adr === 1 || adr === 2)) || (adf === 1 && adr === 1);
      const dir = color === "w" ? 1 : -1;
      if (adf === 0 && dr === dir) return true;
      if (adf === 0 && dr === 2 * dir) return canMarineDoubleStep(from, color);
      return adf === 1 && dr === dir;
    }
    case "b": return adf === adr && adf > 0;
    case "r": return (df === 0 && dr !== 0) || (dr === 0 && df !== 0);
    case "q": return (adf === adr && adf > 0) || (df === 0 && dr !== 0) || (dr === 0 && df !== 0);
    default: return false;
  }
};
