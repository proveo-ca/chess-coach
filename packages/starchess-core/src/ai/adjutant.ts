/**
 * Adjutant — deterministic StarChess opponent planner (King Hunt live).
 * Feeds the NerdScreen `autoQueueOpponent` slot (pure; no Solid / store deps).
 *
 * Context read every planning turn:
 *  1. all legal special moves (spawn / pawnDouble / knightMine / bishopSnipe /
 *     rookSiege / queenWarp) within this turn's gas budget,
 *  2. all SC-legal classical moves via {@link scMovesFor},
 *  3. side vision — fog-gates the enemy-King hunt bonus; pack-for-vision uses it,
 *  4. material — deployed supply from the board + stored minerals (host bank).
 *
 * Scope note: demo opponent, not fog-faithful. Threat / ray checks read full
 * placement. Only the "attack the enemy King" term is gated on
 * {@link getSideVision}.
 *
 * Strategy: protect King → center → promote → attack enemy King → trades.
 * One action per open planning window. Deterministic.
 *
 * // SPEC: _spec/apps/ui/starchess/starchess-mode.puml, _spec/apps/ui/starchess/demos.puml
 */

import { Chess, type Square } from "chess.js";

import {
  attacksSquare,
  findKing,
  isSquareAttackedBy,
  parseSquare,
  placementToMap,
  sq,
  type ScPiece,
} from "../board/placement";
import {
  MAX_STORED_MATERIAL,
  UNIT_COST,
  incomeForTurn,
} from "../rules/constants";
import { addScAction, AddScActionError } from "../commands/queue-action";
import { classicFenFromSc, specialGasCost } from "../scfen";
import { MAX_MINES_PER_SIDE, mineAt, minesFor } from "../board/mines";
import { scMovesFor, type ScMove } from "../board/moves";
import { charonTargetQueenFromPlacement } from "../rules/specials/bishopCharon";
import { pawnSingleTarget } from "../rules/specials/pawnDouble";
import type {
  PieceColor,
  ScActionInput,
  ScFenSnapshot,
  ScSpecialKind,
  SpawnPiece,
} from "../model/types";
import { getSideVision } from "../board/vision";

export type AdjutantResult = {
  snapshot: ScFenSnapshot;
  /** Minerals to debit when a spawn was queued (Command Center deploy). */
  spendMinerals?: { color: PieceColor; amount: number };
};

export type AdjutantContext = {
  /**
   * Stored minerals per side (host Command Center bank). Injected by the live
   * story from the Solid store; defaults to a deterministic income estimate so
   * snap-only callers still see spawn affordability.
   */
  storedFor?: (color: PieceColor) => number;
};

/** @deprecated Use {@link AdjutantResult}. */
export type KingHuntBrainResult = AdjutantResult;
/** @deprecated Use {@link AdjutantContext}. */
export type KingHuntBrainContext = AdjutantContext;

const FILES = "abcdefgh";

/** Strategy weights — protect King dominates; promote beats quiet development. */
const KING_SAFETY = 10_000;
const PROMOTE_RANK = 300;
const PROMOTION_BONUS = 3_000;
const ATTACK_KING = 2_000;
const CENTER = 50;
const TRADE = 100;
const ATTACKED_PENALTY = 400;

const rankOf = (s: Square): number => Number(s[1]);

/** Contested-square pull: d/e + ranks 4/5 strong, c/f + 3/6 weaker. */
const centerScore = (s: Square): number => {
  const file = FILES.indexOf(s[0]);
  const rank = rankOf(s);
  const fc = file >= 3 && file <= 4 ? 2 : file >= 2 && file <= 5 ? 1 : 0;
  const rc = rank >= 4 && rank <= 5 ? 2 : rank >= 3 && rank <= 6 ? 1 : 0;
  return fc + rc;
};

/**
 * Deterministic bank estimate for snap-only callers (the live story passes the
 * real store via `ctx.storedFor`). Mirrors the story's 1-mineral start + income,
 * then subtracts one mineral per deployed unit beyond the King as a rough spend
 * ledger. Never the source of truth — the host bank gates the actual debit.
 */
