import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonical } from "../challenge/config";
import { loadPinnedCorpus, REPOSITORY_ROOT, sha256 } from "../challenge/corpus";
import { executionIntegrity, executionPins, normalizeEvidence, summarize } from "../challenge/evidence";
import { buildSchedule, loadTrustedExecutionContext } from "../challenge/schedule";
import type { ChallengeEvidence } from "../challenge/types";
import { compareBaselineReports, ORIGINAL_BASELINE_SHA256, ORIGINAL_VERIFICATION_SHA256 } from "../challenge/pinMigration";
import { decode, originalEvidence, readEvidenceGeneration } from "./fixtures/challengeEvidence";

const original = originalEvidence();
const generation = readEvidenceGeneration();
const report = decode<{
  manifestSha256: string; sourceSha256: string; pins: ReturnType<typeof executionPins>;
  rows: ChallengeEvidence[]; summary: ReturnType<typeof summarize>;
  executionIntegrity: boolean; learnedChallengePass: boolean; learnedGateEligible: boolean;
  deterministicRerun: { performed: boolean; equal: boolean; comparisons: { key: string; equal: boolean; firstSha256: string; rerunSha256: string }[] };
}>(original.baseline);
const current = decode<typeof report>(generation.files["baseline-report.json"]);

describe("persisted exhaustive Phase1 baseline evidence", () => {
  it("contains every pinned18+36 case in exact order, retaining failures", () => {
    const corpus = loadPinnedCorpus();
    const schedule = buildSchedule(corpus);
    expect(report.rows.map((row) => row.match.key)).toEqual(schedule.map((match) => match.key));
    expect(report.rows.map((row) => ({ side: row.match.candidateSide, seed: row.match.arenaSeed })))
      .toEqual(schedule.map((match) => ({ side: match.candidateSide, seed: match.arenaSeed })));
    expect(report.manifestSha256).toBe(corpus.manifestSha256);
    expect(report.sourceSha256).toBe(corpus.manifest.sourceSha256);
    expect(report.summary).toEqual(summarize(report.rows, loadTrustedExecutionContext("all")));
    expect(report.summary.corpus.scheduled).toBe(18);
    expect(report.summary.liveStrategic.scheduled).toBe(36);
  });

  it("reexecutes recorded settlement and resource evidence through authoritative rules", () => {
    expect(report.rows.filter((row) => row.match.suite === "corpus").every((row) => row.match.trace)).toBe(true);
    expect(report.rows.every((row) => executionIntegrity(row))).toBe(true);
    expect(report.executionIntegrity).toBe(true);
    expect(report.rows.every((row) => row.fallbackCount === 0 && row.modelArtifact === null && row.learnedGateEligible === false)).toBe(true);
    expect(report.learnedChallengePass).toBe(false);
    expect(report.learnedGateEligible).toBe(false);
  });

  it("retains immutable historical baseline and verification bytes", () => {
    expect(sha256(readFileSync(new URL("_spec/evidence/ml-adjutant-phase1/baseline-report.json", REPOSITORY_ROOT)))).toBe(ORIGINAL_BASELINE_SHA256);
    expect(sha256(readFileSync(new URL("_spec/evidence/ml-adjutant-phase1/verification.json", REPOSITORY_ROOT)))).toBe(ORIGINAL_VERIFICATION_SHA256);
  });

  it.runIf(!generation.historical)("pins fresh evidence to the actual source, runtime configuration, rules, seeds, and watchdogs", () => {
    expect(canonical(current.pins)).toBe(canonical(executionPins()));
  });

  it("records semantic parity for an independently executed rerun of each scheduled case", () => {
    expect(report.deterministicRerun.performed).toBe(true);
    expect(report.deterministicRerun.equal).toBe(true);
    expect(report.deterministicRerun.comparisons.map((entry) => entry.key)).toEqual(report.rows.map((row) => row.match.key));
    for (const [index, entry] of report.deterministicRerun.comparisons.entries()) {
      expect(entry.equal).toBe(true);
      expect(entry.firstSha256).toBe(sha256(normalizeEvidence(report.rows[index]!)));
      expect(entry.rerunSha256).toBe(entry.firstSha256);
    }
  });

  it("preserves all 54 original semantic executions across the pin-partition migration", () => {
    const comparison = compareBaselineReports(report, current);
    expect(comparison.passed).toBe(true);
    expect(comparison.comparisons).toHaveLength(54);
    expect(comparison.comparisons.every((entry) => entry.equal && entry.originalIntegrity && entry.currentIntegrity)).toBe(true);
  });
});
