/**
 * Adjutant — deterministic StarChess opponent planner (King Hunt / Single Player).
 * Feeds the live `autoQueueOpponent` slot (pure; no Solid / store deps).
 *
 * Context read every planning turn:
 *  1. all legal specials (spawn / pawnDouble / knightMine / bishopSnipe /
 *     rookSiege / queenWarp) within this turn's gas budget,
 *  2. pawn gas+classical stacks; Charon (B) + classical (C) same-turn combos;
 *     mine (B) + Hoverbike relocate (C); spawn (B) + classical (C),
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
 * Spawn: prefer queens/rooks when minerals allow; skip light drops once the
 * bank can pay for a rook+ (unless the King is threatened). Always prioritize
 * getting **at least one bishop** first (Charon / diagonals). When an enemy
 * queen is visible, stack **more bishops** and **protect the King** (no resign).
 * Cap knights at 2 — prefer rooks after that. Pawn **file clusters**
 * (≥7 of ours in any 3 consecutive files) → trade / hunt undefended pawns;
 * knights sneak-check the King only onto uncovered squares.
 * Tactical awareness: enemy-attacked squares, friendly-protected squares, and
 * one-move enemy checks (e.g. a knight a hop from checking our King).
 * Back-rank cheese: prefer **deploy rook + capture** the checker (same-turn
 * spawn→classical from the new unit), else step the King to the rank in front.
 *
 * Color-agnostic: plays `ctx.color` (default `"b"` for backward compatibility).
 *
 * Deterministic.
 *
 * // SPEC: _spec/apps/starchess/starchess-mode.puml, _spec/apps/starchess/demos.puml, _spec/apps/starchess/core/adjutant/opponent-strategy.puml
 */

import type { Square } from "chess.js";

import {
  attacksSquare,
  findKing,
  isSquareAttackedBy,
  mapToPlacement,
  parseSquare,
  placementToMap,
  sq,
  type ScPiece,
} from "../board/placement";
import { rewriteClassicalAfterB } from "../resolve/submit-turn";
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
  ScAction,
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
 * Spawn a unit then capture the back-rank / checking threat with that same unit.
 * Above mere King flee — material win + survival (deploy + attack).
 */
const DEPLOY_ATTACK_SURVIVAL = KING_SAFETY + 3_500;
/**
 * Step the King off its back rank when a file-rook (or similar) threatens check.
 * Below deploy+attack; above quiet development.
 */
const BACKRANK_ESCAPE = 4_500;
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
/** Ensure ≥1 bishop before stacking rooks/queens (Charon / diagonals). */
const BISHOP_FIRST = 2_200;
/** Visible enemy queen — mass bishops for Charon angles (never resign). */
const BISHOP_VS_QUEEN = 3_500;
/** Visible enemy queen — prefer safe King moves / flee over hanging. */
const QUEEN_THREAT_KING = 1_500;
/** Cap Hoverbikes — after this many knights, prefer rook deploys. */
const MAX_KNIGHTS = 2;
/** Bonus to spawn rook once we already have {@link MAX_KNIGHTS} knights. */
const ROOK_AFTER_KNIGHTS = 900;
/**
 * Pawn congestion — density in a file window, not total army size.
 * Congested when ≥{@link CLUSTER_PAWNS} of our pawns sit in any
 * {@link CLUSTER_FILES} consecutive files (e.g. 7 pawns across c–e).
 */
const CLUSTER_FILES = 3;
const CLUSTER_PAWNS = 7;
/** Congested: trade pawn-for-pawn to clear clutter. */
const PAWN_TRADE = 750;
/** Congested / always: take an undefended enemy pawn. */
const HUNT_UNDEFENDED_PAWN = 950;
/**
 * Knight lands a check on a square the enemy does not cover (sneak).
 * Below equal-material trades (always take those); above quiet hops.
 */
const SNEAK_KNIGHT_CHECK = 2_000;

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
  /** Lit/revealed enemy queen — drive bishop spam + King safety. */
  enemyQueenVisible: boolean;
  enemyKing: Square | null;
  sieged: ReadonlySet<Square>;
  posture: Posture;
  weights: StrategyWeights;
  intel: KingIntel;
  /** True when our side already has a Spider Mine on the d4–e5 hub. */
  hubMineTaken: boolean;
  /** Own pawn clutter — trade / hunt undefended pawns. */
  congested: boolean;
  /**
   * Tactical map — squares attacked by the enemy / protected by us.
   * Used for sneak checks, undefended captures, and hang avoidance.
   */
  tactical: TacticalBoard;
  us: PieceColor;
  enemy: PieceColor;
};

