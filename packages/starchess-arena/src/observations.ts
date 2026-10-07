// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { AuthorizedObservationV1 } from "./authorized/v1/types";
import { decodeObservation, encodeObservation, validateObservation } from "./authorized/v1/observationCodec";
import { inspectDto } from "./challengeContract/validation";

export type { AuthorizedObservationV1 } from "./authorized/v1/types";
export const validateObservationV1 = (value: unknown): AuthorizedObservationV1 => {
  return validateObservation(inspectDto(value));
};
export const encodeObservationV1 = (observation: AuthorizedObservationV1): string => encodeObservation(validateObservationV1(observation));
export const decodeObservationV1 = (json: string): AuthorizedObservationV1 => validateObservationV1(decodeObservation(json));
export { validateObservation, decodeObservation, encodeObservation } from "./authorized/v2/observation";
export type {
  AuthorizedSnapshotV2, AuthorizedHistory, AuthorizedOwnState, AuthorizedPiece, ObservedCell, Sighting,
  Side, Square, UnitType, SpawnPiece, OwnActionRef, OwnUnitLineage, OwnMineLineage,
  EconomicState, EnemyLoss, PaidReceipt, DeploymentDisposition, AuthorizedEvent, AuthorizedBoundaryBatch,
  BoundaryPhase, OwnMineAuditState, ReconciledBoundaryState, CandidatePolicyV2,
} from "./authorized/v2/types";
