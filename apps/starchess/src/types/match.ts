import type {
  EndScTurnResult,
  PlayerEconomy,
  ScAction,
  ScActionInput,
  ScFenSnapshot,
  ScOutcome,
  SpawnPiece,
  StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { PendingPromotion } from "~/types/chess";
import type { ReviewTurnPhase } from "~/types/review";

export type MatchPhase = "loading" | "planning" | "targeting" | "resolving" | "gameOver";

export type ViewerColor = StarChessColor;

export type TargetingState =
  | null
  | { kind: "spawn"; unit: SpawnPiece; color: StarChessColor }
  | {
      kind: "bishopSnipe";
      from: Square;
      to: Square;
      color: StarChessColor;
    }
  | {
      kind: "queenWarp";
      from: Square;
      targets: readonly Square[];
      color: StarChessColor;
    };

export type TimelineCue =
  | {
      kind: "move";
      id: string;
      piece: string;
      color: StarChessColor;
      from: Square;
      to: Square;
      /** Battlecruiser Tactical Jump — QueenJumpAnimation, not a hull slide. */
      queenJump?: boolean;
      /** Pawn gas-step (B/F pawnDouble) — stim square + hop timing. */
      stim?: boolean;
    }
  | {
      kind: "attack";
      id: string;
      piece: string;
      color: StarChessColor;
      from: Square;
      to: Square;
      /** When set, HP chips at frag impact (live king-damage boom). */
      kingShot?: { target: StarChessColor; livesAfter: number };
      /** Override ANIM_BY_PIECE (e.g. bishopCharon). */
      anim?: string;
      /** Siege Tank mode for rookBattery VFX (from afterB siegedRooks). */
      rookMode?: "siege" | "tank";
    }
  | {
      kind: "death";
      id: string;
      piece: string;
      color: StarChessColor;
      at: Square;
      mine?: boolean;
      rookMode?: "siege" | "tank";
    }
  | {
      kind: "deploy";
      id: string;
      piece: string;
      color: StarChessColor;
      at: Square;
    }
  | {
      kind: "gasDrop";
      id: string;
      color: StarChessColor;
      at: Square;
      /** Top-edge start: left / mid / right (always falls from the top). */
      corner: "left" | "mid" | "right";
    };

export type TimelineState = {
  active: boolean;
  cues: TimelineCue[];
  /** Cue id(s) currently animating — multiple for parallel spawn deploys. */
  playingIds: readonly string[];
  /** Squares whose piece glyph is hidden while a cue plays. */
  hiddenSquares: ReadonlySet<Square>;
  /** Move slide progress (0 = at from, 1 = sliding/at to). */
  moveProgress: Readonly<Record<string, 0 | 1>>;
  /** Knight L-path facing: 0 = long leg, 1 = short leg (after elbow). */
  moveLeg: Readonly<Record<string, 0 | 1>>;
  /** Tactical Jump thruster trails (outlive the hull cue). */
  jumpTrails: ReadonlyArray<{ id: string; from: Square; to: Square }>;
  /** Temporary placement overrides during resolve (mid-timeline commits). */
  displayPlacement: string | null;
  /** Review-replay overlays — never rewrite `liveSnapshot` while `gameOver`. */
  displayKingLives: ScFenSnapshot["kingLives"] | null;
  displayMines: ScFenSnapshot["mines"] | null;
  displaySiegedRooks: readonly Square[] | null;
};

export type MatchState = {
  phase: MatchPhase;
  liveSnapshot: ScFenSnapshot;
  economies: Record<StarChessColor, PlayerEconomy>;
  viewer: ViewerColor;
  deadlineAt: number | null;
  targeting: TargetingState;
  specialsUsed: ReadonlySet<Square>;
  siegedRooks: ReadonlySet<Square>;
  timeline: TimelineState;
  outcome: ScOutcome | null;
  settledSnapshots: ScFenSnapshot[];
  /**
   * Resolve that produced `settledSnapshots[i+1]` from `[i]`.
   * Length is always `settledSnapshots.length - 1` (empty for deep-link terminals).
   */
  settledResolves: readonly EndScTurnResult[];
  reviewIndex: number;
  statusText: string;
  lastResolve: EndScTurnResult | null;
  selected: Square | null;
  legalDests: readonly Square[];
  /**
   * Last-rank marine move awaiting {@link PromotionModal}.
   * Timeout / End defaults the choice to queen (Battlecruiser).
   */
  pendingPromotion: PendingPromotion | null;
  /**
   * True after turn-open king-checks were applied (`beginScTurn`) for this
   * planning window. `SUBMIT_TURN` then skips re-applying those checks.
   */
  turnStartChecksApplied: boolean;
};

export type MatchAction =
  | { type: "LOAD_SCFEN"; scfen: string; stored?: number }
  | { type: "LOAD_ERROR"; message: string }
  | { type: "SELECT_SQUARE"; square: Square | null }
  | { type: "SET_LEGAL_DESTS"; dests: readonly Square[] }
  | { type: "QUEUE_ACTION"; action: ScActionInput }
  | { type: "QUEUE_REJECT"; message: string }
  | { type: "SET_PENDING_PROMOTION"; pending: PendingPromotion }
  | { type: "CLEAR_PENDING_PROMOTION" }
  | { type: "REMOVE_ACTION"; seq: number }
  | { type: "OPEN_SPAWN"; color: StarChessColor; unit: SpawnPiece }
  | {
      type: "OPEN_BISHOP_SNIPE";
      color: StarChessColor;
      from: Square;
      to: Square;
    }
  | {
      type: "OPEN_QUEEN_WARP";
      color: StarChessColor;
      from: Square;
      targets: readonly Square[];
    }
  | { type: "CANCEL_TARGET" }
  | { type: "MARK_SPECIAL_USED"; square: Square }
  | { type: "APPLY_SNAPSHOT"; snapshot: ScFenSnapshot }
  | { type: "SUBMIT_TURN"; reason: "end" | "timeout" }
  | { type: "RESOLVE_READY"; result: EndScTurnResult }
  /** Turn-open: refill G: remaining from gasIncome (check chip / no-check arm). */
  | { type: "REFILL_GAS" }
  | { type: "MARK_CHECKS_APPLIED" }
  | { type: "BEGIN_CHECKS_DONE" }
  | { type: "TIMELINE_START"; cues: TimelineCue[]; placement: string }
  | {
      type: "TIMELINE_COMMIT";
      placement?: string;
      kingLives?: ScFenSnapshot["kingLives"];
      mines?: ScFenSnapshot["mines"];
      siegedRooks?: readonly Square[];
      /** In-resolve gas-used squares (green aura follows relocating units). */
      specialsUsed?: readonly Square[];
      hidden?: readonly Square[];
      playingIds?: readonly string[];
      moveProgress?: Record<string, 0 | 1>;
      moveLeg?: Record<string, 0 | 1>;
      jumpTrails?: ReadonlyArray<{ id: string; from: Square; to: Square }>;
    }
  | { type: "TIMELINE_DONE" }
  | { type: "REVIEW_SEEK"; index: number }
  /** Arm a stored resolve for terminal DualNav replay (phase stays `gameOver`). */
  | { type: "REVIEW_PLAY"; result: EndScTurnResult }
  | { type: "SET_VIEWER"; viewer: ViewerColor }
  | { type: "SET_DEADLINE"; at: number | null }
  | { type: "SPEND_STORED"; color: StarChessColor; amount: number }
  | { type: "REFUND_STORED"; color: StarChessColor; amount: number }
  | { type: "CANCEL_EFFECTS" };

/** Match store surface — Solid signal + reducer runners. */
export type MatchStore = {
  state: () => MatchState;
  dispatch: (action: MatchAction) => void;
  submitTurn: (reason?: "end" | "timeout") => void;
  armTimer: () => void;
  /** Resolve turn-open king-checks before intent; then arm timer when requested. */
  ensureTurnOpenChecks: (opts?: { armTimer?: boolean }) => void;
  /**
   * Terminal DualNav — Back seeks previous turn start; Forward runs one full turn
   * (check → intent hold → End) with phase chip updates.
   */
  reviewBack: () => void;
  reviewForward: () => void;
  reviewPhase: () => ReviewTurnPhase;
  reviewIntentActions: () => readonly ScAction[] | null;
  cancelEffects: () => void;
};
