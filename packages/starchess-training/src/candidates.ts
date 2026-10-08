// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { AuthorizedHistory, AuthorizedObservationV1 } from "@chess-coach/starchess-arena/observations";
import type { CandidateBatchV3 } from "./contracts";
import { composeHistory, composeWithRuntime } from "./composition";

export { decodeCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";
export { COMPOSITION_VERSION, MAX_GENERATED_ACTIONS, MAX_ATTEMPTED_EXTENSIONS, MAX_RETAINED_CANDIDATES } from "./contracts";
export type { CandidateBatchV3, CandidateDiagnostics, CandidateKind, CandidateLane, CandidatePool, Kind, Lane, PoolRecord } from "./contracts";
export const composeCandidatesFromObservationV1 = (observation: AuthorizedObservationV1): CandidateBatchV3 =>
  composeWithRuntime(observation).batch;
export const composeCandidatesFromHistoryV2 = (history: AuthorizedHistory): CandidateBatchV3 => composeHistory(history);
