/**
 * Every input variable the Adjutant derives from an SCFEN snapshot, plus the
 * plan/score shapes the strategies trade in.
 *
 * The context is built once per planning turn (see `context/index.ts`) and is
 * read-only from there on: strategies may not mutate it.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
 */

import type { Square } from "chess.js";

import type { ScPiece } from "../../board/placement";
import type {
  PieceColor,
  ScActionInput,
  ScFenSnapshot,
  SpawnPiece,
} from "../../model/types";

export type AdjutantResult = {
  snapshot: ScFenSnapshot;
  /** Minerals to debit when a spawn was queued (Command Center deploy). */
  spendMinerals?: { color: PieceColor; amount: number };
};

export type AdjutantContext = {
  /** Side the Adjutant plays. Defaults to `"b"` for existing tests / demos. */
  color?: PieceColor;
  /**
   * Stored minerals per side (host Command Center bank). Injected by the live
   * story from the Solid store; defaults to a deterministic income estimate so
   * snap-only callers still see spawn affordability.
   */
  storedFor?: (color: PieceColor) => number;
};

/** One classical move candidate from the shared SC movegen. */
export type Move = {
  from: Square;
  to: Square;
  promotion?: SpawnPiece;
  capture: ScPiece | null;
  firesInPlace?: boolean;
};

/** A scored plan of one or more actions to append to the turn queue. */
export type Candidate = {
  /** One or more actions to append (marine gas stack = B then C). */
  actions: ScActionInput[];
  score: number;
  /** Debit against stored minerals when the plan includes a spawn. */
  spendMinerals?: number;
};

/** Posture from map control + fog vision — drives all mid-game weights. */
export type Posture = "expand" | "seek" | "hunt";

/** Contextual weights the orchestrator hands the strategies each turn. */
export type StrategyWeights = {
  siegeHub: number;
  mapControl: number;
  diagonal: number;
  promoteRank: number;
  promotionBonus: number;
  /** Checking the visible enemy Command Center (CC) — #1 offensive in hunt. */
  attackKing: number;
  /** Closing Chebyshev distance toward a visible enemy Command Center (CC). */
  chaseKing: number;
  /** Closing toward suspected Command Center (CC) focus (seek posture). */
  seekFocus: number;
  center: number;
  trade: number;
  attackedPenalty: number;
};

/** Fog intel: where the hidden Command Center (CC) is likely, from what our side can see. */
export type KingIntel = {
  /** Weighted centroid of visible enemy cues (or a weak home prior). */
  focus: Square;
  /** Cue mass — higher when deploys / marine clumps are clear. */
  strength: number;
};

/** What our side can see through the fog this turn. */
export type VisionIntel = {
  litSquares: ReadonlySet<Square>;
  revealedPieces: ReadonlySet<Square>;
  enemyKingVisible: boolean;
  /** Lit/revealed enemy battleship — drives mecha spam + Command Center (CC) safety. */
  enemyQueenVisible: boolean;
};

/** Per-turn attack / threat awareness for scoring. */
export type TacticalBoard = {
  /** Square is attacked by ≥1 enemy unit (current board). */
  enemyAttacks: (sq: Square) => boolean;
  /** Square is attacked by ≥1 friendly unit (current board). */
  friendlyProtects: (sq: Square) => boolean;
  /** Enemy has a legal move that would check our Command Center (CC) next. */
  enemyThreatensCheck: boolean;
  /** Enemy units currently checking our Command Center (CC). */
  checkers: ReadonlySet<Square>;
  /**
   * Enemy units that can deliver check in one classical move (includes
   * {@link TacticalBoard.checkers}). Used for back-rank / pre-mate awareness.
   */
  checkThreatSquares: ReadonlySet<Square>;
};

/**
 * Supply read — observations only. The deploy policy derived from these
 * (prefer-heavy, mecha-first, Hoverbike cap) lives in `strategies/economy.ts`.
 */
export type MaterialIntel = {
  /** Stored minerals available to spend on deploys this turn. */
  bank: number;
  ownBishops: number;
  ownKnights: number;
  /** Own marine clutter — trade / hunt undefended marines. */
  congested: boolean;
};

/** Everything one planning turn reads. Built once, never mutated. */
export type AdjutantCtx = {
  snap: ScFenSnapshot;
  map: Map<Square, ScPiece>;
  us: PieceColor;
  enemy: PieceColor;
  king: Square;
  enemyKing: Square | null;
  kingThreatened: boolean;
  sieged: ReadonlySet<Square>;
  gas: number;
  posture: Posture;
  weights: StrategyWeights;
  vision: VisionIntel;
  intel: KingIntel;
  tactical: TacticalBoard;
  material: MaterialIntel;
  /** Our side already holds the d4–e5 hub. */
  hubHeld: boolean;
  /** Our side already has a Spider Mine on the d4–e5 hub. */
  hubMineTaken: boolean;
  storedFor: (color: PieceColor) => number;
  /** Ahead on the known-vs-seen ledger. Strategic only; absent under naive. */
  winning?: boolean;
};

/**
 * Per-move memo handed to every strategy so the post-move board and the
 * destination-safety test are computed at most once per candidate rather than
 * once per strategy that asks.
 */
export type MoveEval = {
  move: Move;
  piece: ScPiece;
  isKingMove: boolean;
  /** Occupancy after this move resolves. */
  after: () => Map<Square, ScPiece>;
  /** Destination is not covered by the enemy on the POST-move board. */
  destSafe: () => boolean;
};