const estimateStoredFor =
  (snap: ScFenSnapshot) =>
  (_color: PieceColor): number => {
    let stored = 1;
    for (let turn = 2; turn <= snap.turn; turn += 1) {
      stored += incomeForTurn(turn);
    }
    let deployed = 0;
    for (const piece of placementToMap(snap.placement).values()) {
      if (piece.color === "b") deployed += 1;
    }
    return Math.min(MAX_STORED_MATERIAL, Math.max(0, stored - Math.max(0, deployed - 1)));
  };

type Candidate = {
  action: ScActionInput;
  score: number;
  /** Debit against stored minerals when the action is a spawn. */
  spendMinerals?: number;
};

const neighbors = (from: Square): Square[] => {
  const { file, rank } = parseSquare(from);
  const out: Square[] = [];
  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) continue;
      const at = sq(file + df, rank + dr);
      if (at) out.push(at);
    }
  }
  return out;
};

type Move = {
  from: Square;
  to: Square;
  promotion?: SpawnPiece;
  capture: ScPiece | null;
  firesInPlace?: boolean;
};

/** Classical candidates from the shared SC movegen (filter king-square traps). */
const blackMoves = (map: Map<Square, ScPiece>, sieged: ReadonlySet<Square>): Move[] =>
  scMovesFor(map, "b", { siegedRooks: sieged })
    .filter((m: ScMove) => !m.dropsAtResolve)
    .map((m) => ({
      from: m.from,
      to: m.to,
      capture: m.capture,
      firesInPlace: m.firesInPlace,
      ...(m.promotion ? { promotion: m.promotion } : {}),
    }));

