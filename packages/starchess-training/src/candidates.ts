// SPEC: _spec/packages/starchess-training/candidate-generation.puml
export { composeCandidatesFromObservationV1 } from "./candidates/compose";
export { decodeCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";
export {
  COMPOSITION_VERSION, MAX_GENERATED_ACTIONS, MAX_ATTEMPTED_EXTENSIONS, MAX_RETAINED_CANDIDATES,
} from "./candidates/types";
export type { CandidateBatchV3, CandidateDiagnostics, Kind, Lane, PoolRecord } from "./candidates/types";
