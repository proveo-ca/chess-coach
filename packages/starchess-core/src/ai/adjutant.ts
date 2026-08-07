/**
 * Adjutant — deterministic StarChess opponent planner (King Hunt / Single Player).
 * Feeds the live `autoQueueOpponent` slot (pure; no Solid / store deps).
 *
 * Context read every planning turn:
 *  1. all legal specials (spawn / pawnDouble / knightMine / bishopSnipe /
 *     rookSiege / queenWarp) within this turn's gas budget,
 *  2. pawn gas+classical stacks; Charon (B) + classical (C) same-turn combos;
 *     mine (B) + Vulture relocate (C); spawn (B) + classical (C),
 *  3. all SC-legal classical moves via {@link scMovesFor},
 *  4. side vision — fog picks the posture (what can be seen),
 *  5. material — deployed supply + stored minerals (host bank).
 *
 * Dynamic postures (weights recompute each turn from hub + fog intel):
 *  - expand — no hub yet → map control (siege / mines / diagonals)
 *  - seek   — hub held, enemy King fogged → find the King from hints
 *             (visible deploys, pawn files/clumps; siege/scout toward focus)
 *  - hunt   — hub held + enemy King visible → attack King is #1 (aggressive)
 * Absolute overrides: protect own King → queenWarp escape → near-promote rush
 * (≤2 steps) → Charon stacks.
 * Engagement (in range): equal material → always attack; savable queen →
 * defend; otherwise defend threatened non-queens (flee to safety).
 *
 * Color-agnostic: plays `ctx.color` (default `"b"` for backward compatibility).
 *
 * Deterministic.
 *
 * // SPEC: _spec/apps/starchess/starchess-mode.puml, _spec/apps/starchess/demos.puml
 */

import type { Square } from "chess.js";

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
import { specialGasCost } from "../scfen";
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
   * Side the Adjutant plays. Defaults to `"b"` for existing tests / demos.
   */
  color?: PieceColor;
  /**
   * Stored minerals per side (host Command Center bank). Injected by the live
   * story from the Solid store; defaults to a deterministic income estimate so
   * snap-only callers still see spawn affordability.
   */
  storedFor?: (color: PieceColor) => number;
};

const FILES = "abcdefgh";

const enemyOf = (color: PieceColor): PieceColor => (color === "w" ? "b" : "w");

/** Progress toward our promotion rank (higher = closer). */
const promoteProgress = (rank: number, us: PieceColor): number =>
  us === "b" ? 8 - rank : rank - 1;

/** Squares remaining until our last rank (0 = already there). */
const stepsToPromotion = (rank: number, us: PieceColor): number =>
  us === "b" ? rank - 1 : 8 - rank;

/** True when `rank` is our last (promotion) rank. */
const isLastRank = (rank: number, us: PieceColor): boolean =>
  us === "b" ? rank === 1 : rank === 8;

/** Absolute — never posture-scaled. */
const KING_SAFETY = 10_000;
const QUEEN_ESCAPE = 8_000;
/**
 * Pawn ≤2 steps from last rank — rush promote (gas+move when needed).
 * Below King/queen survival; above equal trades / hunt checks.
 */
const NEAR_PROMOTE_RUSH = 6_000;
const CHARON_COMBO = 2_500;
/** Equal-material capture when in range — always take the trade. */
const EQUAL_TRADE_ATTACK = 2_400;
/** Flee a threatened non-queen to a safe square (defend). */
const DEFEND_UNIT = 1_800;

/**
 * Absolute rush when a pawn starts ≤2 steps from promotion and this move
 * advances (gas+classical two-step or classical finish).
 */
const nearPromoteRush = (
  fromRank: number,
  toRank: number,
  us: PieceColor,
): number => {
  const fromSteps = stepsToPromotion(fromRank, us);
  if (fromSteps > 2 || fromSteps <= 0) return 0;
  const toSteps = stepsToPromotion(toRank, us);
  if (toSteps >= fromSteps) return 0;
  // Completing promotion from 1 step out.
  if (fromSteps === 1 && toSteps === 0) return NEAR_PROMOTE_RUSH + 400;
  // 2 steps out: prefer gas+move that finishes both ranks this turn.
  if (fromSteps === 2 && toSteps === 0) return NEAR_PROMOTE_RUSH;
  // Single-step advance from 2 out — useful but must not beat the full rush.
  if (fromSteps === 2 && toSteps === 1) return Math.floor(NEAR_PROMOTE_RUSH * 0.35);
  return 0;
};

/** Posture from map control + fog vision — drives all mid-game weights. */
type Posture = "expand" | "seek" | "hunt";