/** Legal specials for black within this turn's gas budget. */
const blackSpecials = (
  snap: ScFenSnapshot,
  map: Map<Square, ScPiece>,
  king: Square,
  sieged: ReadonlySet<Square>,
  storedFor: (color: PieceColor) => number,
): Candidate[] => {
  const out: Candidate[] = [];
  const threatened = isSquareAttackedBy(map, king, "w");

  // spawn — adjacent to the King; afford units within stored minerals.
  // Pawns must never resolve onto an edge row (rank 1 or 8 breaks chess.js), so
  // those squares are excluded for pawn spawns.
  const adjacent = neighbors(king).filter((at) => !map.has(at));
  for (const unit of ["p", "n", "b", "r"] as const) {
    if (UNIT_COST[unit] > storedFor("b")) continue;
    for (const to of adjacent) {
      if (unit === "p" && (rankOf(to) === 1 || rankOf(to) === 8)) continue;
      let score = CENTER * centerScore(to) + PROMOTE_RANK * (8 - rankOf(to));
      if (threatened) score += TRADE;
      if (isSquareAttackedBy(map, to, "w")) score -= ATTACKED_PENALTY;
      out.push({
        action: { timing: "B", kind: "spawn", color: "b", from: king, to, unit },
        score,
        spendMinerals: UNIT_COST[unit],
      });
    }
  }

  // pawnDouble — gas step +1 forward only (stacks with classical same turn).
  // Landing on the last rank is excluded (promotion is classical).
  for (const [from, piece] of map) {
    if (piece.color !== "b" || piece.type !== "p") continue;
    const to = pawnSingleTarget(from, "b");
    if (!to || map.has(to)) continue;
    if (rankOf(to) === 1) continue;
    let score = CENTER * centerScore(to) + PROMOTE_RANK * (8 - rankOf(to));
    if (isSquareAttackedBy(map, to, "w")) score -= ATTACKED_PENALTY;
    out.push({ action: { timing: "B", kind: "pawnDouble", color: "b", from, to }, score });
  }

  // knightMine — lay a Spider Mine on the knight's square.
  for (const [from, piece] of map) {
    if (piece.color !== "b" || piece.type !== "n") continue;
    if (mineAt(snap.mines, from)) continue;
    if (minesFor(snap.mines, "b").length >= MAX_MINES_PER_SIDE) continue;
    out.push({
      action: { timing: "B", kind: "knightMine", color: "b", from, to: from },
      score: TRADE * 2,
    });
  }

  // bishopSnipe — Charon missiles at a unique diagonal enemy queen.
  for (const [from, piece] of map) {
    if (piece.color !== "b" || piece.type !== "b") continue;
    const target = charonTargetQueenFromPlacement(snap.placement, from);
    if (target) {
      out.push({
        action: { timing: "B", kind: "bishopSnipe", color: "b", from, to: target },
        score: TRADE * (1 + UNIT_COST.q - UNIT_COST.b),
      });
    }
  }

  // queenWarp — Tactical Jump to the best empty square.
  for (const [from, piece] of map) {
    if (piece.color !== "b" || piece.type !== "q") continue;
    for (let f = 0; f < 8; f += 1) {
      for (let r = 1; r <= 8; r += 1) {
        const to = `${FILES[f]}${r}` as Square;
        if (map.has(to)) continue;
        out.push({
          action: { timing: "B", kind: "queenWarp", color: "b", from, to },
          score: CENTER * centerScore(to),
        });
      }
    }
  }

  // rookSiege — 1-gas TOGGLE. Pack for 9×9 vision / artillery; unpack only
  // under fire (cannot flee while packed). Also pack when the enemy king is
  // outside tank 5×5 but inside siege 9×9 (pack-for-vision hunt).
  for (const [from, piece] of map) {
    if (piece.color !== "b" || piece.type !== "r") continue;
    const packed = sieged.has(from);
    const underFire = isSquareAttackedBy(map, from, "w");
    if (packed && !underFire) continue;
    let score = packed ? ATTACKED_PENALTY : TRADE * 2;
    if (!packed) {
      const wk = findKing(map, "w");
      if (wk) {
        const { file: rf, rank: rr } = parseSquare(from);
        const { file: kf, rank: kr } = parseSquare(wk);
        const cheb = Math.max(Math.abs(rf - kf), Math.abs(rr - kr));
        // Tank vision ~5×5 (cheb≤2); siege 9×9 (cheb≤4).
        if (cheb > 2 && cheb <= 4) score = Math.max(score, ATTACK_KING);
      }
    }
    out.push({
      action: { timing: "B", kind: "rookSiege", color: "b", from, to: from },
      score,
    });
  }

  return out.filter(
    (c) => specialGasCost(c.action.kind as ScSpecialKind) <= snap.gas.b,
  );
};

const cloneWithMove = (
  map: Map<Square, ScPiece>,
  move: Move,
  sieged?: ReadonlySet<Square>,
): Map<Square, ScPiece> => {
  const next = new Map(map);
  const piece = next.get(move.from);
  if (!piece) return next;
  // A sieged rook fires in place — the resolver will not relocate it.
  if (move.firesInPlace || (piece.type === "r" && sieged?.has(move.from))) {
    next.delete(move.to);
    return next;
  }
  next.delete(move.from);
  next.set(move.to, {
    type: move.promotion ?? piece.type,
    color: piece.color,
  });
  return next;
};

