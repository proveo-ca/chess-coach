import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sha256 } from "../challenge/corpus";
import { compareBaselineReports, createMigration, ORIGINAL_BASELINE_SHA256, ORIGINAL_VERIFICATION_SHA256 } from "../challenge/pinMigration";
import type { ChallengeEvidence, ScheduledMatch } from "../challenge/types";

const baselineBytes = readFileSync(new URL("../../../../_spec/evidence/ml-adjutant-phase1/baseline-report.json", import.meta.url));
const verificationBytes = readFileSync(new URL("../../../../_spec/evidence/ml-adjutant-phase1/verification.json", import.meta.url));
type FixtureReport = {
  version: string; kind: string; independentVerification: string; migrationReference?: string;
  pins: Record<string, unknown>; schedule: Omit<ScheduledMatch, "trace">[]; rows: ChallengeEvidence[];
  executionIntegrity: boolean; manifestSha256: string;
  deterministicRerun: { performed: boolean; equal: boolean; comparisons: { key: string; equal: boolean; firstSha256: string; rerunSha256: string }[] };
};
const baseline = (): FixtureReport => JSON.parse(baselineBytes.toString("utf8")) as FixtureReport;
const currentBaseline = (): FixtureReport => ({ ...baseline(), version: "phase2-baseline-report-v1", kind: "phase2-current-baseline",
  independentVerification: "_spec/evidence/ml-adjutant-phase2/verification.json", migrationReference: "_spec/evidence/ml-adjutant-phase2/pin-migration.json",
  pins: { version: "challenge-execution-pins-v2" },
});