type StrategyWeights = {
  siegeHub: number;
  mapControl: number;
  diagonal: number;
  promoteRank: number;
  promotionBonus: number;
  /** Checking the visible enemy King — #1 offensive in hunt. */
  attackKing: number;
  /** Closing Chebyshev distance toward a visible enemy King. */
  chaseKing: number;
  /** Closing toward suspected King focus (seek posture). */
  seekFocus: number;
  center: number;
  trade: number;
  attackedPenalty: number;
};

/** Fog intel: where the hidden King is likely, from what our side can see. */
type KingIntel = {
  /** Weighted centroid of visible enemy cues (or a weak home prior). */
  focus: Square;
  /** Cue mass — higher when deploys / pawn clumps are clear. */
  strength: number;
};

const WEIGHTS: Record<Posture, StrategyWeights> = {
  /** No hub yet — take the centre before anything else. */
  expand: {
    siegeHub: 1_200,
    mapControl: 800,
    diagonal: 400,
    promoteRank: 0,
    promotionBonus: 0,
    attackKing: 0,
    chaseKing: 0,
    seekFocus: 0,
    center: 50,
    trade: 100,
    attackedPenalty: 400,
  },
  /**
   * Hub held, King fogged — find the King. Promote is secondary to scouting
   * toward deploy / pawn-file cues (and siege vision that would reveal them).
   */
  seek: {
    siegeHub: 950,
    mapControl: 480,
    diagonal: 360,
    promoteRank: 60,
    promotionBonus: 420,
    attackKing: 0,
    chaseKing: 0,
    seekFocus: 700,
    center: 30,
    trade: 100,
    attackedPenalty: 400,
  },
  /** Hub held + King visible — aggressive: attack King outranks promote/control. */
  hunt: {
    siegeHub: 180,
    mapControl: 140,
    diagonal: 280,
    promoteRank: 100,
    promotionBonus: 700,
    attackKing: 3_500,
    chaseKing: 450,
    seekFocus: 0,
    center: 25,
    trade: 120,
    attackedPenalty: 400,
  },
};

const resolvePosture = (hubHeld: boolean, enemyKingVisible: boolean): Posture => {
  if (!hubHeld) return "expand";
  if (enemyKingVisible) return "hunt";
  return "seek";
};

const rankOf = (s: Square): number => Number(s[1]);

const chebyshev = (a: Square, b: Square): number => {
  const pa = parseSquare(a);
  const pb = parseSquare(b);
  return Math.max(Math.abs(pa.file - pb.file), Math.abs(pa.rank - pb.rank));
};

/**
 * Infer a King-search focus from fog-visible enemy units only.
 * Hints (strong → weak):
 *  1. Pawn **files** — the King deployed Marines nearby, so each visible
 *     pawn’s file is a corridor back toward the enemy home band
 *     (ranks 1–2 if enemy is white, ranks 7–8 if enemy is black).
 *  2. Pawn clumps — dense shelter reinforces those files.
 *  3. Deployed non-pawns — Command Center drops beside the King.
 * With no cues, fall back to enemy home (`e2` / `e7`).
 */
const gatherKingIntel = (
  map: Map<Square, ScPiece>,
  lit: ReadonlySet<Square>,
  revealed: ReadonlySet<Square>,
  enemy: PieceColor,
): KingIntel => {
  const visible: { square: Square; piece: ScPiece }[] = [];
  for (const [square, piece] of map) {
    if (piece.color !== enemy) continue;
    if (piece.type === "k") continue; // if visible, posture is hunt — ignore here
    if (lit.has(square) || revealed.has(square)) {
      visible.push({ square, piece });
    }
  }

  const defaultFocus: Square = enemy === "w" ? "e2" : "e7";
  if (visible.length === 0) {
    return { focus: defaultFocus, strength: 0 };
  }

  // File histogram of visible pawns — King deploy corridors.
  const pawnFiles = new Map<number, number>();
  for (const { square, piece } of visible) {
    if (piece.type !== "p") continue;
    const file = parseSquare(square).file;
    let neighbours = 0;
    for (const other of visible) {
      if (other.piece.type !== "p") continue;
      if (other.square === square) continue;
      if (chebyshev(other.square, square) <= 2) neighbours += 1;
    }
    pawnFiles.set(file, (pawnFiles.get(file) ?? 0) + 1 + neighbours);
  }

  let sumFile = 0;
  let sumRank = 0;
  let mass = 0;

  // Primary: each pawn file pulls hard toward the enemy home band on that file.
  const homeRank = enemy === "w" ? 2 : 7;
  for (const [file, density] of pawnFiles) {
    const fileW = 8 + density * 4;
    sumFile += file * fileW;
    sumRank += homeRank * fileW;
    mass += fileW;
  }

  for (const { square, piece } of visible) {
    const { file, rank } = parseSquare(square);
    let w: number;
    if (piece.type === "p") {
      // Secondary: current pawn square (advance / clump position).
      let neighbours = 0;
      for (const other of visible) {
        if (other.piece.type !== "p") continue;
        if (other.square === square) continue;
        if (chebyshev(other.square, square) <= 2) neighbours += 1;
      }
      w = 1.5 + neighbours * 2;
    } else {
      // Deployed unit — spawn was adjacent to King; back-rank bias for enemy home.
      w = 4 + UNIT_COST[piece.type];
      if (enemy === "w" ? rank <= 3 : rank >= 6) w += 3;
    }
    sumFile += file * w;
    sumRank += rank * w;
    mass += w;
  }

  const file = Math.max(0, Math.min(7, Math.round(sumFile / mass)));
  const rank = Math.max(1, Math.min(8, Math.round(sumRank / mass)));
  return {
    focus: `${FILES[file]}${rank}` as Square,
    strength: mass,
  };
};

