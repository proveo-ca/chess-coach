// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { AuthorizedObservationV1 } from "@chess-coach/starchess-arena/observations";
import type { CandidateBatchV3 } from "./contracts";
import { composeWithRuntime } from "./composition";

export { decodeCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";
export type { CandidateBatchV3, CandidateDiagnostics, CandidateKind, CandidateLane, CandidatePool } from "./contracts";
export const composeCandidatesFromObservationV1 = (observation: AuthorizedObservationV1): CandidateBatchV3 =>
  composeWithRuntime(observation).batch;
