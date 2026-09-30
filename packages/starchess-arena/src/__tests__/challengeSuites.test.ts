import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonical } from "../challenge/config";
import { loadPinnedCorpus, REPOSITORY_ROOT, sha256 } from "../challenge/corpus";
import { executionIntegrity, executionPins, normalizeEvidence, summarize } from "../challenge/evidence";
import { buildSchedule } from "../challenge/schedule";
import type { ChallengeEvidence } from "../challenge/types";

const report = JSON.parse(readFileSync(new URL("_spec/evidence/ml-adjutant-phase1/baseline-report.json", REPOSITORY_ROOT), "utf8")) as {
  manifestSha256: string; sourceSha256: string; pins: ReturnType<typeof executionPins>;
  rows: ChallengeEvidence[]; summary: ReturnType<typeof summarize>;
  executionIntegrity: boolean; learnedChallengePass: boolean; learnedGateEligible: boolean;
  deterministicRerun: { performed: boolean; equal: boolean; comparisons: { key: string; equal: boolean; firstSha256: string; rerunSha256: string }[] };
};

describe("persisted exhaustive Phase1 baseline evidence", () => {
  it("contains every pinned18+36 case in exact order, retaining failures", () => {
    const corpus = loadPinnedCorpus();
    const schedule = buildSchedule(corpus);
    expect(report.rows.map((row) => row.match.key)).toEqual(schedule.map((match) => match.key));
    expect(report.rows.map((row) => ({ side: row.match.candidateSide, seed: row.match.arenaSeed })))
      .toEqual(schedule.map((match) => ({ side: match.candidateSide, seed: match.arenaSeed })));
    expect(report.manifestSha256).toBe(corpus.manifestSha256);
    expect(report.sourceSha256).toBe(corpus.manifest.sourceSha256);
    expect(report.summary).toEqual(summarize(report.rows));
    expect(report.summary.corpus.scheduled).toBe(18);
    expect(report.summary.liveStrategic.scheduled).toBe(36);
  });

  it("reexecutes recorded settlement and resource evidence through authoritative rules", () => {
    const corpus = loadPinnedCorpus();
    expect(report.rows.every((row) => executionIntegrity({ ...row,
      match: { ...row.match, trace: corpus.traces.find((trace) => trace.caseId === row.match.key) },
    }))).toBe(true);
    expect(report.executionIntegrity).toBe(true);
    expect(report.rows.every((row) => row.fallbackCount === 0 && row.modelArtifact === null && row.learnedGateEligible === false)).toBe(true);
    expect(report.learnedChallengePass).toBe(false);
    expect(report.learnedGateEligible).toBe(false);
  });

  it("pins the actual source, runtime configuration, rules, seeds, and watchdogs", () => {
    expect(canonical(report.pins)).toBe(canonical(executionPins()));
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
});