/** Contested-square pull: d/e + ranks 4/5 strong, c/f + 3/6 weaker. */
const centerScore = (s: Square): number => {
  const file = FILES.indexOf(s[0]);
  const rank = rankOf(s);
  const fc = file >= 3 && file <= 4 ? 2 : file >= 2 && file <= 5 ? 1 : 0;
  const rc = rank >= 4 && rank <= 5 ? 2 : rank >= 3 && rank <= 6 ? 1 : 0;
  return fc + rc;
};

/** True for the d4–e5 siege / mine hub (and immediate neighbours d5/e4). */
const isSiegeHub = (s: Square): boolean => {
  const file = FILES.indexOf(s[0]);
  const rank = rankOf(s);
  return file >= 3 && file <= 4 && rank >= 4 && rank <= 5;
};

/** Flank mine corridors once the centre hub is already mined. */
const isFlankMineFile = (s: Square): boolean => {
  const f = s[0];
  return f === "a" || f === "h";
};

/** Our side already planted on d4–e5 — open a/h as the next mine sites. */
const hubMineTaken = (snap: ScFenSnapshot, us: PieceColor): boolean =>
  minesFor(snap.mines, us).some((m) => isSiegeHub(m.at));

/**
 * Preferred Spider Mine sites: hub first; a/h files only after hub is taken.
 * Returns a weight multiplier (0 = do not plant here).
 */
const mineSiteWeight = (at: Square, hubTaken: boolean): number => {
  if (isSiegeHub(at)) return 1;
  if (hubTaken && isFlankMineFile(at)) return 0.9;
  return 0;
};

/** Our side already occupies the d4–e5 hub — map control asserted. */
const hasHubPresence = (map: Map<Square, ScPiece>, us: PieceColor): boolean => {
  for (const [square, piece] of map) {
    if (piece.color === us && isSiegeHub(square)) return true;
  }
  return false;
};

/** Destination is empty and not covered by the enemy. */
const isSafeSquare = (
  map: Map<Square, ScPiece>,
  at: Square,
  enemy: PieceColor,
): boolean => !map.has(at) && !isSquareAttackedBy(map, at, enemy);

/**
 * Deterministic bank estimate for snap-only callers (the live story passes the
 * real store via `ctx.storedFor`). Mirrors the story's 1-mineral start + income,
 * then subtracts one mineral per deployed unit beyond the King as a rough spend
 * ledger. Never the source of truth — the host bank gates the actual debit.
 */
const estimateStoredFor =
  (snap: ScFenSnapshot, us: PieceColor) =>
  (_color: PieceColor): number => {
    let stored = 1;
    for (let turn = 2; turn <= snap.turn; turn += 1) {
      stored += incomeForTurn(turn);
    }
    let deployed = 0;
    for (const piece of placementToMap(snap.placement).values()) {
      if (piece.color === us) deployed += 1;
    }
    return Math.min(MAX_STORED_MATERIAL, Math.max(0, stored - Math.max(0, deployed - 1)));
  };

