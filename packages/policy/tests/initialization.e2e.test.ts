// SPEC: _spec/initialization.puml
import { expect, test } from "bun:test";
import { canonicalInitialObservation } from "@chess-coach/contracts/initialization";
import { encodeObservation } from "@chess-coach/contracts";
import { addScAction, createCanonicalGame } from "@chess-coach/game-core";
import { FEATURES, encodeFeatures, enumerateCandidates } from "../src";

test("both canonical recipients feed bounded candidates and actual features without fabricated fixtures", () => {
  const batches = [];
  for (const side of ["w", "b"] as const) {
    const observation = canonicalInitialObservation(side);
    const json = encodeObservation(observation);
    const batch = enumerateCandidates(json);
    expect(batch.candidates[0]!.actions).toEqual([]);
    expect(batch.candidates.length).toBeGreaterThan(1);
    expect(batch.candidates.length).toBeLessThanOrEqual(512);
    const encoded = encodeFeatures(json, batch.candidates.map(candidate => JSON.stringify(candidate)));
    expect(encoded.rows).toBe(batch.candidates.length);
    expect(encoded.values).toHaveLength(FEATURES * encoded.rows);
    expect(encoded.values.every(Number.isFinite)).toBe(true);
    for (const candidate of batch.candidates) {
      let snapshot = createCanonicalGame().snapshot;
      for (const action of candidate.actions) snapshot = addScAction({ snapshot, action }).snapshot;
    }
    batches.push({ batch, encoded });
  }
  expect(batches[0]!.encoded.values).toEqual(batches[1]!.encoded.values);
  expect(batches[0]!.batch.candidates.length).toBe(batches[1]!.batch.candidates.length);
});
