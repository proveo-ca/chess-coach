// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
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

export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

export const canonical = (value: unknown): string => {
  const sorted = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sorted);
    if (v && typeof v === "object") return Object.fromEntries(
      Object.entries(v).filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, child]) => [key, sorted(child)]),
    );
    return v;
  };
  return JSON.stringify(sorted(value));
};
