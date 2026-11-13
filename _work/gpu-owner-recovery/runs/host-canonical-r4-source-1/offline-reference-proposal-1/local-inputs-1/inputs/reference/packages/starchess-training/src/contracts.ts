// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { EncodedCandidate, ACTION_KINDS } from "@chess-coach/starchess-arena/intent-codec-v1";

export const COMPOSITION_VERSION = "challenge-composition-v3";
export const MAX_GENERATED_ACTIONS = 4;
export const MAX_ATTEMPTED_EXTENSIONS = 2048;
export const MAX_RETAINED_CANDIDATES = 512;
export type CandidateKind = typeof ACTION_KINDS[number];
export type CandidateLane = CandidateKind | "shared-composition";
export type PruningReason = "actor" | "shape" | "timing" | "resources" | "mineCap" | "ownOccupancy";
export type CandidatePool = Readonly<{
  id: CandidateLane;
  initialCapacity: number;
  finalCapacity: number;
  retained: number;
  exhausted: boolean;
}>;
export type Kind = CandidateKind;
export type Lane = CandidateLane;
export type PoolRecord = CandidatePool;
export type CandidateDiagnostics = Readonly<{
  profile: "B";
  attemptedExtensions: number;
  uniqueIncludingPass: number;
  retainedNonPass: number;
  duplicates: number;
  ownerSkipped: number;
  quotaSkipped: number;
  pruned: Readonly<Record<PruningReason, number>>;
  activeFamilies: readonly CandidateKind[];
  exhaustedLanes: readonly CandidateLane[];
  pools: readonly CandidatePool[];
  retainedByOwner: Readonly<Record<CandidateKind, number>>;
  retainedByLength: Readonly<Record<"1" | "2" | "3" | "4", number>>;
  attemptCapReached: boolean;
  capacityCapReached: boolean;
  stopReason: "capacity-cap" | "attempt-cap" | "exhausted";
}>;
export type CandidateBatchV3 = Readonly<{
  version: typeof COMPOSITION_VERSION;
  candidates: readonly EncodedCandidate[];
  diagnostics: CandidateDiagnostics;
}>;