const scoreMove = (move: Move, context: {
  map: Map<Square, ScPiece>;
  king: Square;
  kingThreatened: boolean;
  whiteKingVisible: boolean;
  whiteKing: Square | null;
  sieged: ReadonlySet<Square>;
}): number => {
  const { map, king, kingThreatened, whiteKingVisible, whiteKing, sieged } = context;
  const piece = map.get(move.from);
  if (!piece) return Number.NEGATIVE_INFINITY;

  let score = CENTER * centerScore(move.to);
  const isKingMove = piece.type === "k";

  if (isKingMove) {
    // Evaluate the destination on the POST-move board: the King itself can be
    // the piece blocking the checking ray, so sliding along that ray looks safe
    // on the pre-move map but stays in check.
    const destSafe = !isSquareAttackedBy(cloneWithMove(map, move, sieged), move.to, "w");
    if (kingThreatened) {
      // Flee: strong pull to a safe square, hard penalty for walking into fire.
      score += KING_SAFETY * (destSafe ? 1 : -1);
    } else {
      // No intrinsic value in strolling an unthreatened King: an idle bonus here
      // outranks every real action (spawning, unpacking a pinned tank, pushing a
      // pawn) and makes the commander wander. Only the centre pull applies.
      if (!destSafe) score -= KING_SAFETY;
    }
  } else {
    if (move.capture) {
      const victimValue = UNIT_COST[move.capture.type];
      const attackerValue = UNIT_COST[piece.type];
      if (victimValue > attackerValue) score += TRADE * (1 + (victimValue - attackerValue));
      else if (victimValue === attackerValue) score += TRADE;
      else score += TRADE * 0.5;
    }
    if (piece.type === "p") {
      score += PROMOTE_RANK * (8 - rankOf(move.to));
      if (rankOf(move.to) === 1) score += PROMOTION_BONUS;
    }
    // Blunder guard: do not park a unit on a square the enemy already covers.
    if (!move.capture && isSquareAttackedBy(map, move.to, "w")) score -= ATTACKED_PENALTY;
  }

  // Strategy 4 — attack the enemy King, fog-gated: only counts when black can
  // see it. Note a classical move ONTO the king square is dropped by the
  // resolver and the turn-start implicit check chips HP from the attacker's
  // standing ray anyway — queueing it would burn the action for nothing. So we
  // only reward moves that establish or keep a checking ray from the square we
  // actually land on, and leave the free chip to the engine.
  //
  // Our own King is excluded on purpose. Stepping face-to-face does chip the
  // enemy King, but the exchange is mutual, so a defensive commander must not be
  // paid for walking into a drain it may not win. The King-safety guard already
  // prices adjacency as unsafe; rewarding it here would fight that.
  if (whiteKing && whiteKingVisible && move.to !== whiteKing && !isKingMove) {
    const after = cloneWithMove(map, move, sieged);
    if (attacksSquare(after, move.to, whiteKing)) score += ATTACK_KING;
  }

  // Cheap king-centered shelter: a square adjacent to the King keeps him protected.
  if (!isKingMove && piece.type === "p") {
    const { file: kFile, rank: kRank } = parseSquare(king);
    const { file, rank } = parseSquare(move.to);
    if (Math.abs(file - kFile) <= 1 && Math.abs(rank - kRank) <= 1) score += TRADE;
  }

  return score;
};

const bestOf = <T extends Candidate>(candidates: T[]): T | null => {
  let best: T | null = null;
  for (const c of candidates) {
    if (!best || c.score > best.score) best = c;
  }
  return best;
};

/**
 * Occupancy after a candidate resolves, used to test whether the action really
 * clears a check on our King. Actions that do not move or remove a unit
 * (knightMine / rookSiege) leave the board unchanged.
 */
const simulateCandidate = (
  map: Map<Square, ScPiece>,
  action: ScActionInput,
  sieged: ReadonlySet<Square>,
): Map<Square, ScPiece> => {
  const next = new Map(map);
  const { from, to } = action;
  if (!to) return next;
  if (action.kind === "spawn") {
    const unit = "unit" in action ? action.unit : undefined;
    if (unit) next.set(to, { type: unit, color: "b" });
    return next;
  }
  if (action.kind === "bishopSnipe") {
    // Charon removes the target queen — which may be the checker.
    next.delete(to);
    return next;
  }
  if (action.kind === "classical" || action.kind === "pawnDouble" || action.kind === "queenWarp") {
    const piece = next.get(from);
    // A classical move onto a king square is dropped: the mover stays put.
    if (!piece || (action.kind === "classical" && next.get(to)?.type === "k")) return next;
    // A sieged rook fires without relocating (the resolver refuses to move it),
    // so the victim dies but the rook keeps blocking its own square.
    if (piece.type === "r" && sieged.has(from)) {
      next.delete(to);
      return next;
    }
    const promotion = "promotion" in action ? action.promotion : undefined;
    next.delete(from);
    next.set(to, { type: promotion ?? piece.type, color: piece.color });
    return next;
  }
  return next;
};