type Candidate = {
  /** One or more actions to append (pawn gas stack = B then C). */
  actions: ScActionInput[];
  score: number;
  /** Debit against stored minerals when the plan includes a spawn. */
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

type ScoreCtx = {
  map: Map<Square, ScPiece>;
  king: Square;
  kingThreatened: boolean;
  enemyKingVisible: boolean;
  enemyKing: Square | null;
  sieged: ReadonlySet<Square>;
  posture: Posture;
  weights: StrategyWeights;
  intel: KingIntel;
  /** True when our side already has a Spider Mine on the d4–e5 hub. */
  hubMineTaken: boolean;
  us: PieceColor;
  enemy: PieceColor;
};

/** Classical candidates from the shared SC movegen (filter king-square traps). */
const sideMoves = (
  map: Map<Square, ScPiece>,
  us: PieceColor,
  sieged: ReadonlySet<Square>,
): Move[] =>
  scMovesFor(map, us, { siegedRooks: sieged })
    .filter((m: ScMove) => !m.dropsAtResolve)
    .map((m) => ({
      from: m.from,
      to: m.to,
      capture: m.capture,
      firesInPlace: m.firesInPlace,
      ...(m.promotion ? { promotion: m.promotion } : {}),
    }));

const asCandidate = (
  action: ScActionInput,
  score: number,
  spendMinerals?: number,
): Candidate => ({
  actions: [action],
  score,
  ...(spendMinerals != null ? { spendMinerals } : {}),
});

/** Legal specials for our side within this turn's gas budget. */
const sideSpecials = (
  snap: ScFenSnapshot,
  map: Map<Square, ScPiece>,
  king: Square,
  us: PieceColor,
  enemy: PieceColor,
  sieged: ReadonlySet<Square>,
  storedFor: (color: PieceColor) => number,
  weights: StrategyWeights,
  intel: KingIntel,
): Candidate[] => {
  const out: Candidate[] = [];
  const threatened = isSquareAttackedBy(map, king, enemy);
  const {
    siegeHub,
    mapControl,
    promoteRank,
    seekFocus,
    center,
    trade,
    attackedPenalty,
  } = weights;

  // spawn — adjacent to the King; afford units within stored minerals.
  // Pawns must never resolve onto an edge row (rank 1 or 8 breaks chess.js), so
  // those squares are excluded for pawn spawns.
  const adjacent = neighbors(king).filter((at) => !map.has(at));
  for (const unit of ["p", "n", "b", "r"] as const) {
    if (UNIT_COST[unit] > storedFor(us)) continue;
    for (const to of adjacent) {
      if (unit === "p" && (rankOf(to) === 1 || rankOf(to) === 8)) continue;
      let score = center * centerScore(to) + promoteRank * promoteProgress(rankOf(to), us);
      if (threatened) score += trade;
      if (isSquareAttackedBy(map, to, enemy)) score -= attackedPenalty;
      out.push(
        asCandidate(
          { timing: "B", kind: "spawn", color: us, from: king, to, unit },
          score,
          UNIT_COST[unit],
        ),
      );
    }
  }

  // pawnDouble — gas step +1 forward only (lone B; stacks with classical below).
  // Landing on the last rank is excluded (promotion is classical).
  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "p") continue;
    const to = pawnSingleTarget(from, us);
    if (!to || map.has(to)) continue;
    if (isLastRank(rankOf(to), us)) continue;
    let score = center * centerScore(to) + promoteRank * promoteProgress(rankOf(to), us);
    score += nearPromoteRush(rankOf(from), rankOf(to), us);
    if (isSquareAttackedBy(map, to, enemy)) score -= attackedPenalty;
    out.push(
      asCandidate({ timing: "B", kind: "pawnDouble", color: us, from, to }, score),
    );
  }

  // knightMine — only on d4–e5 hub, or a/h files once the hub is mined.
  const hubTaken = hubMineTaken(snap, us);
  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "n") continue;
    if (mineAt(snap.mines, from)) continue;
    if (minesFor(snap.mines, us).length >= MAX_MINES_PER_SIDE) continue;
    const site = mineSiteWeight(from, hubTaken);
    if (site <= 0) continue;
    out.push(
      asCandidate(
        { timing: "B", kind: "knightMine", color: us, from, to: from },
        siegeHub * site + trade,
      ),
    );
  }

  // bishopSnipe — Charon missiles at a unique diagonal enemy queen (2 gas).
  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "b") continue;
    const target = charonTargetQueenFromPlacement(snap.placement, from);
    if (target) {
      out.push(
        asCandidate(
          { timing: "B", kind: "bishopSnipe", color: us, from, to: target },
          trade * (1 + UNIT_COST.q - UNIT_COST.b) + CHARON_COMBO * 0.35,
        ),
      );
    }
  }

  // queenWarp — Tactical Jump; prioritise escaping fire to a safe square.
  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "q") continue;
    const underFire = isSquareAttackedBy(map, from, enemy);
    for (let f = 0; f < 8; f += 1) {
      for (let r = 1; r <= 8; r += 1) {
        const to = `${FILES[f]}${r}` as Square;
        if (map.has(to)) continue;
        let score = center * centerScore(to);
        if (underFire) {
          score += isSafeSquare(map, to, enemy) ? QUEEN_ESCAPE : -QUEEN_ESCAPE * 0.5;
        } else if (isSafeSquare(map, to, enemy)) {
          score += trade;
        }
        out.push(
          asCandidate(
            { timing: "B", kind: "queenWarp", color: us, from, to },
            score,
          ),
        );
      }
    }
  }

  // rookSiege — 1-gas TOGGLE. Prefer packing on the d4–e5 hub for map control;
  // unpack only under fire. In seek, pack when 9×9 would cover the King focus.
  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "r") continue;
    const packed = sieged.has(from);
    const underFire = isSquareAttackedBy(map, from, enemy);
    if (packed && !underFire) continue;
    let score = packed ? attackedPenalty : trade * 2;
    if (!packed) {
      if (isSiegeHub(from)) score = Math.max(score, siegeHub);
      else score += mapControl * centerScore(from);
      const ek = findKing(map, enemy);
      if (ek) {
        const cheb = chebyshev(from, ek);
        // Tank vision ~5×5 (cheb≤2); siege 9×9 (cheb≤4).
        if (cheb > 2 && cheb <= 4) {
          score = Math.max(score, mapControl * 1.5);
        }
      }
      // Seek: packing reveals a fogged focus inside siege 9×9.
      if (seekFocus > 0 && chebyshev(from, intel.focus) <= 4) {
        score = Math.max(
          score,
          siegeHub + seekFocus * (1 + Math.min(3, intel.strength / 4)),
        );
      }
    }
    out.push(
      asCandidate(
        { timing: "B", kind: "rookSiege", color: us, from, to: from },
        score,
      ),
    );
  }

  return out.filter(
    (c) =>
      specialGasCost(c.actions[0]!.kind as ScSpecialKind) <= snap.gas[us],
  );
};

