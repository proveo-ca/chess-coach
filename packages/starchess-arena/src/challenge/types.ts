// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import type {
  EndScTurnResult, PieceColor, ScActionInput, ScOutcome, ScPiece, Square,
} from "@chess-coach/starchess-core";
import type { Bank } from "../run/bank";

export type ObservedCell =
  | { square: Square; visibility: "unknown" }
  | { square: Square; visibility: "lit"; piece: ScPiece | null }
  | { square: Square; visibility: "revealed"; piece: ScPiece };
export type Sighting = { square: Square; piece: ScPiece; observedTurn: number };
export type AuthorizedObservation = {
  version: "challenge-observation-v1";
  side: PieceColor;
  turn: number;
  own: {
    minerals: number; gas: number; gasIncome: number; ccLives: number;
    pieces: { square: Square; piece: ScPiece }[];
    mines: Square[]; siegedTanks: Square[];
  };
  cells: ObservedCell[];
  memory: Sighting[];
};
export type QueueProposal = { key: string; actions: ScActionInput[]; score: number };
export type CandidatePolicy = {
  name: string;
  choose(observation: AuthorizedObservation, rng: () => number): ScActionInput[] | Promise<ScActionInput[]>;
};
export type RecordedWindow = {
  planningOrdinal: number; sourcePlyIndex: number; sourceTurn: number; actions: ScActionInput[];
};
export type RecordedTrace = {
  caseId: string; gameId: string; historicalResult: string;
  openingScfen: string; traceSha256: string; windows: RecordedWindow[];
};
export type ScheduledMatch = {
  key: string; suite: "corpus" | "live-strategic";
  candidateSide: PieceColor; arenaSeed: number; inferenceSeed: 0;
  opening: string; trace?: RecordedTrace;
};
export type ChallengeStop = {
  kind: "terminal" | "queue-rejected" | "trace-exhausted" | "watchdog" |
    "progress-limit" | "exception" | "script-contract";
  phase: string; planningOrdinal: number; turn: number;
  side?: PieceColor; actionIndex?: number; action?: ScActionInput;
  sourcePlyIndex?: number; reason?: string; engineCode?: string;
  requiredMinerals?: number; availableMinerals?: number;
};
export type ChallengeEvidence = {
  match: ScheduledMatch;
  policy: string;
  modelArtifact: null;
  learnedGateEligible: false;
  fallbackCount: 0;
  scfens: string[];
  resolves: EndScTurnResult[];
  bankTrail: Bank[];
  finalBank: Bank;
  outcome: ScOutcome | null;
  stop: ChallengeStop;
};
export type ChallengeProgress =
  | { kind: "phase"; phase: string; planningOrdinal: number; turn: number; side?: PieceColor }
  | { kind: "ply"; scfen: string; resolve: EndScTurnResult; bank: Bank };