describe("baseline execution pin migration", () => {
  it("pins the original baseline and verification raw bytes and verifies all 54 semantic rows", () => {
    expect(sha256(baselineBytes)).toBe(ORIGINAL_BASELINE_SHA256);
    expect(sha256(verificationBytes)).toBe(ORIGINAL_VERIFICATION_SHA256);
    const comparison = compareBaselineReports(baseline(), currentBaseline());
    expect(comparison).toMatchObject({ passed: true, scheduledMatches: 54, exactSchedule: true,
      executionIntegrity: true, deterministicRerun: true, semanticParity: true });
    expect(comparison.comparisons).toHaveLength(54);
    expect(comparison.comparisons.every((row) => row.equal && row.originalIntegrity && row.currentIntegrity)).toBe(true);
    expect(new Set(comparison.comparisons.map((row) => row.key)).size).toBe(54);
  });

  it("permits changed source/runtime pins while retaining exact execution semantics", () => {
    const current = currentBaseline();
    current.pins = { version: "challenge-execution-pins-v2", inventorySha256: "new-inventory", executionSha256: "new-execution" };
    const currentBytes = Buffer.from(JSON.stringify(current));
    const migration = createMigration(baselineBytes, verificationBytes, currentBytes);
    expect(migration).toMatchObject({ version: "challenge-pin-migration-v1", passed: true,
      originalBaselineSha256: ORIGINAL_BASELINE_SHA256, originalVerificationSha256: ORIGINAL_VERIFICATION_SHA256,
      currentBaselineSha256: sha256(currentBytes) });
    expect(migration.currentBaselineSha256).not.toBe(migration.originalBaselineSha256);
  });

  it("rejects reformatted or appended original bytes even when the JSON remains equivalent", () => {
    expect(() => createMigration(Buffer.from(JSON.stringify(baseline())), verificationBytes, baselineBytes)).toThrow("Original baseline raw-byte pin mismatch");
    expect(() => createMigration(baselineBytes, Buffer.concat([verificationBytes, Buffer.from("\n")]), baselineBytes)).toThrow("Original verification raw-byte pin mismatch");
  });

  it.each(["missing", "duplicate", "reordered", "seed", "side", "opening", "manifest"])("rejects changed schedule identity: %s", (mutation) => {
    const current = currentBaseline();
    if (mutation === "missing") { current.schedule.pop(); current.rows.pop(); }
    if (mutation === "duplicate") { current.schedule[1] = current.schedule[0]!; current.rows[1] = current.rows[0]!; }
    if (mutation === "reordered") { current.schedule.reverse(); current.rows.reverse(); current.deterministicRerun.comparisons.reverse(); }
    if (mutation === "seed") current.schedule[0]!.arenaSeed++;
    if (mutation === "side") current.schedule[0]!.candidateSide = "w";
    if (mutation === "opening") current.schedule[0]!.opening += "changed";
    if (mutation === "manifest") current.manifestSha256 = "changed";
    expect(compareBaselineReports(baseline(), current)).toMatchObject({ passed: false, exactSchedule: false });
  });

  it.each(["not-performed", "not-equal", "missing", "key", "first-hash", "rerun-hash", "claim"])("rejects unverified deterministic reruns: %s", (mutation) => {
    const current = currentBaseline();
    const rerun = current.deterministicRerun;
    if (mutation === "not-performed") rerun.performed = false;
    if (mutation === "not-equal") rerun.equal = false;
    if (mutation === "missing") rerun.comparisons.pop();
    if (mutation === "key") rerun.comparisons[0]!.key = "forged-key";
    if (mutation === "first-hash") rerun.comparisons[0]!.firstSha256 = "forged-hash";
    if (mutation === "rerun-hash") rerun.comparisons[0]!.rerunSha256 = "forged-hash";
    if (mutation === "claim") rerun.comparisons[0]!.equal = false;
    expect(compareBaselineReports(baseline(), current)).toMatchObject({ passed: false, deterministicRerun: false });
  });

  it("reexecutes evidence integrity rather than accepting report flags or matching forged bodies", () => {
    const original = baseline();
    const current = currentBaseline();
    original.rows[0]!.bankTrail[0]!.b = 99;
    current.rows[0]!.bankTrail[0]!.b = 99;
    const comparison = compareBaselineReports(original, current);
    expect(comparison).toMatchObject({ passed: false, semanticParity: true, executionIntegrity: false });
    expect(comparison.comparisons[0]).toMatchObject({ originalIntegrity: false, currentIntegrity: false });
  });

  it("detects changed normalized event IDs and stop evidence", () => {
    const current = currentBaseline();
    current.rows[0]!.resolves[0]!.events[0]!.id = "changed-id";
    expect(compareBaselineReports(baseline(), current)).toMatchObject({ passed: false, semanticParity: false });
    const stop = currentBaseline();
    stop.rows[0]!.stop.reason = "changed reason";
    expect(compareBaselineReports(baseline(), stop)).toMatchObject({ passed: false, semanticParity: false });
  });

  it("ignores diagnostic-only historical labels but retains execution outcome and eligibility", () => {
    const original = baseline();
    const current = currentBaseline();
    const row = current.rows[0]! as ChallengeEvidence & { historicalSource: unknown };
    row.historicalSource = { result: "changed historical annotation" };
    expect(compareBaselineReports(original, current).passed).toBe(true);
    current.rows[0]!.outcome = { winner: "b", draw: false };
    expect(compareBaselineReports(original, current).passed).toBe(false);
    expect(() => compareBaselineReports(original, { ...currentBaseline(), learnedGateEligible: true })).toThrow("Invalid baseline");
  });

  it("rejects malformed inputs and report integrity claims", () => {
    expect(() => compareBaselineReports({}, currentBaseline())).toThrow("Invalid baseline");
    expect(() => compareBaselineReports(baseline(), { ...currentBaseline(), rows: [null] })).toThrow("Invalid baseline evidence row");
    const current = currentBaseline();
    current.executionIntegrity = false;
    expect(compareBaselineReports(baseline(), current)).toMatchObject({ passed: false, executionIntegrity: false });
  });

  it.each(["version", "kind", "independentVerification", "migrationReference"] as const)("rejects incorrect current provenance %s", (field) => {
    const current = currentBaseline();
    current[field] = "wrong";
    expect(() => compareBaselineReports(baseline(), current)).toThrow("Invalid baseline migration provenance");
  });
});