/**
 * Gas canister + same-forward classical on a pawn (UI stack form).
 * `endScTurn.rewriteClassicalAfterB` expands B from→mid + C from→mid into
 * C mid→far, so the pawn resolves two steps ahead. Skip when a free classical
 * double to `far` already exists.
 */
const sidePawnGasStacks = (
  snap: ScFenSnapshot,
  map: Map<Square, ScPiece>,
  moves: readonly Move[],
  ctx: ScoreCtx,
): Candidate[] => {
  const { us } = ctx;
  if (specialGasCost("pawnDouble") > snap.gas[us]) return [];
  const out: Candidate[] = [];
  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "p") continue;
    const mid = pawnSingleTarget(from, us);
    if (!mid || map.has(mid) || isLastRank(rankOf(mid), us)) continue;
    const far = pawnSingleTarget(mid, us);
    if (!far || map.has(far)) continue;
    if (moves.some((m) => m.from === from && m.to === far)) continue;

    const promotion: SpawnPiece | undefined = isLastRank(rankOf(far), us)
      ? "q"
      : undefined;
    const synthetic: Move = {
      from,
      to: far,
      capture: null,
      ...(promotion ? { promotion } : {}),
    };
    out.push({
      actions: [
        { timing: "B", kind: "pawnDouble", color: us, from, to: mid },
        {
          timing: "C",
          kind: "classical",
          color: us,
          from,
          to: mid,
          ...(promotion ? { promotion } : {}),
        },
      ],
      // Two-step stack beats a lone gas step; near-promote rush (≤2 steps)
      // lands via scoreMove on the far square. Extra trade tie-break.
      score: scoreMove(synthetic, ctx) + ctx.weights.trade,
    });
  }
  return out;
};

/**
 * Command Center spawn (B) + any classical (C) in the same turn.
 * Planning validates each action on the pre-B board, so a classical `to` that
 * equals the spawn square must be dropped — after B that tile is occupied by
 * our own unit and the King (or other mover) would bounce / no-op.
 */
const sideSpawnStacks = (
  spawnCandidates: readonly Candidate[],
  moveCandidates: readonly Candidate[],
): Candidate[] => {
  const out: Candidate[] = [];
  for (const spawn of spawnCandidates) {
    const spawnAction = spawn.actions[0];
    if (!spawnAction || spawnAction.kind !== "spawn" || !spawnAction.to) continue;
    for (const move of moveCandidates) {
      const moveAction = move.actions[0];
      if (!moveAction || moveAction.timing !== "C" || moveAction.kind !== "classical") {
        continue;
      }
      if (moveAction.to === spawnAction.to) continue;
      out.push({
        actions: [spawnAction, moveAction],
        score: spawn.score + move.score,
        ...(spawn.spendMinerals != null ? { spendMinerals: spawn.spendMinerals } : {}),
      });
    }
  }
  return out;
};

/**
 * Same-turn gas special (B) + classical (C).
 * Charon burns 2 gas then a second unit still strikes; Vulture mines then hops;
 * threatened Battlecruiser warps then another unit develops.
 */
