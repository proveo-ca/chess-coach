import type { Square } from "chess.js";

import type {
  EndScTurnResult,
  PlayerEconomy,
  ScActionInput,
  ScFenSnapshot,
  ScOutcome,
  SpawnPiece,
  StarChessColor,
} from "@chess-coach/starchess-core";

export type MatchPhase =
  | "loading"
  | "planning"
  | "targeting"
  | "resolving"
  | "gameOver";

export type ViewerColor = StarChessColor;

export type TargetingState =
  | null
  | { kind: "spawn"; unit: SpawnPiece; color: StarChessColor };

export type TimelineCue =
  | {
      kind: "move";
      id: string;
      piece: string;
      color: StarChessColor;
      from: Square;
      to: Square;
    }
  | {
      kind: "attack";
      id: string;
      piece: string;
      color: StarChessColor;
      from: Square;
      to: Square;
    }
  | {
      kind: "death";
      id: string;
      piece: string;
      color: StarChessColor;
      at: Square;
      mine?: boolean;
    }
  | {
      kind: "deploy";
      id: string;
      piece: string;
      color: StarChessColor;
      at: Square;
    }
  | {
      kind: "promoHold";
      id: string;
      color: StarChessColor;
      at: Square;
      unit: SpawnPiece;
    };

export type TimelineState = {
  active: boolean;
  cues: TimelineCue[];
  /** Squares whose piece glyph is hidden while a cue plays. */
  hiddenSquares: ReadonlySet<Square>;
  /** Temporary placement overrides during resolve (mid-timeline commits). */
  displayPlacement: string | null;
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
  reviewIndex: number;
  statusText: string;
  lastResolve: EndScTurnResult | null;
  selected: Square | null;
  legalDests: readonly Square[];
};

export type MatchAction =
  | { type: "LOAD_SCFEN"; scfen: string; stored?: number }
  | { type: "LOAD_ERROR"; message: string }
  | { type: "SELECT_SQUARE"; square: Square | null }
  | { type: "SET_LEGAL_DESTS"; dests: readonly Square[] }
  | { type: "QUEUE_ACTION"; action: ScActionInput }
  | { type: "QUEUE_REJECT"; message: string }
  | { type: "REMOVE_ACTION"; seq: number }
  | { type: "OPEN_SPAWN"; color: StarChessColor; unit: SpawnPiece }
  | { type: "CANCEL_TARGET" }
  | { type: "MARK_SPECIAL_USED"; square: Square }
  | { type: "SUBMIT_TURN"; reason: "end" | "timeout" }
  | { type: "RESOLVE_READY"; result: EndScTurnResult }
  | { type: "TIMELINE_START"; cues: TimelineCue[]; placement: string }
  | {
      type: "TIMELINE_COMMIT";
      placement?: string;
      kingLives?: ScFenSnapshot["kingLives"];
      mines?: ScFenSnapshot["mines"];
      hidden?: readonly Square[];
    }
  | { type: "TIMELINE_DONE" }
  | { type: "SET_VIEWER"; viewer: ViewerColor }
  | { type: "SET_DEADLINE"; at: number | null }
  | { type: "SPEND_STORED"; color: StarChessColor; amount: number }
  | { type: "CANCEL_EFFECTS" };