/** Per-turn attack / threat awareness for scoring. */
type TacticalBoard = {
  /** Square is attacked by ≥1 enemy unit (current board). */
  enemyAttacks: (sq: Square) => boolean;
  /** Square is attacked by ≥1 friendly unit (current board). */
  friendlyProtects: (sq: Square) => boolean;
  /** Enemy has a legal move that would check our King next. */
  enemyThreatensCheck: boolean;
  /** Enemy units currently checking our King. */
  checkers: ReadonlySet<Square>;
  /**
   * Enemy units that can deliver check in one classical move (includes
   * {@link checkers}). Used for back-rank / pre-mate awareness.
   */
  checkThreatSquares: ReadonlySet<Square>;
};

const countType = (
  map: Map<Square, ScPiece>,
  color: PieceColor,
  type: ScPiece["type"],
): number => {
  let n = 0;
  for (const piece of map.values()) {
    if (piece.color === color && piece.type === type) n += 1;
  }
  return n;
};

/**
 * True when our pawns form a dense file cluster — ≥{@link CLUSTER_PAWNS}
 * pawns inside any window of {@link CLUSTER_FILES} consecutive files.
 */
const isPawnClustered = (
  map: Map<Square, ScPiece>,
  color: PieceColor,
): boolean => {
  const byFile = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const [square, piece] of map) {
    if (piece.color !== color || piece.type !== "p") continue;
    byFile[parseSquare(square).file] += 1;
  }
  for (let start = 0; start <= 8 - CLUSTER_FILES; start += 1) {
    let sum = 0;
    for (let i = 0; i < CLUSTER_FILES; i += 1) sum += byFile[start + i]!;
    if (sum >= CLUSTER_PAWNS) return true;
  }
  return false;
};

/**
 * Build attack predicates + one-ply enemy check threats.
 * 1) squares attacked by enemy · 2) squares protected by us ·
 * 3) whether any enemy unit can check our King in one move ·
 * 4) squares of those checkers / future checkers.
 */
