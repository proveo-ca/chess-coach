// SPEC: _spec/specials/mecha-charon.puml
import type { Square } from "../../model/square";
import type { StarChessColor } from "../../model/types";
import {
  mapToPlacement,
  parseSquare,
  placementToMap,
  sq,
  type ScPiece,
} from "../../board/placement";

export { CHARON_GAS_COST, MECHA_CHARON_GAS_COST } from "../constants";

const DIRS = [
  { df: 1, dr: 1 },
  { df: 1, dr: -1 },
  { df: -1, dr: -1 },
  { df: -1, dr: 1 },
] as const;

/**
 * Selectable Charon aim squares: every on-board square on the Mecha's four
 * diagonals, empty or occupied. Free aim — the arm never rejects for lack of
 * ships; a shot that meets no killable ship fizzles off the board.
 */
export const charonDiagonalSquares = (
  map: Map<Square, ScPiece>,
  from: Square,
): Square[] => {
  const attacker = map.get(from);
  if (!attacker || attacker.type !== "b") return [];
  return charonDiagonalSquaresFromSquare(from);
};

export const charonDiagonalSquaresFromSquare = (from: Square): Square[] => {
  const { file, rank } = parseSquare(from);
  const out: Square[] = [];

  for (const dir of DIRS) {
    let f = file + dir.df;
    let r = rank + dir.dr;
    for (;;) {
      const at = sq(f, r);
      if (!at) break;
      out.push(at);
      f += dir.df;
      r += dir.dr;
    }
  }

  return out.sort();
};

export const charonDiagonalSquaresFromPlacement = (
  placement: string,
  from: Square,
): Square[] => charonDiagonalSquares(placementToMap(placement), from);

/**
 * Kill check for an aimed square: `to` must hold an enemy ship with no ship
 * of either color strictly between `from` and `to` (i.e. `to` is the first
 * ship on its ray). Anything else — empty square, ally ship, screened ship,
 * non-ship, off-diagonal — is a fizzle (missiles fly the full ray off-board).
 * Returns `to` on a kill, else null.
 *
 * Fire-and-forget: pass `side` (the queued action's color) and the shot
 * resolves even when the Mecha is gone — paid gas still fires from the queued
 * square. Without `side` the Mecha must be alive on `from` (planning helpers).
 */
export const charonStrikeTarget = (
  map: Map<Square, ScPiece>,
  from: Square,
  to: Square,
  side?: StarChessColor,
): Square | null => {
  const attacker = map.get(from);
  const color = side ?? attacker?.color;
  if (!side && (!attacker || attacker.type !== "b")) return null;
  if (!color) return null;
  const a = parseSquare(from);
  const b = parseSquare(to);
  const df = Math.sign(b.file - a.file);
  const dr = Math.sign(b.rank - a.rank);
  if (df === 0 || dr === 0) return null;
  if (Math.abs(b.file - a.file) !== Math.abs(b.rank - a.rank)) return null;
  let f = a.file + df;
  let r = a.rank + dr;
  for (;;) {
    const at = sq(f, r);
    if (!at) return null;
    if (at === to) {
      const victim = map.get(at);
      return victim && victim.type === "q" && victim.color !== color ? at : null;
    }
    if (map.get(at)?.type === "q") return null;
    f += df;
    r += dr;
  }
};

/**
 * Killable Charon victims: the first ship (BattleShip, type `q`) on each of
 * the Mecha's four diagonals. Non-ships of either color are transparent.
 * An allied ship blocks its ray but is never killable; an enemy ship is
 * killable iff it is the first ship on its ray. Returns 0–4 squares, sorted.
 * Used by the AI (which only fires kill shots); the arm offers free aim via
 * {@link charonDiagonalSquares} instead.
 */
export const charonTargetShips = (
  map: Map<Square, ScPiece>,
  from: Square,
): Square[] => {
  const attacker = map.get(from);
  if (!attacker || attacker.type !== "b") return [];
  const { file, rank } = parseSquare(from);
  const targets: Square[] = [];

  for (const dir of DIRS) {
    let f = file + dir.df;
    let r = rank + dir.dr;
    for (;;) {
      const at = sq(f, r);
      if (!at) break;
      const piece = map.get(at);
      if (piece?.type === "q") {
        if (piece.color !== attacker.color) targets.push(at);
        break;
      }
      f += dir.df;
      r += dir.dr;
    }
  }

  return targets.sort();
};

export const charonTargetShipsFromPlacement = (
  placement: string,
  from: Square,
): Square[] => charonTargetShips(placementToMap(placement), from);

/** Remove the struck ship; the Mecha stays on its origin square. */
export const placementAfterMechaCharon = (
  placement: string,
  victim: Square,
): string => {
  const map = placementToMap(placement);
  map.delete(victim);
  return mapToPlacement(map);
};

/**
 * Fizzle ray edge: farthest on-board square from `from` through `to`.
 * Diagonal aims extend along their diagonal; orthogonal drift (only reachable
 * via an F mecha-move shifting the ray) extends orthogonally — either way the
 * missiles fly the full ray and off the board instead of vanishing silently.
 * Non-ray aims fall back to `to` (the volley span still carries 2.5 cells past).
 */
export const charonRayEdge = (from: Square, to: Square): Square => {
  const a = parseSquare(from);
  const b = parseSquare(to);
  const df = Math.sign(b.file - a.file);
  const dr = Math.sign(b.rank - a.rank);
  const diagonal = df !== 0 && dr !== 0 &&
    Math.abs(b.file - a.file) === Math.abs(b.rank - a.rank);
  if (!diagonal && df !== 0 && dr !== 0) return to;
  if (df === 0 && dr === 0) return to;
  let edge: Square = to;
  let f = b.file + df;
  let r = b.rank + dr;
  for (;;) {
    const at = sq(f, r);
    if (!at) break;
    edge = at;
    f += df;
    r += dr;
  }
  return edge;
};
