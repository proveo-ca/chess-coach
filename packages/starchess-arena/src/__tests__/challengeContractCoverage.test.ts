// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonical } from "../challenge/config";
import { REPOSITORY_ROOT, sha256 } from "../challenge/corpus";
import { executionPins } from "../challenge/evidence";
import { measureCoverage } from "../challengeContract/coverage";

const coverage = JSON.parse(readFileSync(new URL("_spec/evidence/ml-adjutant-phase2/coverage.json", REPOSITORY_ROOT), "utf8")) as ReturnType<typeof measureCoverage>;
const report = JSON.parse(readFileSync(new URL("_spec/evidence/ml-adjutant-phase2/contract-report.json", REPOSITORY_ROOT), "utf8"));
const migration = JSON.parse(readFileSync(new URL("_spec/evidence/ml-adjutant-phase2/pin-migration.json", REPOSITORY_ROOT), "utf8"));

describe("Phase2 measured coverage and migration evidence", () => {
  it("reproduces codec/feature representability separately from generator membership", () => {
    expect(canonical(measureCoverage())).toBe(canonical(coverage));
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

  it("binds contracts, complete inventory and current runtime pins to the executed baseline", () => {
    expect(canonical(report.pins)).toBe(canonical(executionPins()));
    expect(report.coverageSha256).toBe(sha256(canonical(coverage)));
    expect(report.baselineReportSha256).toBe(sha256(readFileSync(new URL("_spec/evidence/ml-adjutant-phase2/baseline-report.json", REPOSITORY_ROOT))));
    expect(report.learnedGateEligible).toBe(false);
    expect(report.modelArtifact).toBeNull();
    expect(migration.passed).toBe(true);
    expect(migration.comparisons).toHaveLength(54);
    expect(migration.currentBaselineSha256).toBe(report.baselineReportSha256);
  });
});
