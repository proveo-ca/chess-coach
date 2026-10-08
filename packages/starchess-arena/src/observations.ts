// SPEC: _spec/packages/starchess-training/candidate-generation.puml, _spec/packages/starchess-arena/authorized-economic-boundaries.puml
import type { AuthorizedObservationV1 } from "./authorized/v1/types";
import { OBSERVATION_CODEC_VERSION, validateCompatibleObservation } from "./authorized/v1/observationCodec";
import { canonical } from "./authorized/v1/canonical";
import { fail, inspectDto, object, parseJson } from "./challengeContract/validation";

export type { AuthorizedObservationV1 } from "./authorized/v1/types";
export const validateObservationV1 = (value: unknown): AuthorizedObservationV1 => {
  return validateCompatibleObservation(inspectDto(value));
};
export const encodeObservationV1 = (observation: AuthorizedObservationV1): string => canonical({ codecVersion: OBSERVATION_CODEC_VERSION, observation: validateObservationV1(observation) });
export const decodeObservationV1 = (json: string): AuthorizedObservationV1 => {
  const envelope = object(inspectDto(parseJson(json)), "$", ["codecVersion", "observation"]);
  if (envelope.codecVersion !== OBSERVATION_CODEC_VERSION) fail("$.codecVersion", "VERSION");
  return validateCompatibleObservation(envelope.observation);
};
export { validateObservation, decodeObservation, encodeObservation } from "./authorized/v2/observation";
export type {
  AuthorizedSnapshotV2, AuthorizedHistory, AuthorizedOwnState, AuthorizedPiece, ObservedCell, Sighting,
  Side, Square, UnitType, SpawnPiece, OwnActionRef, OwnUnitLineage, OwnMineLineage,
  EconomicState, EnemyLoss, PaidReceipt, DeploymentDisposition, AuthorizedEvent, AuthorizedBoundaryBatch,
  BoundaryPhase, OwnMineAuditState, ReconciledBoundaryState, CandidatePolicyV2,
} from "./authorized/v2/types";
