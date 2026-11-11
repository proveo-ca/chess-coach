// SPEC: _spec/resolution-primitives.puml
import { mapToPlacement, parseSquare, placementToMap, sq } from "./board";
import type { ScPiece, Square, StarChessColor } from "./types";

const DIRECTIONS = [[1, 1], [1, -1], [-1, -1], [-1, 1]] as const;

export const charonStrikeTarget = (map: Map<Square, ScPiece>, from: Square, to: Square, side?: StarChessColor): Square | null => {
  const attacker = map.get(from);
  const color = side ?? attacker?.color;
  if (!side && (!attacker || attacker.type !== "b")) return null;
  if (!color) return null;
  const origin = parseSquare(from), target = parseSquare(to);
  const df = Math.sign(target.file - origin.file), dr = Math.sign(target.rank - origin.rank);
  if (!df || !dr || Math.abs(target.file - origin.file) !== Math.abs(target.rank - origin.rank)) return null;
  let file = origin.file + df, rank = origin.rank + dr;
  for (;;) {
    const at = sq(file, rank);
    if (!at) return null;
    if (at === to) {
      const victim = map.get(at);
      return victim?.type === "q" && victim.color !== color ? at : null;
    }
    if (map.get(at)?.type === "q") return null;
    file += df;
    rank += dr;
  }
};

export const charonTargetShips = (map: Map<Square, ScPiece>, from: Square): Square[] => {
  const attacker = map.get(from);
  if (attacker?.type !== "b") return [];
  const { file, rank } = parseSquare(from);
  const targets: Square[] = [];
  for (const [df, dr] of DIRECTIONS) {
    let f = file + df, r = rank + dr;
    for (;;) {
      const at = sq(f, r);
      if (!at) break;
      const piece = map.get(at);
      if (piece?.type === "q") {
        if (piece.color !== attacker.color) targets.push(at);
        break;
      }
      f += df;
      r += dr;
    }
  }
  return targets.sort();
};

export const placementAfterMechaCharon = (placement: string, victim: Square): string => {
  const map = placementToMap(placement);
  map.delete(victim);
  return mapToPlacement(map);
};

export const charonRayEdge = (from: Square, to: Square): Square => {
  const origin = parseSquare(from), target = parseSquare(to);
  const df = Math.sign(target.file - origin.file), dr = Math.sign(target.rank - origin.rank);
  const diagonal = df !== 0 && dr !== 0 && Math.abs(target.file - origin.file) === Math.abs(target.rank - origin.rank);
  if ((!diagonal && df !== 0 && dr !== 0) || (df === 0 && dr === 0)) return to;
  let edge = to;
  let file = target.file + df, rank = target.rank + dr;
  for (;;) {
    const at = sq(file, rank);
    if (!at) break;
    edge = at;
    file += df;
    rank += dr;
  }
  return edge;
};