/** True when the action leaves our King off every chip-capable attack ray. */
const clearsCheck = (
  map: Map<Square, ScPiece>,
  action: ScActionInput,
  sieged: ReadonlySet<Square>,
): boolean => {
  const after = simulateCandidate(map, action, sieged);
  const king = findKing(after, "b");
  return !!king && !isSquareAttackedBy(after, king, "w");
};

/**
 * Decide one black action for an open planning window.
 * Returns the input snapshot untouched when black already queued, the phase is
 * not P, or no action scores above nothing.
 */
export const adjutant = (
  snap: ScFenSnapshot,
  ctx?: AdjutantContext,
): AdjutantResult => {
  if (snap.phase !== "P") return { snapshot: snap };
  if (snap.queue?.actions.some((a) => a.color === "b")) return { snapshot: snap };

  const storedFor = ctx?.storedFor ?? estimateStoredFor(snap);
  const map = placementToMap(snap.placement);
  const king = findKing(map, "b");
  if (!king) return { snapshot: snap };

  const sieged = new Set(snap.siegedRooks ?? []);

  // Context 3 — side vision through fog (lit ∪ revealed enemy pieces).
  // An unreadable board degrades to fighting blind rather than crashing the host.
  const whiteKing = findKing(map, "w");
  let whiteKingVisible = false;
  try {
    const vision = getSideVision(new Chess(classicFenFromSc(snap, "b")), "b", {
      mines: snap.mines,
      rookModeFor: (s) => (sieged.has(s) ? "siege" : "tank"),
    });
    whiteKingVisible =
      !!whiteKing &&
      (vision.litSquares.has(whiteKing) || vision.revealedPieces.has(whiteKing));
  } catch {
    whiteKingVisible = false;
  }

  // Context 1 + 2 — candidates, scored against the strategy stack.
  // An adjacent enemy King counts: face-to-face kings chip each other.
  const kingThreatened = isSquareAttackedBy(map, king, "w");
  const moves = blackMoves(map, sieged);
  const moveCandidates: Candidate[] = moves.map((m) => ({
    action: {
      timing: "C",
      kind: "classical",
      color: "b",
      from: m.from,
      to: m.to,
      ...(m.promotion ? { promotion: m.promotion } : {}),
    },
    score: scoreMove(m, { map, king, kingThreatened, whiteKingVisible, whiteKing, sieged }),
  }));
  const specialCandidates = blackSpecials(snap, map, king, sieged, storedFor);

  /**
   * Strategy 1 — protect the King above all, as a single uniform rule: any
   * action that leaves the King on a chip-capable ray is crushed by
   * KING_SAFETY. This covers all three cases at once — fleeing a real check,
   * interposing / capturing the checker, and (in the quiet case) not
   * self-exposing a pinned piece, which raw `attacksSquare` cannot see because
   * it ignores absolute pins.
   */
  const guarded = [...specialCandidates, ...moveCandidates].map((c) =>
    clearsCheck(map, c.action, sieged) ? c : { ...c, score: c.score - KING_SAFETY },
  );

  // Specials lead the pool, so they win exact score ties.
  const chosen = bestOf(guarded);

  if (!chosen) return { snapshot: snap };

  // Commit through the SCFEN appenders (gas / queue-shape legality, no-op on error).
  try {
    const next = addScAction({ snapshot: { ...snap, queue: snap.queue ?? { actions: [] } }, action: chosen.action }).snapshot;
    return chosen.spendMinerals
      ? { snapshot: next, spendMinerals: { color: "b", amount: chosen.spendMinerals } }
      : { snapshot: next };
  } catch (e) {
    if (e instanceof AddScActionError) return { snapshot: snap };
    throw e;
  }
};

/** @deprecated Use {@link adjutant}. */
export const kingHuntBrain = adjutant;
