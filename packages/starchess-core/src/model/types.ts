import type { Square } from "./square";

/** White / black side used by StarChess rules and economy. */
export type StarChessColor = "w" | "b";

/** Alias of {@link StarChessColor} — identical; prefer `StarChessColor` in new code. */
export type PieceColor = StarChessColor;

/** Classical piece kinds. */
export type StarChessPiece = "p" | "n" | "b" | "r" | "q" | "k";

/** Siege Tank turret: mobile twin guns vs deployed shock cannon. */
export type RookMode = "tank" | "siege";

/** Planning / resolve phase codes used in SCFEN. */
export type ScPhaseCode = "P" | "B" | "A" | "M" | "F" | "O";

/** King spawn choices — pawn first, then promotional set. */
export type SpawnPiece = "p" | "q" | "r" | "b" | "n";

/** Queue timing codes written in SCFEN `Q:`. */
export type ScActionTiming = "B" | "C" | "F";

export type ScSpecialKind =
  | "spawn"
  | "pawnDouble"
  | "knightMine"
  | "bishopSnipe"
  | "rookSiege"
  | "queenWarp";

/** Alias of {@link ScSpecialKind} (legacy name). */
export type SpecialKind = ScSpecialKind;

export type ScAction =
  | {
      timing: "B" | "F";
      kind: ScSpecialKind;
      color: StarChessColor;
      from: Square;
      to?: Square;
      unit?: SpawnPiece;
      /** Gas step onto last rank — Marine promotes on End (pawnDouble only). */
      promotion?: SpawnPiece;
      seq: number;
    }
  | {
      timing: "C";
      kind: "classical";
      color: StarChessColor;
      from: Square;
      to: Square;
      promotion?: SpawnPiece;
      seq: number;
    };

/**
 * Action without `seq`, distributed over the union so each variant keeps its
 * discriminator and variant-only fields (`unit`, `promotion`). Plain
 * `Omit<ScAction, "seq">` collapses the union and drops those fields.
 */
export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export type ScActionInput = DistributiveOmit<ScAction, "seq">;

export type ScTurnQueue = {
  /** Global insertion sequence. Resolve groups by timing, then seq. */
  actions: readonly ScAction[];
};

export type ScMine = {
  color: StarChessColor;
  at: Square;
};

export type ScFenSnapshot = {
  /** Classic piece-placement ranks (FEN field 0). */
  placement: string;
  turn: number;
  kingLives: Record<StarChessColor, number>;
  phase: ScPhaseCode;
  /** Remaining vespene this planning turn (`G:` first pair). */
  gas: Record<StarChessColor, number>;
  /** Gas income/cap this turn (`G:` second pair) — authoritative for legality. */
  gasIncome: Record<StarChessColor, number>;
  /**
   * Command Center mineral bank per side (`|B:<w>:<b>` extras, 0–12).
   * Optional for backward-compatible SCFEN; when present it is the source of
   * truth for available minerals (deployed supply still comes from placement).
   */
  stored?: Record<StarChessColor, number>;
  /**
   * Squares whose unit already used a special this turn (`|U:a1c4…` extras).
   * Stamped on End resolve; cleared at the next turn-open checks (`beginScTurn`).
   */
  specialsUsed?: readonly Square[];
  /** Planning queue (`|Q:…`). Omit = snapshot-only. */
  queue?: ScTurnQueue;
  /** Spider Mines beside placement (`|M:…`). Max 2 per side. */
  mines?: readonly ScMine[];
  /**
   * Squares whose Siege Tank is unpacked (`|S:c3f7…`). Immobile until toggled
   * back to tank via `rookSiege`. Absent / empty ⇒ all rooks tank-mode.
   */
  siegedRooks?: readonly Square[];
  /**
   * Legacy deferred king-checks (`|H:…`). Parsed for round-trip only —
   * `endScTurn` applies **legal** checks from board geometry instead.
   */
  pendingKingShots?: readonly ScPendingKingShot[];
};

/** Armed king-check waiting for next-turn resolve (SCFEN `H:`). */
export type ScPendingKingShot = {
  /** Attacking side. */
  color: StarChessColor;
  piece: StarChessPiece;
  from: Square;
  /** Intent square (enemy king when armed). */
  to: Square;
};

export type ScFenErrorCode =
  | "SC_SCHEMA"
  | "SC_PLACEMENT"
  | "SC_GAS"
  | "SC_QUEUE_SHAPE"
  | "SC_PHASE"
  | "SC_BASELINE_FEN"
  | "SC_SPECIAL"
  | "SC_REPLAY";

export type ScFenError = {
  code: ScFenErrorCode;
  message: string;
};

/** One side’s classical action for simultaneous resolve. */
export type ClassicalPlan = {
  color: StarChessColor;
  from: Square;
  to: Square;
  /** Pawn promotion choice when `to` is the last rank. */
  promotion?: SpawnPiece;
  /**
   * Marine Extra Step legs sharing this walk. The two hops are one walk for
   * mine contact, so a mine woken on either leg waits for the real destination.
   * `extraStepFrom` — gas-then-move: the marine reached `from` on its Extra
   * Step this turn, so `from` is still a live contact tile.
   * `extraStepTo` — move-then-gas: an Extra Step carries it past `to`, so this
   * leg is not the landing and the arrival check owns the contact list.
   */
  extraStepFrom?: Square;
  extraStepTo?: Square;
};

export type PlayerEconomy = {
  stored: number;
  deployed: number;
};
