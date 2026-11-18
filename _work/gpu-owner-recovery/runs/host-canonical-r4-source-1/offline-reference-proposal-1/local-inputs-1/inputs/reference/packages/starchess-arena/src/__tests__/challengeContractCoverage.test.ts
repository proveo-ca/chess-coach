// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonical } from "../challenge/config";
import { sha256 } from "../challenge/corpus";
import { decodeHistoricalExecutionPins, executionPins } from "../challenge/evidence";
import { measureCoverage } from "../challengeContract/coverage";
import { decode, readEvidenceGeneration } from "./fixtures/challengeEvidence";

const generation = readEvidenceGeneration();
const coverage = decode<ReturnType<typeof measureCoverage>>(generation.files["coverage.json"]);
const report = JSON.parse(generation.files["contract-report.json"].toString("utf8"));
const migration = JSON.parse(generation.files["pin-migration.json"].toString("utf8"));

describe("Phase2 measured coverage and migration evidence", () => {
  it("records codec/feature representability separately from generator membership", () => {
    expect(coverage.codecRepresentability).toEqual({ covered: 282, total: 282 });
    expect(coverage.featureRepresentability).toEqual({ covered: 282, total: 282 });
    expect(coverage.singletonIntents).toEqual({ covered: 204, total: 576 });
    expect(coverage.exactQueues).toEqual({ covered: 18, total: 282 });
    expect(coverage.maximumProposals).toBe(48);
    expect(coverage.byQueueLength["2"]!.covered).toBe(0);
    expect(coverage.fixtures.rows).toHaveLength(14);
    expect(coverage.windows).toHaveLength(282);
    expect(coverage.windows.every((window) => window.representable && !window.error)).toBe(true);
  });

  it("binds contracts and migration to their same-generation baseline and coverage bytes", () => {
    expect(report.coverageSha256).toBe(sha256(canonical(coverage)));
    expect(report.baselineReportSha256).toBe(sha256(generation.files["baseline-report.json"]));
    expect(report.learnedGateEligible).toBe(false);
    expect(report.modelArtifact).toBeNull();
    expect(migration.passed).toBe(true);
    expect(migration.comparisons).toHaveLength(54);
    expect(migration.currentBaselineSha256).toBe(report.baselineReportSha256);
  });

  it("reproduces coverage and distinguishes fresh current pins from historical legacy pins", () => {
    expect(canonical(measureCoverage())).toBe(canonical(coverage));
    if (generation.historical) {
      expect(decodeHistoricalExecutionPins(report.pins).version).toBe("challenge-execution-pins-v2");
    } else {
      expect(canonical(report.pins)).toBe(canonical(executionPins()));
    }
  }, 180000);

  it.each(["baseline-report.json", "coverage.json", "contract-report.json", "pin-migration.json", "r2-composition-report.json"] as const)(
    "requires %s in the configured fresh output without falling back to host history", (missing) => {
      mkdirSync("/tmp/opencode", { recursive: true });
      const directory = mkdtempSync("/tmp/opencode/coverage-generation-");
      const previous = process.env.HERMETIC_OUTPUT_DIRECTORY;
      try {
        for (const [name, bytes] of Object.entries(generation.files)) if (name !== missing && bytes) writeFileSync(join(directory, name), bytes);
        if (missing !== "r2-composition-report.json" && !generation.files["r2-composition-report.json"]) writeFileSync(join(directory, "r2-composition-report.json"), "{}");
        process.env.HERMETIC_OUTPUT_DIRECTORY = directory;
        expect(() => readEvidenceGeneration()).toThrow(missing);
      } finally {
        if (previous === undefined) delete process.env.HERMETIC_OUTPUT_DIRECTORY;
        else process.env.HERMETIC_OUTPUT_DIRECTORY = previous;
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
