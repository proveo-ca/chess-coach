// SPEC: _spec/packages/starchess-arena/newgeneration.puml
import type { AuthorizedObservationV1 } from "./authorized/v1/types";
import { decodeObservation, encodeObservation, validateObservation } from "./authorized/v1/observationCodec";
import { inspectDto } from "./challengeContract/validation";

export type { AuthorizedObservationV1 } from "./authorized/v1/types";
export const validateObservationV1 = (value: unknown): AuthorizedObservationV1 => {
  return validateObservation(inspectDto(value));
};
export const encodeObservationV1 = (observation: AuthorizedObservationV1): string => encodeObservation(validateObservationV1(observation));
export const decodeObservationV1 = (json: string): AuthorizedObservationV1 => validateObservationV1(decodeObservation(json));