const sideSpecialClassicalStacks = (
  specialCandidates: readonly Candidate[],
  moveCandidates: readonly Candidate[],
  snap: ScFenSnapshot,
  map: Map<Square, ScPiece>,
  weights: StrategyWeights,
  us: PieceColor,
  enemy: PieceColor,
): Candidate[] => {
  const out: Candidate[] = [];
  const gasLeft = snap.gas[us];

  for (const special of specialCandidates) {
    const b = special.actions[0];
    if (!b || b.timing !== "B") continue;
    if (b.kind === "spawn" || b.kind === "pawnDouble") continue;
    const cost = specialGasCost(b.kind as ScSpecialKind);
    if (cost > gasLeft) continue;

    for (const move of moveCandidates) {
      const c = move.actions[0];
      if (!c || c.timing !== "C" || c.kind !== "classical") continue;

      // After Charon the Goliath stays put — any classical is fine (often another unit).
      // After mine / siege the actor may also relocate the same piece.
      // After queenWarp, classical from the same from is rewritten to the warp destination.
      if (b.kind === "queenWarp" && c.from !== b.from) {
        // Warp frees the Battlecruiser; a second unit may still act.
      } else if (b.kind === "bishopSnipe" && c.from === b.from) {
        // Bishop stays — classical from the same square would be a move after snipe (legal).
      }

      let score = special.score + move.score;
      if (b.kind === "bishopSnipe") {
        score += CHARON_COMBO;
        if (c.to && map.get(c.to)?.color === enemy) score += weights.trade * 2;
      }
      if (b.kind === "knightMine" && c.from === b.from) {
        // Plant then leave — deny the Vulture sitting on its own mine tile.
        score += weights.mapControl;
      }
      if (b.kind === "rookSiege" && c.from === b.from) {
        // Cannot relocate a tank in the same breath as packing — skip.
        continue;
      }
      if (b.kind === "queenWarp") {
        const underFire = isSquareAttackedBy(map, b.from, enemy);
        if (underFire && b.to && isSafeSquare(map, b.to, enemy)) score += QUEEN_ESCAPE * 0.15;
      }

      out.push({
        actions: [b, c],
        score,
      });
    }
  }
  return out;
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

const scoreMove = (move: Move, context: ScoreCtx): number => {
  const {
    map,
    king,
    kingThreatened,
    enemyKingVisible,
    enemyKing,
    sieged,
    weights,
    intel,
    us,
    enemy,
  } = context;
  const piece = map.get(move.from);
  if (!piece) return Number.NEGATIVE_INFINITY;

  const {
    siegeHub,
    mapControl,
    diagonal,
    promoteRank,
    promotionBonus,
    attackKing,
    chaseKing,
    seekFocus,
    center,
    trade,
    attackedPenalty,
  } = weights;

  let score = center * centerScore(move.to);
  const isKingMove = piece.type === "k";

  if (isKingMove) {
    // Evaluate the destination on the POST-move board: the King itself can be
    // the piece blocking the checking ray, so sliding along that ray looks safe
    // on the pre-move map but stays in check.
    const destSafe = !isSquareAttackedBy(cloneWithMove(map, move, sieged), move.to, enemy);
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
    // Engagement — in range of another unit: attack vs defend.
    const underFire = isSquareAttackedBy(map, move.from, enemy);
    if (move.capture) {
      const victimValue = UNIT_COST[move.capture.type];
      const attackerValue = UNIT_COST[piece.type];
      if (victimValue === attackerValue) {
        // Same material — always attack.
        score += EQUAL_TRADE_ATTACK;
      } else if (victimValue > attackerValue) {
        score += trade * (1 + (victimValue - attackerValue));
      } else {
        // Bad trade — only slightly tempting unless it also saves us.
        score += trade * 0.25;
      }
    }
    if (underFire) {
      const after = cloneWithMove(map, move, sieged);
      const destSafe = !isSquareAttackedBy(after, move.to, enemy);
      if (destSafe) {
        if (piece.type === "q") {
          // Queen that can be saved — defend (classical flee; warp scored in specials).
          score += QUEEN_ESCAPE * 0.4;
        } else {
          // Not a savable-queen case — defend by leaving the fire.
          score += DEFEND_UNIT;
        }
      } else if (!move.capture) {
        // Walking from fire into fire — worse than hanging still.
        score -= DEFEND_UNIT * 0.5;
      }
    }
    if (piece.type === "p") {
      score += promoteRank * promoteProgress(rankOf(move.to), us);
      if (isLastRank(rankOf(move.to), us)) score += promotionBonus;
      score += nearPromoteRush(rankOf(move.from), rankOf(move.to), us);
    }
    // Vulture — hop onto hub mine sites; once hub is mined, prefer a/h flanks.
    if (piece.type === "n") {
      const site = mineSiteWeight(move.to, context.hubMineTaken);
      if (site > 0) score += mapControl * (1 + site);
      else score += mapControl * centerScore(move.to) * 0.15;
    }
    // Goliath — claim long diagonals that bite the centre.
    if (piece.type === "b") {
      score += diagonal * Math.max(1, centerScore(move.to));
      if (enemyKing && attacksSquare(cloneWithMove(map, move, sieged), move.to, enemyKing)) {
        score += diagonal;
      }
    }
    // Siege Tank — walk into the d4–e5 hub before packing.
    if (piece.type === "r" && !sieged.has(move.from) && isSiegeHub(move.to)) {
      score += siegeHub * 0.75;
    }
    // Blunder guard: do not park a unit on a square the enemy already covers.
    if (!move.capture && isSquareAttackedBy(map, move.to, enemy)) score -= attackedPenalty;
  }

  // Enemy-King pressure — posture-scaled (0 unless hunt).
  // Classical onto the king square is dropped by the resolver; only reward
  // establishing a checking ray from the landing square. Own King excluded.
  if (
    attackKing > 0 &&
    enemyKing &&
    enemyKingVisible &&
    move.to !== enemyKing &&
    !isKingMove
  ) {
    const after = cloneWithMove(map, move, sieged);
    if (attacksSquare(after, move.to, enemyKing)) score += attackKing;
  }

  // Chase a visible King (hunt) — close Chebyshev distance.
  if (
    chaseKing > 0 &&
    enemyKing &&
    enemyKingVisible &&
    !isKingMove &&
    move.to !== enemyKing
  ) {
    const before = chebyshev(move.from, enemyKing);
    const after = chebyshev(move.to, enemyKing);
    if (after < before) score += chaseKing * (before - after);
  }

  // Seek a fogged King — close on deploy / pawn-clump focus (intel).
  if (seekFocus > 0 && !isKingMove) {
    const before = chebyshev(move.from, intel.focus);
    const after = chebyshev(move.to, intel.focus);
    if (after < before) {
      const cue = 1 + Math.min(2, intel.strength / 6);
      score += seekFocus * (before - after) * cue;
    }
    // Settling next to the focus (vision contact) is almost as good as finding it.
    if (after <= 1) score += seekFocus * 0.5 * (1 + Math.min(1, intel.strength / 8));
  }

  // Cheap king-centered shelter: a square adjacent to the King keeps him protected.
  if (!isKingMove && piece.type === "p") {
    const { file: kFile, rank: kRank } = parseSquare(king);
    const { file, rank } = parseSquare(move.to);
    if (Math.abs(file - kFile) <= 1 && Math.abs(rank - kRank) <= 1) score += trade;
  }

  return score;
};

/**
 * Occupancy after one action resolves, used to test whether the plan really
 * clears a check on our King. Actions that do not move or remove a unit
 * (knightMine / rookSiege) leave the board unchanged.
 */
const simulateAction = (
  map: Map<Square, ScPiece>,
  action: ScActionInput,
  sieged: ReadonlySet<Square>,
  us: PieceColor,
): Map<Square, ScPiece> => {
  const next = new Map(map);
  const { from, to } = action;
  if (!to) return next;
  if (action.kind === "spawn") {
    const unit = "unit" in action ? action.unit : undefined;
    if (unit) next.set(to, { type: unit, color: us });
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

/**
 * Apply a candidate plan in resolve order. UI pawn stacks (B+C same from/to)
 * relocate twice: mid, then far — matching `rewriteClassicalAfterB`.
 */
const simulatePlan = (
  map: Map<Square, ScPiece>,
  actions: readonly ScActionInput[],
  sieged: ReadonlySet<Square>,
  us: PieceColor,
): Map<Square, ScPiece> => {
  let next = map;
  const b = actions.find(
    (a) =>
      a.timing === "B" &&
      (a.kind === "pawnDouble" || a.kind === "queenWarp") &&
      a.to,
  );
  for (const action of actions) {
    if (
      action.timing === "C" &&
      b &&
      b.to &&
      action.from === b.from &&
      action.to === b.to
    ) {
      const fromP = parseSquare(b.from);
      const toP = parseSquare(b.to);
      const df = toP.file - fromP.file;
      const dr = toP.rank - fromP.rank;
      const farFile = toP.file + df;
      const farRank = toP.rank + dr;
      const far =
        farFile >= 0 && farFile <= 7 && farRank >= 1 && farRank <= 8
          ? (`${FILES[farFile]}${farRank}` as Square)
          : null;
      if (far) {
        next = simulateAction(
          next,
          {
            ...action,
            from: b.to,
            to: far,
          },
          sieged,
          us,
        );
        continue;
      }
    }
    next = simulateAction(next, action, sieged, us);
  }
  return next;
};

/** True when the plan leaves our King off every chip-capable attack ray. */
const clearsCheck = (
  map: Map<Square, ScPiece>,
  actions: readonly ScActionInput[],
  sieged: ReadonlySet<Square>,
  us: PieceColor,
  enemy: PieceColor,
): boolean => {
  const after = simulatePlan(map, actions, sieged, us);
  const king = findKing(after, us);
  return !!king && !isSquareAttackedBy(after, king, enemy);
};

/**
 * Decide one plan for an open planning window (our side = `ctx.color`, default black).
 * Returns the input snapshot untouched when our side already queued, the phase is
 * not P, or no action scores above nothing.
 */
export const adjutant = (
  snap: ScFenSnapshot,
  ctx?: AdjutantContext,
): AdjutantResult => {
  const us: PieceColor = ctx?.color ?? "b";
  const enemy = enemyOf(us);

  if (snap.phase !== "P") return { snapshot: snap };
  if (snap.queue?.actions.some((a) => a.color === us)) return { snapshot: snap };

  const storedFor = ctx?.storedFor ?? estimateStoredFor(snap, us);
  const map = placementToMap(snap.placement);
  const king = findKing(map, us);
  if (!king) return { snapshot: snap };

  const sieged = new Set(snap.siegedRooks ?? []);

  // Context 4 — side vision through fog (lit ∪ revealed enemy pieces).
  // An unreadable board degrades to fighting blind rather than crashing the host.
  const enemyKing = findKing(map, enemy);
  let enemyKingVisible = false;
  let litSquares: ReadonlySet<Square> = new Set();
  let revealedPieces: ReadonlySet<Square> = new Set();
  try {
    const vision = getSideVision(map, us, {
      mines: snap.mines,
      rookModeFor: (s) => (sieged.has(s) ? "siege" : "tank"),
    });
    litSquares = vision.litSquares;
    revealedPieces = vision.revealedPieces;
    enemyKingVisible =
      !!enemyKing &&
      (litSquares.has(enemyKing) || revealedPieces.has(enemyKing));
  } catch {
    enemyKingVisible = false;
  }

  // Context 1–3 — candidates, scored with posture-dynamic weights.
  // An adjacent enemy King counts: face-to-face kings chip each other.
  const kingThreatened = isSquareAttackedBy(map, king, enemy);
  const hubHeld = hasHubPresence(map, us);
  const posture = resolvePosture(hubHeld, enemyKingVisible);
  const weights = WEIGHTS[posture];
  const intel = gatherKingIntel(map, litSquares, revealedPieces, enemy);
  const scoreCtx: ScoreCtx = {
    map,
    king,
    kingThreatened,
    enemyKingVisible,
    enemyKing,
    sieged,
    posture,
    weights,
    intel,
    hubMineTaken: hubMineTaken(snap, us),
    us,
    enemy,
  };
  const moves = sideMoves(map, us, sieged);
  const moveCandidates: Candidate[] = moves.map((m) =>
    asCandidate(
      {
        timing: "C",
        kind: "classical",
        color: us,
        from: m.from,
        to: m.to,
        ...(m.promotion ? { promotion: m.promotion } : {}),
      },
      scoreMove(m, scoreCtx),
    ),
  );
  const specialCandidates = sideSpecials(
    snap,
    map,
    king,
    us,
    enemy,
    sieged,
    storedFor,
    weights,
    intel,
  );
  const stackCandidates = [
    ...sidePawnGasStacks(snap, map, moves, scoreCtx),
    ...sideSpawnStacks(specialCandidates, moveCandidates),
    ...sideSpecialClassicalStacks(
      specialCandidates,
      moveCandidates,
      snap,
      map,
      weights,
      us,
      enemy,
    ),
  ];

  /**
   * Strategy 1 — protect the King above all, as a single uniform rule: any
   * plan that leaves the King on a chip-capable ray is crushed by
   * KING_SAFETY. This covers all three cases at once — fleeing a real check,
   * interposing / capturing the checker, and (in the quiet case) not
   * self-exposing a pinned piece, which raw `attacksSquare` cannot see because
   * it ignores absolute pins.
   */
  const guarded = [...specialCandidates, ...stackCandidates, ...moveCandidates].map(
    (c) =>
      clearsCheck(map, c.actions, sieged, us, enemy)
        ? c
        : { ...c, score: c.score - KING_SAFETY },
  );

  // Specials / stacks lead the pool, so they win exact score ties.
  const ranked = [...guarded].sort((a, b) => b.score - a.score);

  // Commit through the SCFEN appenders; skip illegal stacks (try next-best).
  for (const chosen of ranked) {
    try {
      let next: ScFenSnapshot = { ...snap, queue: snap.queue ?? { actions: [] } };
      for (const action of chosen.actions) {
        next = addScAction({ snapshot: next, action }).snapshot;
      }
      return chosen.spendMinerals
        ? { snapshot: next, spendMinerals: { color: us, amount: chosen.spendMinerals } }
        : { snapshot: next };
    } catch (e) {
      if (e instanceof AddScActionError) continue;
      throw e;
    }
  }
  return { snapshot: snap };
};
