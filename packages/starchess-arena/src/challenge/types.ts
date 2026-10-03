// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import type {
  EndScTurnResult, PieceColor, ScActionInput, ScOutcome,
} from "@chess-coach/starchess-core";
import type { Bank } from "../run/bank";

import type { AuthorizedObservation } from "../authorized/v1/types";
export type { AuthorizedObservation, ObservedCell, Sighting } from "../authorized/v1/types";
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
  rejectedQueue?: ScActionInput[];
};
export const WORKER_PROTOCOL = "challenge-worker-v2";
export type PlanPermit = {
  permitId: string; matchKey: string; planningOrdinal: number; side: PieceColor; turn: number;
  role: "candidate" | "strategic";
};
export type CheckedHalt = "terminal" | "trace-exhausted" | "progress-limit";
export type CheckedStages = {
  turnOpen(input: { planningOrdinal: number; begin: import("@chess-coach/starchess-core").BeginScTurnResult; bank: Bank }):
    Promise<{ kind: "permit"; permit: PlanPermit } | { kind: "halt"; stop: CheckedHalt }>;
  decision(input: { permit: PlanPermit; actions: ScActionInput[]; reportedMinSpend: number | null }):
    Promise<{ kind: "permit"; permit: PlanPermit } | { kind: "decisions-complete" }>;
  settlement(input: { planningOrdinal: number; end: EndScTurnResult; bank: Bank }): Promise<void>;
  admissionFailure(input: { stop: ChallengeStop; rejectedQueue: ScActionInput[] }): Promise<void>;
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
