// SPEC: _spec/checkpoint-runtime.puml
import { expect, test } from "bun:test";
import { experimentShape, finalModelShape } from "../../contracts/src/training-artifact";
import { bindings, byteRef, syntheticRecord } from "./training-fixture";
import { evidencePacket } from "../src/training-coordinator";
import type { AttemptDescriptor } from "../../contracts/src/training-state";

function artifact() {
  const model = syntheticRecord("synthetic-final-metadata-not-a-burn-model");
  return { version: "chess-coach.training-artifact.v1", status: "VALID", master: 101, model: model.config,
    recordRef: { byteLength: model.record.byteLength, sha256: model.config.recordSha256 }, configRef: byteRef("synthetic-config"),
    counters: { started: 1000, verifiedCompleted: 1000, eligibleCompleted: 1, updates: 1, nonzeroPGUpdates: 1, baselineCount: 1, baselineSum: -1 },
    finalJournalRef: { ...byteRef("synthetic-final-journal"), lastRecordOrdinal: 1000 }, bindings: bindings() };
}

test("synthetic final artifact metadata enforces final counts and excludes all private scheduling/RNG fields", () => {
  const value = artifact();
  expect(finalModelShape.parse(value).master).toBe(101);
  for (const field of ["rng", "control", "corpusPermutation", "historyRefs", "rawScfen"]) expect(() => finalModelShape.parse({ ...value, [field]: {} })).toThrow();
  for (const kind of ["started", "nonzero", "record"] as const) {
    const bad = artifact();
    if (kind === "started") bad.counters.started = 999;
    if (kind === "nonzero") bad.counters.nonzeroPGUpdates = 0;
    if (kind === "record") bad.recordRef.sha256 = "0".repeat(64);
    expect(() => finalModelShape.parse(bad)).toThrow();
  }
});

test("formal primary requires all five ordered masters and never falls back to a completed prefix", () => {
  const artifacts = [101, 102, 103, 104, 105].map(master => ({ master, artifactRef: byteRef(String(master)) }));
  const value = { version: "chess-coach.training-experiment.v1", status: "COMPLETE", artifacts, primaryMaster: 101, primaryArtifactRef: artifacts[0]!.artifactRef };
  expect(experimentShape.parse(value).artifacts).toHaveLength(5);
  expect(() => experimentShape.parse({ ...value, artifacts: artifacts.slice(0, 1) })).toThrow();
  expect(() => experimentShape.parse({ ...value, artifacts: [...artifacts].reverse() })).toThrow();
  expect(() => experimentShape.parse({ ...value, primaryMaster: 102 })).toThrow();
  expect(() => experimentShape.parse({ ...value, primaryArtifactRef: artifacts[1]!.artifactRef })).toThrow();
});

test("C15 exactly 5000 scheduled slots map to fifty fixed 100-slot packets", () => {
  const packets = Array(50).fill(0);
  for (const master of [101, 102, 103, 104, 105]) for (let startedOrdinal = 0; startedOrdinal < 1000; startedOrdinal++) {
    const index = evidencePacket({ master, startedOrdinal } as AttemptDescriptor);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(50);
    packets[index]++;
  }
  expect(packets).toEqual(Array(50).fill(100));
});
