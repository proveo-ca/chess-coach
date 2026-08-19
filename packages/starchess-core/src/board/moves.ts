/**
 * SC-native classical move generator — authoritative SC legality for human
 * input and the brain. chess.js is not consulted.
 *
 * // SPEC: _spec/packages/starchess-core/sc-moves.puml
 */

import type { Square } from "chess.js";

import {
  attacksSquare,
  parseSquare,
  placementToMap,
  sq,
  type ScPiece,
} from "./placement";
import { mineAt } from "./mines";
import { canPawnDoubleStep } from "../rules/specials/pawnDouble";
import type { PieceColor, ScMine, SpawnPiece } from "../model/types";

export type ScMove = {
  from: Square;
  to: Square;
  piece: ScPiece["type"];
  color: PieceColor;
  capture: ScPiece | null;
  promotes: boolean;
  /** Promotion target when `promotes` (caller may override via picker). */
  promotion?: SpawnPiece;
  /** Sieged rook — capture on rook ray without relocating. */
  firesInPlace: boolean;
  /**
   * Enemy king on `to`. Resolver drops the plan (no relocate, no HP chip) —
   * burns the side's one classical action. UI/brain filter; validation accepts
   * (fog path-discovery en route to a king square still occupies).
   */
  dropsAtResolve: boolean;
  isPawnDoubleStep: boolean;
  /**
   * Hostile spider mine on `to`. Advisory for pieces that already reach the
   * square; **legality-bearing** for the two shapes that only exist because a
   * mine is targetable — a marine front-diagonal onto an empty tile and a
   * sieged tank firing at an empty tile (both attack the mine, see
   * `_spec/packages/starchess-core/resolve.puml`).
   */
  hostileMineOnTo: boolean;
};

export type ScMoveOptions = {
  /**
   * Effective sieged-rook set **after** queued B `rookSiege` toggles
   * (`rookSiegeMode.isRookSiegedAfterB`). Never raw `snap.siegedRooks`.
   */
  siegedRooks?: ReadonlySet<Square> | readonly Square[];
  mines?: readonly ScMine[];
};

const FILES = "abcdefgh";

const asSiegedSet = (
  sieged: ScMoveOptions["siegedRooks"],
): ReadonlySet<Square> => {
  if (!sieged) return new Set();
  return sieged instanceof Set ? sieged : new Set(sieged);
};

const everySquare = (): Square[] => {
  const out: Square[] = [];
  for (let f = 0; f < 8; f += 1) {
    for (let r = 1; r <= 8; r += 1) {
      out.push(`${FILES[f]}${r}` as Square);
    }
  }
  return out;
};

const ALL_SQUARES = everySquare();

/** Hostile spider mine on `to` — advisory flag for UI / brain (allies never arm). */
const hostileMine = (
  mines: readonly ScMine[] | undefined,
  at: Square,
  color: PieceColor,
): boolean => {
  const m = mineAt(mines, at);
  return !!m && m.color !== color;
};

const pushMove = (
  out: ScMove[],
  base: Omit<ScMove, "hostileMineOnTo" | "promotes" | "isPawnDoubleStep" | "firesInPlace" | "dropsAtResolve"> &
    Partial<
      Pick<
        ScMove,
        | "promotes"
        | "isPawnDoubleStep"
        | "firesInPlace"
        | "dropsAtResolve"
        | "promotion"
      >
    >,
  mines: readonly ScMine[] | undefined,
): void => {
  const capture = base.capture;
  const dropsAtResolve = base.dropsAtResolve ?? capture?.type === "k";
  out.push({
    from: base.from,
    to: base.to,
    piece: base.piece,
    color: base.color,
    capture,
    promotes: base.promotes ?? false,
    ...(base.promotion ? { promotion: base.promotion } : {}),
    firesInPlace: base.firesInPlace ?? false,
    dropsAtResolve,
    isPawnDoubleStep: base.isPawnDoubleStep ?? false,
    hostileMineOnTo: hostileMine(mines, base.to, base.color),
  });
};

/** Pawn classical moves for one square. */
const pawnMoves = (
  map: Map<Square, ScPiece>,
  from: Square,
  piece: ScPiece,
  mines: readonly ScMine[] | undefined,
  out: ScMove[],
): void => {
  const { file, rank } = parseSquare(from);
  const dir = piece.color === "w" ? 1 : -1;
  const lastRank = piece.color === "w" ? 8 : 1;

  const tryQuiet = (to: Square, doubleStep: boolean): void => {
    if (map.has(to)) return;
    const promotes = parseSquare(to).rank === lastRank;
    pushMove(
      out,
      {
        from,
        to,
        piece: "p",
        color: piece.color,
        capture: null,
        promotes,
        ...(promotes ? { promotion: "q" as SpawnPiece } : {}),
        isPawnDoubleStep: doubleStep,
      },
      mines,
    );
  };

  const fwd = sq(file, rank + dir);
  if (fwd) tryQuiet(fwd, false);
  if (canPawnDoubleStep(from, piece.color) && fwd && !map.has(fwd)) {
    const fwd2 = sq(file, rank + 2 * dir);
    if (fwd2) tryQuiet(fwd2, true);
  }

  for (const df of [-1, 1] as const) {
    const cap = sq(file + df, rank + dir);
    if (!cap) continue;
    const victim = map.get(cap);
    if (victim && victim.color === piece.color) continue;
    // Empty diagonal is only a move when a hostile mine sits there — the marine
    // attacks (and clears) it. Otherwise diagonals stay capture-only.
    if (!victim && !hostileMine(mines, cap, piece.color)) continue;
    const promotes = parseSquare(cap).rank === lastRank;
    pushMove(
      out,
      {
        from,
        to: cap,
        piece: "p",
        color: piece.color,
        capture: victim ?? null,
        promotes,
        ...(promotes ? { promotion: "q" as SpawnPiece } : {}),
      },
      mines,
    );
  }
};

