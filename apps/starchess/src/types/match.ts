import type {
  EndScTurnResult,
  PlayerEconomy,
  ScAction,
  ScActionInput,
  ScFenSnapshot,
  ScOutcome,
  SpawnPiece,
  StarChessColor,
  StarChessPiece,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { PendingPromotion } from "~/types/chess";
import type { AttackAnimKind } from "~/types/cues";
import type { ReviewTurnPhase } from "~/types/review";
import type { ResolveWaveId } from "~/types/tutorial";

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

export type CueLane =
  | "gasDrop"
  | "bSpecial"
  | "deploy"
  | "crush"
  | "arrivalBlast"
  | "phase1Attack"
  | "phase1Death"
  | "move"
  | "collision"
  | "mineMissile"
  | "mine"
  | "approach"
  | "promoWalk"
  | "promoDeploy";

export type CueBoard = "preAfterB" | "afterB" | "afterAttack" | "afterMove";

export type CueRouting = {
  lane?: CueLane;
  board?: CueBoard;
  group?: string;
};

export type TimelineCue = CueRouting &
  (
  | {
      kind: "move";
      id: string;
      piece: StarChessPiece;
      color: StarChessColor;
      from: Square;
      to: Square;
      /** BattleShip Tactical Jump — QueenJumpAnimation, not a hull slide. */
      queenJump?: boolean;
      /** Pawn gas-step (B/F pawnDouble) — stim square + hop timing. */
      stim?: boolean;
    }
  | {
      kind: "attack";
      id: string;
      piece: StarChessPiece;
      color: StarChessColor;
      from: Square;
      to: Square;
      /** When set, HP chips at frag impact (live king-damage boom). */
      kingShot?: { target: StarChessColor; livesAfter: number };
      /** Override ANIM_BY_PIECE (e.g. bishopCharon). */
      anim?: AttackAnimKind;
      /** Siege Tank mode for rookBattery VFX (from afterB siegedRooks). */
      rookMode?: "siege" | "tank";
    }
  | {
      kind: "death";
      id: string;
      piece: StarChessPiece;
      color: StarChessColor;
      at: Square;
      mine?: boolean;
      /**
       * Mine glyph square to hide while this boom plays — a chase blows up on
       * the landing tile, so the burrowed glyph it left behind is elsewhere.
       */
      spentAt?: Square;
      rookMode?: "siege" | "tank";
    }
  | {
      kind: "deploy";
      id: string;
      piece: StarChessPiece;
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
    }
  | {
      /** Spider Mine chase — lift+launch from wake square to impact (`chaseFrom` → `to`). */
      kind: "mineMissile";
      id: string;
      color: StarChessColor;
      from: Square;
      to: Square;
    }
  );

export type TimelineState = {
  active: boolean;
  cues: TimelineCue[];
  /** Cue id(s) currently animating — multiple for parallel spawn deploys. */
  playingIds: readonly string[];
  /**
   * Attack cue ids whose hull is suppressed (attacker died mid-shot).
   * Keys match attack cue ids; DeathAnimation owns those squares.
   */
  attackDying: Readonly<Record<string, boolean>>;
  /** Squares whose piece glyph is hidden while a cue plays. */
  hiddenSquares: ReadonlySet<Square>;
  /** Move slide progress (0 = at from, 1 = sliding/at to). */
  moveProgress: Readonly<Record<string, 0 | 1>>;
  /** Knight L-path facing: 0 = long leg, 1 = short leg (after elbow). */
  moveLeg: Readonly<Record<string, 0 | 1>>;
  /** Tactical Jump thruster trails (outlive the hull cue). */
  jumpTrails: ReadonlyArray<{ id: string; from: Square; to: Square }>;
  /** Spider Mine chase trails (outlive the missile hull cue). */
  mineMissileTrails: ReadonlyArray<{ id: string; from: Square; to: Square }>;
  /** Hide board mine glyphs after boom / while missile owns the square. */
  spentMines: readonly Square[];
  /** Temporary placement overrides during resolve (mid-timeline commits). */
  displayPlacement: string | null;
  /** Review-replay overlays — never rewrite `liveSnapshot` while `gameOver`. */
  displayKingLives: ScFenSnapshot["kingLives"] | null;
  displayMines: ScFenSnapshot["mines"] | null;
  displaySiegedRooks: readonly Square[] | null;
};

/** Patch shape for TIMELINE_COMMIT / TimelineCallbacks.onCommit. */
export type TimelineCommitPatch = {
  placement?: string;
  kingLives?: EndScTurnResult["next"]["kingLives"];
  mines?: EndScTurnResult["next"]["mines"];
  siegedRooks?: readonly Square[];
  /** In-resolve U: stamps — migrate with gas drops / moves for green aura. */
  specialsUsed?: readonly Square[];
  hidden?: readonly Square[];
  playingIds?: readonly string[];
  /**
   * Attack cue ids whose hull is suppressed mid-shot (attacker died —
   * reciprocal fire). DeathAnimation owns the square until death ends;
   * keep flags until the attack wave clears so hulls do not flash back.
   */
  attackDying?: Record<string, boolean>;
  moveProgress?: Record<string, 0 | 1>;
  /** Knight L facing — 0 long leg, 1 short leg after elbow. */
  moveLeg?: Record<string, 0 | 1>;
  /** Tactical Jump thruster trails (outlive hull cue). */
  jumpTrails?: ReadonlyArray<{ id: string; from: Square; to: Square }>;
  /** Spider Mine chase trails (outlive missile hull). */
  mineMissileTrails?: ReadonlyArray<{ id: string; from: Square; to: Square }>;
  /** Hide board mine glyphs while missile / after boom. */
  spentMines?: readonly Square[];
};

/** Playback binder: timelinePlayer → match store TIMELINE_* commits. */
export type TimelineCallbacks = {
  onStart: (cues: TimelineCue[], placement: string) => void;
  onCommit: (patch: TimelineCommitPatch) => void;
  onDone: () => void;
};

// SPEC: _spec/apps/starchess/core/turn/turn-bonus-broadcast.puml
export type TurnBonus = {
  turn: number;
  minerals: number;
  gas: number;
  seconds: number;
};

export type MatchState = {
  phase: MatchPhase;
  liveSnapshot: ScFenSnapshot;
  economies: Record<StarChessColor, PlayerEconomy>;
  /**
   * Whose fog / input seat is active (live play = human; review VISION may
   * temporarily switch to the Adjutant color).
   */
  viewer: ViewerColor;
  /**
   * Human’s chosen team for this match — stable across review vision toggles.
   * SideRailTools labels: You = playerColor, Adjutant = opposite.
   */
  playerColor: ViewerColor;
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
   * Timeout / End defaults the choice to queen (BattleShip).
   */
  pendingPromotion: PendingPromotion | null;
  /**
   * True after turn-open king-checks were applied (`beginScTurn`) for this
   * planning window. `SUBMIT_TURN` then skips re-applying those checks.
   */
  turnStartChecksApplied: boolean;
  turnBonus: TurnBonus | null;
  lastAnnouncedBonusTurn: number;
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
  /**
   * Turn-open facade — sole path to `beginScTurn` (checks + gas refill).
   * Store only dispatches; never calls beginScTurn directly.
   */
  | { type: "TURN_OPEN" }
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
      /** Attack cue ids suppressed mid-shot (reciprocal / attacker death). */
      attackDying?: Record<string, boolean>;
      moveProgress?: Record<string, 0 | 1>;
      moveLeg?: Record<string, 0 | 1>;
      jumpTrails?: ReadonlyArray<{ id: string; from: Square; to: Square }>;
      mineMissileTrails?: ReadonlyArray<{ id: string; from: Square; to: Square }>;
      spentMines?: readonly Square[];
    }
  | { type: "TIMELINE_DONE" }
  /**
   * Mid-resolve tutorial wave finished — clear `active` so the next wave can
   * `REVIEW_PLAY`, but keep display overlays for the partial board.
   */
  | { type: "TIMELINE_SOFT_DONE" }
  | { type: "REVIEW_SEEK"; index: number }
  /** Arm a stored resolve for terminal DualNav replay (phase stays `gameOver`). */
  | { type: "REVIEW_PLAY"; result: EndScTurnResult }
  | { type: "SET_VIEWER"; viewer: ViewerColor }
  | { type: "SET_PLAYER_COLOR"; playerColor: ViewerColor }
  | { type: "SET_DEADLINE"; at: number | null }
  | { type: "SHOW_TURN_BONUS"; bonus: TurnBonus }
  | { type: "HIDE_TURN_BONUS" }
  | { type: "SPEND_STORED"; color: StarChessColor; amount: number }
  | { type: "REFUND_STORED"; color: StarChessColor; amount: number }
  | { type: "CANCEL_EFFECTS" };

/** Match state without timeline — HUD / planning shell. */
export type MatchShell = Omit<MatchState, "timeline">;

/** Match store surface — dual-signal shell ∥ timeline + reducer runners. */
export type MatchStore = {
  /** Full snapshot (reads shell + timeline). Prefer shell/timeline in hot paths. */
  state: () => MatchState;
  /** Phase, snaps, economies, selection — not cue ticks. */
  shell: () => MatchShell;
  /** Timeline presentation only. */
  timeline: () => TimelineState;
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
  /** Tutorial / stepped DualNav — show or clear intent ghosts. */
  reviewShowIntent: (actions: readonly ScAction[] | null) => void;
  /** Tutorial / stepped DualNav — set phase chip without running playReviewTurn. */
  reviewSetPhase: (phase: ReviewTurnPhase) => void;
  /**
   * Tutorial resolve wave — plays one partitioned cue batch. Last wave runs
   * {@link TIMELINE_DONE}; earlier waves use {@link TIMELINE_SOFT_DONE}.
   */
  playReviewResolveWave: (
    result: EndScTurnResult,
    waveId: ResolveWaveId,
    opts?: { isLastWave?: boolean },
  ) => Promise<void>;
  /** Full resolve timeline (check-only ply or unpartitioned End). */
  playReviewResolve: (result: EndScTurnResult) => Promise<void>;
  dismissTurnBonus: () => void;
  cancelEffects: () => void;
};
