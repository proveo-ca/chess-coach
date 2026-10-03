// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
export const CHALLENGE_CONFIG = Object.freeze({
  version: "phase1-v1",
  observationVersion: "challenge-observation-v1",
  baselineVersion: "baseline-v1",
  mergeOrder: "white-then-black-array-order",
  startupMs: 10_000,
  planMs: 10_000,
  matchMs: 300_000,
  maxWindows: 64,
  maxRecordedPlies: 128,
  maxProposals: 4096,
  maxIpcMessages: 2048,
  maxProgressBytes: 1_048_576,
  maxCompletionBytes: 16_777_216,
  inferenceSeed: 0,
  feed: "off",
  movetimeMs: 0,
});

export { canonical, deepFreeze } from "../authorized/v1/canonical";