/**
 * Sieged rook: classic rook attacks only (same file or rank, blocked by
 * occupancy) — captures fire in place (no relocate). No diagonal / area fire.
 * A hostile mine on an empty ray square is a target too: the turret clears it
 * without relocating (mines are not occupancy, so the ray runs through them).
 */
const siegedRookMoves = (
  map: Map<Square, ScPiece>,
  from: Square,
  color: PieceColor,
  mines: readonly ScMine[] | undefined,
  out: ScMove[],
): void => {
  for (const to of ALL_SQUARES) {
    if (to === from) continue;
    // Rook geometry via placement attacks (rays stop at first piece).
    if (!attacksSquare(map, from, to)) continue;
    const occ = map.get(to);
    if (occ && occ.color === color) continue;
    if (!occ && !hostileMine(mines, to, color)) continue;
    pushMove(
      out,
      {
        from,
        to,
        piece: "r",
        color,
        capture: occ ?? null,
        firesInPlace: true,
      },
      mines,
    );
  }
};

/** Knight / king / bishop / rook / queen via {@link attacksSquare}. */
const geometryMoves = (
  map: Map<Square, ScPiece>,
  from: Square,
  piece: ScPiece,
  mines: readonly ScMine[] | undefined,
  out: ScMove[],
): void => {
  for (const to of ALL_SQUARES) {
    if (to === from) continue;
    if (!attacksSquare(map, from, to)) continue;
    const occ = map.get(to);
    if (occ && occ.color === piece.color) continue;
    const capture = occ && occ.color !== piece.color ? occ : null;
    pushMove(
      out,
      {
        from,
        to,
        piece: piece.type,
        color: piece.color,
        capture,
      },
      mines,
    );
  }
};

/**
 * Every SC-legal classical move from one square.
 * Occupancy is a caller parameter — fog is not filtered inside the generator.
 */
export const scMovesFrom = (
  map: Map<Square, ScPiece>,
  from: Square,
  color: PieceColor,
  opts?: ScMoveOptions,
): ScMove[] => {
  const piece = map.get(from);
  if (!piece || piece.color !== color) return [];
  const sieged = asSiegedSet(opts?.siegedRooks);
  const mines = opts?.mines;
  const out: ScMove[] = [];

  if (piece.type === "p") {
    pawnMoves(map, from, piece, mines, out);
    return out;
  }

  if (piece.type === "r" && sieged.has(from)) {
    siegedRookMoves(map, from, color, mines, out);
    return out;
  }

  geometryMoves(map, from, piece, mines, out);
  return out;
};

/** Full SC-legal classical list for a colour. */
export const scMovesFor = (
  map: Map<Square, ScPiece>,
  color: PieceColor,
  opts?: ScMoveOptions,
): ScMove[] => {
  const out: ScMove[] = [];
  for (const [from, piece] of map) {
    if (piece.color !== color) continue;
    out.push(...scMovesFrom(map, from, color, opts));
  }
  return out;
};

/**
 * Classical 2-square advance available from `square` — drives the HUD's "Extra
 * Step" no-canister affordance, so the player is not asked to spend a canister
 * on a step the board already grants.
 *
 * Derived from the generator rather than probed through chess.js: chess.js
 * rejects a placement with a marine on the edge rows outright ("some pawns are
 * on the edge rows"), which is a legal StarChess position via a Command Center
 * deploy, and it has no notion of the widened rank band either way.
 */
export const canClassicalPawnDouble = (
  placement: string,
  square: Square,
): boolean => {
  const map = placementToMap(placement);
  const piece = map.get(square);
  if (!piece || piece.type !== "p") return false;
  return scMovesFrom(map, square, piece.color).some((m) => m.isPawnDoubleStep);
};

/**
 * Shape-only geometry — deliberately ignores path blockers so fog
 * path-discovery intents stay queueable. Opt-in validation only.
 */
export const isScMoveShape = (
  piece: ScPiece["type"],
  from: Square,
  to: Square,
  color?: PieceColor,
): boolean => {
  if (from === to) return false;
  const { file: ff, rank: fr } = parseSquare(from);
  const { file: tf, rank: tr } = parseSquare(to);
  const df = tf - ff;
  const dr = tr - fr;
  const adf = Math.abs(df);
  const adr = Math.abs(dr);

  switch (piece) {
    case "n":
      return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
    case "k":
      return adf <= 1 && adr <= 1 && (adf > 0 || adr > 0);
    case "p": {
      if (color == null) {
        // Either colour: forward 1/2 on file, or diagonal 1.
        if (adf === 0 && (adr === 1 || adr === 2)) return true;
        return adf === 1 && adr === 1;
      }
      const dir = color === "w" ? 1 : -1;
      if (adf === 0 && dr === dir) return true;
      if (adf === 0 && dr === 2 * dir) return canPawnDoubleStep(from, color);
      return adf === 1 && dr === dir;
    }
    case "b":
      return adf === adr && adf > 0;
    case "r":
      return (df === 0 && dr !== 0) || (dr === 0 && df !== 0);
    case "q":
      return (
        (adf === adr && adf > 0) ||
        (df === 0 && dr !== 0) ||
        (dr === 0 && df !== 0)
      );
    default:
      return false;
  }
};
