import type { Square, PieceColor, ScActionInput } from "@chess-coach/starchess-core/planning-v1";

export type { Square };
export type Side = PieceColor;
export type UnitType = "p" | "n" | "b" | "r" | "q" | "k";
export type SpawnPiece = Exclude<UnitType, "k">;
export type AuthorizedPiece = Readonly<{ type: UnitType; color: Side }>;
export type ObservedCell =
  | Readonly<{ square: Square; visibility: "unknown" }>
  | Readonly<{ square: Square; visibility: "lit"; piece: AuthorizedPiece | null }>
  | Readonly<{ square: Square; visibility: "revealed"; piece: AuthorizedPiece }>;
export type Sighting = Readonly<{ square: Square; piece: AuthorizedPiece; observedTurn: number }>;
export type OwnActionRef = Readonly<{ planningOrdinal: number; acceptedActionOrdinal: number }>;
export type OwnUnitLineage = Readonly<{ id: string; square: Square; type: UnitType; paidBasis: number; replacementValue: number }>;
export type OwnMineLineage = Readonly<{ mineId: string; square: Square }>;
export type DeploymentDisposition = Readonly<{ kind: "materialized"; lineageId: string }> | Readonly<{ kind: "unmaterialized" }>;
export type PaidReceipt = Readonly<{
  receiptId: string; actionRef: OwnActionRef; unit: SpawnPiece; requestedSquare: Square;
  minerals: number; disposition: DeploymentDisposition;
}>;
export type EnemyLoss = Readonly<{
  confirmedUnitCount: number; replacementLowerBound: number; paidLowerBound: 0;
  upper: "unknown"; completeness: "witnessed-only";
}>;
export type EconomicState = Readonly<{
  version: "challenge-economic-ledger-v1"; side: Side;
  ownPaidDebits: number; ownPaidSurviving: number; ownPaidDestroyed: number; ownPaidWasted: number;
  ownReplacementDestroyed: number; enemyLoss: EnemyLoss;
  receipts: readonly PaidReceipt[]; retiredOwnIds: readonly string[];
}>;
export type AuthorizedOwnState = Readonly<{
  minerals: number; gas: number; gasIncome: number; ccLives: number;
  pieces: readonly Readonly<{ square: Square; piece: AuthorizedPiece }>[];
  mines: readonly Square[]; siegedTanks: readonly Square[];
}>;
export type AuthorizedSnapshotV2 = Readonly<{
  version: "challenge-observation-v2"; side: Side; turn: number;
  own: AuthorizedOwnState; cells: readonly ObservedCell[]; memory: readonly Sighting[];
  ownUnitLineage: readonly OwnUnitLineage[]; ownMineLineage: readonly OwnMineLineage[];
  economicState: EconomicState;
}>;
type Event<K extends string, T> = Readonly<{ kind: K; seq: number } & T>;
export type AuthorizedEvent =
  | Event<"own-paid-receipt", { receiptId: string; actionRef: OwnActionRef; unit: SpawnPiece; requestedSquare: Square; minerals: number }>
  | Event<"own-gas-debited", { actionRef: OwnActionRef; gas: number }>
  | Event<"own-unit-endowed", { id: string; square: Square; type: UnitType; paidBasis: 0 }>
  | Event<"own-unit-created", { lineageId: string; receiptId: string; square: Square; type: SpawnPiece }>
  | Event<"own-deployment-unmaterialized", { receiptId: string; paidMinerals: number }>
  | Event<"own-unit-moved", { id: string; from: Square; to: Square }>
  | Event<"own-unit-transformed", { id: string; fromType: UnitType; toType: SpawnPiece; paidDelta: 0 }>
  | Event<"own-unit-mode-changed", { id: string; mode: "tank" | "siege" }>
  | Event<"own-unit-destroyed", { id: string; typeAtLoss: SpawnPiece; square: Square; retiredPaidBasis: number }>
  | Event<"own-mine-endowed", { mineId: string; actionRef: null; square: Square }>
  | Event<"own-mine-created", { mineId: string; actionRef: OwnActionRef; square: Square }>
  | Event<"own-mine-removed", { mineId: string }>
  | Event<"own-income", { actualCreditedMinerals: number }>
  | Event<"own-cc-lives-changed", { before: number; after: number }>
  | Event<"enemy-unit-destruction-witnessed", { witnessId: string; square: Square; type: SpawnPiece; replacementLowerBound: number; paidLowerBound: 0 }>
  | Event<"vision-witness", { turn: number; changes: readonly ObservedCell[] }>;
export type BoundaryPhase = "initial" | "turn-open" | "settled";
export type AuthorizedBoundaryBatch = Readonly<{
  version: "challenge-boundary-batch-v1"; side: Side; ordinal: number; phase: BoundaryPhase;
  turn: number; planningOrdinal: number; seqBefore: number; seqThrough: number;
  events: readonly AuthorizedEvent[]; snapshot: AuthorizedSnapshotV2;
}>;
export type OwnMineAuditState = Readonly<{
  liveOwnMines: readonly OwnMineLineage[]; retiredOwnMineIdsSorted: readonly string[]; ownMineCreationCounter: number;
}>;
export type ReconciledBoundaryState = Readonly<{
  snapshot: AuthorizedSnapshotV2; economicState: EconomicState; ownMineAuditState: OwnMineAuditState;
  everLit: readonly Square[]; ordinal: number; phase: BoundaryPhase; planningOrdinal: number;
  seqThrough: number; lastBatchBytes: Uint8Array;
}>;
export type AuthorizedHistory = Readonly<{
  version: "challenge-history-v2"; currentAuthorizedSnapshotV2: AuthorizedSnapshotV2;
  economicState: EconomicState; everLit: readonly Square[];
}>;
export interface CandidatePolicyV2 {
  choose(history: AuthorizedHistory, rng: () => number): readonly ScActionInput[] | Promise<readonly ScActionInput[]>;
}