const buildTacticalBoard = (
  map: Map<Square, ScPiece>,
  us: PieceColor,
  enemy: PieceColor,
  ourKing: Square,
  sieged: ReadonlySet<Square>,
): TacticalBoard => {
  const enemyAttacks = (sq: Square) => isSquareAttackedBy(map, sq, enemy);
  const friendlyProtects = (sq: Square) => isSquareAttackedBy(map, sq, us);

  const checkers = new Set<Square>();
  const checkThreatSquares = new Set<Square>();
  // Already checking us.
  for (const [sq, piece] of map) {
    if (piece.color !== enemy) continue;
    if (attacksSquare(map, sq, ourKing)) {
      checkers.add(sq);
      checkThreatSquares.add(sq);
    }
  }

  let enemyThreatensCheck = checkers.size > 0;
  for (const m of scMovesFor(map, enemy, { siegedRooks: sieged })) {
    if (m.dropsAtResolve) continue;
    const after = cloneWithMove(
      map,
      {
        from: m.from,
        to: m.to,
        capture: m.capture,
        ...(m.firesInPlace ? { firesInPlace: true } : {}),
        ...(m.promotion ? { promotion: m.promotion } : {}),
      },
      sieged,
    );
    if (!findKing(after, us)) continue;
    const land = m.firesInPlace ? m.from : m.to;
    if (attacksSquare(after, land, ourKing)) {
      enemyThreatensCheck = true;
      checkThreatSquares.add(m.from);
    }
  }

  return {
    enemyAttacks,
    friendlyProtects,
    enemyThreatensCheck,
    checkers,
    checkThreatSquares,
  };
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
  enemyQueenVisible: boolean,
  _tactical: TacticalBoard,
): Candidate[] => {
  const out: Candidate[] = [];
  const threatened = isSquareAttackedBy(map, king, enemy);
  const underCheckThreat = threatened;
  const {
    siegeHub,
    mapControl,
    promoteRank,
    seekFocus,
    center,
    trade,
    attackedPenalty,
    promotionBonus,
  } = weights;

  // spawn — adjacent to the King; afford units within stored minerals.
  // Prefer queens / rooks when the bank can pay for them — same-square scores
  // used to be identical across unit types, so cheap pawns won ties and the
  // Adjutant accumulated too much light material.
  // Cap Hoverbikes at MAX_KNIGHTS — after that prefer Siege Tanks (rooks).
  // Always prioritize **≥1 bishop** before heavy spam (diagonals / Charon).
  // Visible enemy queen → keep spawning bishops (Charon angles) + protect King.
  // Congested pawns → stop dropping more Marines.
  // Pawns must never resolve onto an edge row (rank 1 or 8 breaks chess.js), so
  // those squares are excluded for pawn spawns.
  const bank = storedFor(us);
  const preferHeavy = bank >= UNIT_COST.r;
  const ownBishops = countType(map, us, "b");
  const ownKnights = countType(map, us, "n");
  const congested = isPawnClustered(map, us);
  const needBishop = ownBishops === 0;
  const wantBishops = needBishop || enemyQueenVisible;
  const knightsFull = ownKnights >= MAX_KNIGHTS;
  const adjacent = neighbors(king).filter((at) => !map.has(at));
  for (const unit of ["p", "n", "b", "r", "q"] as const) {
    if (UNIT_COST[unit] > bank) continue;
    if (unit === "n" && knightsFull) continue;
    if (congested && unit === "p") continue;
    // Skip light drops when we can afford a rook+ (unless King threatened, or
    // we still need bishops vs a visible enemy queen).
    if (
      preferHeavy &&
      !underCheckThreat &&
      UNIT_COST[unit] < UNIT_COST.r &&
      !(wantBishops && unit === "b")
    ) {
      continue;
    }
    // After 2 knights, prefer rook deploys over other mid-tier options.
    if (knightsFull && preferHeavy && unit !== "r" && unit !== "q" && unit !== "b") {
      continue;
    }
    for (const to of adjacent) {
      if (unit === "p" && (rankOf(to) === 1 || rankOf(to) === 8)) continue;
      let score =
        center * centerScore(to) +
        promoteRank * promoteProgress(rankOf(to), us) +
        // Heavier piece → higher score (q=9, r=5 ≫ p=1).
        trade * (1 + UNIT_COST[unit]);
      // Survival first — do not force bishop-before-rook while the King is hot.
      if (needBishop && unit === "b" && !underCheckThreat) score += BISHOP_FIRST;
      if (enemyQueenVisible && unit === "b" && !underCheckThreat) score += BISHOP_VS_QUEEN;
      if (knightsFull && unit === "r") score += ROOK_AFTER_KNIGHTS;
      // Back-rank cheese: prefer rook deploys that can take the threat next.
      if (underCheckThreat && unit === "r") score += trade * 4;
      if (underCheckThreat) score += trade;
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
  // Last-rank landing carries a promotion choice (gas-only promote).
  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "p") continue;
    const to = pawnSingleTarget(from, us);
    if (!to || map.has(to)) continue;
    const promotion = isLastRank(rankOf(to), us) ? ("q" as const) : undefined;
    let score = center * centerScore(to) + promoteRank * promoteProgress(rankOf(to), us);
    score += nearPromoteRush(rankOf(from), rankOf(to), us);
    if (promotion) score += promotionBonus;
    if (isSquareAttackedBy(map, to, enemy)) score -= attackedPenalty;
    out.push(
      asCandidate(
        {
          timing: "B",
          kind: "pawnDouble",
          color: us,
          from,
          to,
          ...(promotion ? { promotion } : {}),
        },
        score,
      ),
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
        // Mined tiles stay legal landings, but the jump is no attack — a hostile
        // mine detonates on arrival and takes the BattleShip with it.
        const mine = mineAt(snap.mines, to);
        if (mine && mine.color !== us) continue;
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
 * Spawn (B) then classical (C) **from the newly deployed unit**.
 * Validation accepts C.from === spawn.to once B is queued — this is the
 * deploy+attack survival line (e.g. drop a rook that takes the back-rank checker).
 */
const sideSpawnCaptureStacks = (
  spawnCandidates: readonly Candidate[],
  map: Map<Square, ScPiece>,
  sieged: ReadonlySet<Square>,
  us: PieceColor,
  enemy: PieceColor,
  tactical: TacticalBoard,
  weights: StrategyWeights,
): Candidate[] => {
  const out: Candidate[] = [];
  const { trade } = weights;

  for (const spawn of spawnCandidates) {
    const spawnAction = spawn.actions[0];
    if (
      !spawnAction ||
      spawnAction.kind !== "spawn" ||
      !spawnAction.to ||
      !spawnAction.unit
    ) {
      continue;
    }
    const after = new Map(map);
    after.set(spawnAction.to, { type: spawnAction.unit, color: us });
    const from = spawnAction.to;
    for (const m of scMovesFor(after, us, { siegedRooks: sieged })) {
      if (m.dropsAtResolve || m.from !== from) continue;
      // Deploy+attack is about capturing the threat / winning material.
      if (!m.capture || m.capture.color !== enemy) continue;

      let score = spawn.score + trade * (1 + UNIT_COST[m.capture.type]);
      // Deploy+attack survival — only when taking a unit that is checking us now
      // (not a distant one-ply threat; that is handled by King back-rank escape).
      const takesChecker = tactical.checkers.has(m.to);
      const equalOrBetter =
        UNIT_COST[m.capture.type] >= UNIT_COST[spawnAction.unit];
      if (takesChecker) {
        score += DEPLOY_ATTACK_SURVIVAL;
        if (spawnAction.unit === "r" && m.capture.type === "r") {
          score += EQUAL_TRADE_ATTACK;
        } else if (equalOrBetter) {
          score += EQUAL_TRADE_ATTACK * 0.5;
        }
      } else if (equalOrBetter) {
        score += EQUAL_TRADE_ATTACK;
      }

      out.push({
        actions: [
          spawnAction,
          {
            timing: "C",
            kind: "classical",
            color: us,
            from,
            to: m.to,
            ...(m.promotion ? { promotion: m.promotion } : {}),
          },
        ],
        score,
        ...(spawn.spendMinerals != null ? { spendMinerals: spawn.spendMinerals } : {}),
      });
    }
  }
  return out;
};

/**
 * Same-turn gas special (B) + classical (C).
 * Charon burns 2 gas then a second unit still strikes; Hoverbike mines then hops;
 * threatened BattleShip warps then another unit develops.
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

      // After Charon the Mecha stays put — any classical is fine (often another unit).
      // After mine / siege the actor may also relocate the same piece.
      // After queenWarp, classical from the same from is rewritten to the warp destination.
      if (b.kind === "queenWarp" && c.from !== b.from) {
        // Warp frees the BattleShip; a second unit may still act.
      } else if (b.kind === "bishopSnipe" && c.from === b.from) {
        // Bishop stays — classical from the same square would be a move after snipe (legal).
      }

      let score = special.score + move.score;
      if (b.kind === "bishopSnipe") {
        score += CHARON_COMBO;
        if (c.to && map.get(c.to)?.color === enemy) score += weights.trade * 2;
      }
      if (b.kind === "knightMine" && c.from === b.from) {
        // Plant then leave — deny the Hoverbike sitting on its own mine tile.
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
    enemyQueenVisible,
    enemyKing,
    sieged,
    weights,
    intel,
    congested,
    tactical,
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
      score += KING_SAFETY * (destSafe ? 1 : -1);
    } else {
      // No intrinsic value in strolling an unthreatened King: an idle bonus here
      // outranks every real action (spawning, unpacking a pinned tank, pushing a
      // pawn). Only punish walking into fire.
      if (!destSafe) score -= KING_SAFETY;
    }
    // Visible enemy queen — protect the King (flee to safety / avoid hang).
    if (enemyQueenVisible) {
      if (destSafe) score += QUEEN_THREAT_KING * (kingThreatened ? 2 : 1);
      else score -= QUEEN_THREAT_KING;
    }
    // Enemy can check next hop — prefer leaving the hot square / staying safe.
    if (tactical.enemyThreatensCheck && destSafe) score += QUEEN_THREAT_KING * 0.35;
    // Back-rank cheese: step to the rank in front (e.g. e8→e7) when threatened.
    if (destSafe && (kingThreatened || tactical.enemyThreatensCheck)) {
      const backRank = us === "b" ? 8 : 1;
      const frontRank = us === "b" ? 7 : 2;
      if (rankOf(move.from) === backRank && rankOf(move.to) === frontRank) {
        score += BACKRANK_ESCAPE;
      }
    }
  } else {
    // Engagement — in range of another unit: attack vs defend.
    const underFire = tactical.enemyAttacks(move.from);
    if (move.capture) {
      const victimValue = UNIT_COST[move.capture.type];
      const attackerValue = UNIT_COST[piece.type];
      const undefended = !tactical.enemyAttacks(move.to);
      if (move.capture.type === "p") {
        if (undefended) score += HUNT_UNDEFENDED_PAWN;
        else if (congested) score += HUNT_UNDEFENDED_PAWN * 0.35;
        if (congested && piece.type === "p") score += PAWN_TRADE;
      }
      if (victimValue === attackerValue) {
        // Same material — always attack.
        score += EQUAL_TRADE_ATTACK;
      } else if (victimValue > attackerValue) {
        score += trade * (1 + (victimValue - attackerValue));
      } else {
        // Bad trade — only slightly tempting unless it also saves us.
        score += trade * 0.25;
      }
      // Prefer capturing onto a square we already protect.
      if (tactical.friendlyProtects(move.to)) score += trade * 0.35;
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
      // Congested — quiet pawn advances are less useful than trades / clears.
      if (congested && !move.capture) score -= trade * 0.5;
    }
    // Hoverbike — hop onto hub mine sites; once hub is mined, prefer a/h flanks.
    if (piece.type === "n") {
      const site = mineSiteWeight(move.to, context.hubMineTaken);
      if (site > 0) score += mapControl * (1 + site);
      else score += mapControl * centerScore(move.to) * 0.15;
      // Sneak check: land checking the King on a square the enemy does not cover.
      // Uses full-board King location (same omniscience as capture scoring).
      if (enemyKing && move.to !== enemyKing) {
        const after = cloneWithMove(map, move, sieged);
        if (attacksSquare(after, move.to, enemyKing)) {
          const covered = isSquareAttackedBy(after, move.to, enemy);
          if (!covered) score += SNEAK_KNIGHT_CHECK;
          else if (tactical.friendlyProtects(move.to)) score += SNEAK_KNIGHT_CHECK * 0.25;
          else score -= attackedPenalty;
        }
      }
    }
    // Mecha — claim long diagonals that bite the centre.
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
    // Blunder guard: do not park a unit on a square the enemy already covers
    // unless we protect it (or we are capturing).
    if (!move.capture && tactical.enemyAttacks(move.to)) {
      score -= tactical.friendlyProtects(move.to)
        ? attackedPenalty * 0.35
        : attackedPenalty;
    }
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
 * Apply a candidate plan in resolve order.
 *
 * Pawn/queen stacks (B+C on the same vector) relocate twice — mid, then far.
 * That folding is `rewriteClassicalAfterB`'s job, and the simulation borrows it
 * verbatim so a plan we score can never land somewhere the resolver would not
 * put it (the rewrite also declines on a blocked landing and outside the
 * double-step band, which a hand-rolled shift misses).
 */
const simulatePlan = (
  map: Map<Square, ScPiece>,
  actions: readonly ScActionInput[],
  sieged: ReadonlySet<Square>,
  us: PieceColor,
): Map<Square, ScPiece> => {
  let next = map;
  // `seq` is unused by the rewrite; index order is already resolve order here.
  const folded = rewriteClassicalAfterB(
    actions.map((a, seq) => ({ ...a, seq }) as ScAction),
    mapToPlacement(map),
  );
  for (const action of folded) {
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

  let enemyQueenVisible = false;
  for (const [sq, piece] of map) {
    if (piece.color !== enemy || piece.type !== "q") continue;
    if (litSquares.has(sq) || revealedPieces.has(sq)) {
      enemyQueenVisible = true;
      break;
    }
  }

  // Context 1–3 — candidates, scored with posture-dynamic weights.
  // An adjacent enemy King counts: face-to-face kings chip each other.
  const kingThreatened = isSquareAttackedBy(map, king, enemy);
  const hubHeld = hasHubPresence(map, us);
  const posture = resolvePosture(hubHeld, enemyKingVisible);
  const weights = WEIGHTS[posture];
  const intel = gatherKingIntel(map, litSquares, revealedPieces, enemy);
  const congested = isPawnClustered(map, us);
  const tactical = buildTacticalBoard(map, us, enemy, king, sieged);
  const scoreCtx: ScoreCtx = {
    map,
    king,
    kingThreatened,
    enemyKingVisible,
    enemyQueenVisible,
    enemyKing,
    sieged,
    posture,
    weights,
    intel,
    hubMineTaken: hubMineTaken(snap, us),
    congested,
    tactical,
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
    enemyQueenVisible,
    tactical,
  );
  const stackCandidates = [
    ...sidePawnGasStacks(snap, map, moves, scoreCtx),
    ...sideSpawnStacks(specialCandidates, moveCandidates),
    ...sideSpawnCaptureStacks(
      specialCandidates,
      map,
      sieged,
      us,
      enemy,
      tactical,
      weights,
    ),
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
