// SPEC: _spec/packages/starchess-training/candidate-generation.puml
export type { AuthorizedObservationV1, ObservedCell, Sighting } from "./authorized/v1/types";
export { validateObservationV1, encodeObservationV1, decodeObservationV1 } from "./authorized/v1/observationCodec";
