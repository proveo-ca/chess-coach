// SPEC: _spec/training/candidate-generation.puml
import { beforeAll, describe, expect, it } from "vitest";
import { canonical } from "../challenge/config";
import { measureR2Composition } from "../../../../scripts/r2-composition-evidence";
import { decode, readEvidenceGeneration } from "./fixtures/challengeEvidence";

let report: ReturnType<typeof measureR2Composition>;
beforeAll(() => { report = measureR2Composition(); }, 120000);

describe("R2 composition diagnostic evidence", () => {
  it("measures all pinned historical windows and both host-projected fixture seats", () => {
    expect(report.version).toBe("r2-composition-report-v1");
    expect(report.generatorVersion).toBe("challenge-composition-v3");
    expect(report.historical).toHaveLength(282);
    expect(report.fixtures.map((row) => row.id)).toEqual([
      "promotion/w", "promotion/b", "mine-reservations/w", "mine-reservations/b", "append-time-anchors/w", "append-time-anchors/b",
    ]);
    expect(report.learnedGateEligible).toBe(false);
    expect(report.learnedChallengePass).toBe(false);
    expect(report.modelArtifact).toBeNull();
    expect(Object.values(report.coverageFlags)).toEqual([false, false, false, false]);
  });

  it("records all four native promotion omissions for each seat at the actual work cap", () => {
    for (const row of report.fixtures.filter((fixture) => fixture.id.startsWith("promotion/"))) {
      expect(row.primitiveCoverage).toEqual({ covered: 4, total: 4 });
      expect(row.retainedCoverage).toEqual({ covered: 0, total: 4 });
      expect(row.omittedPrimitiveKeys).toHaveLength(4);
      expect(row.diagnostics.attemptedExtensions).toBe(2048);
      expect(row.diagnostics.stopReason).toBe("attempt-cap");
      expect(row.queues.map((queue) => JSON.parse(queue.key)[1].promotion)).toEqual(["n", "b", "r", "q"]);
    }
  });

  it("separates primitive mine stacks and append-time anchor queues from retained membership", () => {
    for (const row of report.fixtures.filter((fixture) => fixture.id.startsWith("mine-reservations/"))) {
      expect(row.primitiveCoverage).toEqual({ covered: 3, total: 3 });
      expect(row.retainedCoverage).toEqual({ covered: 1, total: 3 });
      expect(row.queues.map((queue) => queue.length)).toEqual([1, 2, 3]);
      expect(row.omittedPrimitiveKeys).toHaveLength(2);
    }
    for (const row of report.fixtures.filter((fixture) => fixture.id.startsWith("append-time-anchors/"))) {
      expect(row.primitiveCoverage).toEqual({ covered: 2, total: 2 });
      expect(row.retainedCoverage).toEqual({ covered: 0, total: 2 });
    }
  });

  it("recounts every histogram and retains closed profile-B funding identities", () => {
    const rows = [...report.historical, ...report.fixtures];
    for (const histogram of [report.attemptsHistogram, report.retainedHistogram, report.stopHistogram, report.quotaHistogram]) expect(Object.values(histogram).reduce((a, b) => a + b, 0)).toBe(288);
    for (const { diagnostics: d } of rows) {
      expect(d.attemptedExtensions).toBeLessThanOrEqual(2048);
      expect(d.uniqueIncludingPass).toBeLessThanOrEqual(512);
      expect(d.uniqueIncludingPass).toBe(1 + d.retainedNonPass);
      expect(d.retainedNonPass).toBe(Object.values(d.retainedByLength).reduce((a, b) => a + b, 0));
      expect(d.pools.reduce((sum, pool) => sum + pool.initialCapacity, 0)).toBe(511);
      expect(d.pools.reduce((sum, pool) => sum + pool.finalCapacity, 0)).toBe(511);
    }
  });

  it("compares fresh producer data to independent measurement and labels fallback as history", () => {
    const generation = readEvidenceGeneration();
    if (generation.historical) {
      expect(generation.files["r2-composition-report.json"]).toBeUndefined();
      expect(decode<{ version: string }>(generation.files["contract-report.json"]).version).toBe("phase2-contract-report-v1");
    } else {
      expect(canonical(decode(generation.files["r2-composition-report.json"]!))).toBe(canonical(report));
    }
  });
});
