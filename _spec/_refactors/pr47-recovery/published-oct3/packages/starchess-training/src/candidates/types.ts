// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { EncodedCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";

export const COMPOSITION_VERSION = "challenge-composition-v3";
export const FAMILY_ORDER = Object.freeze([
  "classical", "deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump",
] as const);
export const LANE_ORDER = Object.freeze([...FAMILY_ORDER, "shared-composition"] as const);
export const MAX_GENERATED_ACTIONS = 4;
export const MAX_ATTEMPTED_EXTENSIONS = 2048;
export const MAX_RETAINED_CANDIDATES = 512;
export type Kind = typeof FAMILY_ORDER[number];
export type Lane = typeof LANE_ORDER[number];
export type PruneReason = "actor" | "shape" | "timing" | "resources" | "mineCap" | "ownOccupancy";
export type KindCounts = Readonly<Record<Kind, number>>;
export type PoolRecord = Readonly<{
  id: Lane;
  initialCapacity: number;
  finalCapacity: number;
  retained: number;
  exhausted: boolean;
}>;
export type CandidateDiagnostics = Readonly<{
  profile: "B";
  attemptedExtensions: number;
  uniqueIncludingPass: number;
  retainedNonPass: number;
  duplicates: number;
  ownerSkipped: number;
  quotaSkipped: number;
  pruned: Readonly<Record<PruneReason, number>>;
  activeFamilies: readonly Kind[];
  exhaustedLanes: readonly Lane[];
  pools: readonly PoolRecord[];
  retainedByOwner: KindCounts;
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
