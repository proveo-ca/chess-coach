// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { canonical } from "./config";
import { sha256 } from "./corpus";
import { normalizeEvidence } from "./evidence";
import { executionIntegrity } from "./integrity";
import { loadTrustedExecutionContext } from "./schedule";
import type { ChallengeEvidence, ScheduledMatch } from "./types";

export const ORIGINAL_BASELINE_SHA256 = "940387370040f88888e9dfe0bb86ad9d4a8be88854df507120f34b22ee2d362b";
export const ORIGINAL_VERIFICATION_SHA256 = "55d965afa71d775ff6ee1e95b6650a27d0ce759b966a81c43a3bb364236c7508";
export const PIN_MIGRATION_VERSION = "challenge-pin-migration-v2";
export type BaselineMigrationComparison = {
  key: string; originalSha256: string; currentSha256: string; equal: boolean;
  originalIntegrity: boolean; currentIntegrity: boolean;
};
export type BaselineReportComparison = {
  passed: boolean; scheduledMatches: number; exactSchedule: boolean; executionIntegrity: boolean;
  deterministicRerun: boolean; semanticParity: boolean; comparisons: BaselineMigrationComparison[];
};
export type PinMigrationReport = BaselineReportComparison & {
  version: "challenge-pin-migration-v1";
  originalBaselineSha256: string; originalVerificationSha256: string; currentBaselineSha256: string;
};
export type PinMigrationReportV2 = Omit<PinMigrationReport, "version"> & { version: typeof PIN_MIGRATION_VERSION };
type RerunComparison = { key: string; equal: boolean; firstSha256: string; rerunSha256: string };
type BaselineReport = {
  manifestSha256: string; sourceSha256: string; suite: string;
  learnedGateEligible: false; modelArtifact: null; learnedChallengePass: false;
  executionIntegrity: boolean; schedule: Omit<ScheduledMatch, "trace">[]; rows: ChallengeEvidence[];
  deterministicRerun: { performed: boolean; equal: boolean; comparisons: RerunComparison[] };
};
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const report = (value: unknown, phase: "original" | "current", refreshed: boolean): BaselineReport => {
  const directory = phase === "original" ? "phase1" : refreshed ? "r2-refresh" : "phase2";
  if (!object(value) || value.version !== (phase === "original" ? "phase1-baseline-report-v1" : refreshed ? "phase2-baseline-report-v2" : "phase2-baseline-report-v1") ||
    value.kind !== (phase === "original" ? "phase1-baseline" : "phase2-current-baseline") ||
    value.independentVerification !== `_spec/evidence/ml-adjutant-${directory}/verification.json` ||
    (phase === "current" && (value.migrationReference !== `_spec/evidence/ml-adjutant-${directory}/pin-migration.json` || !object(value.pins) || value.pins.version !== (refreshed ? "challenge-execution-pins-v3" : "challenge-execution-pins-v2")))) throw new Error("Invalid baseline migration provenance");
  if (phase === "current" && refreshed && (!object(value.pins) || !object(value.pins.sourceInventory) ||
    value.pins.sourceInventory.version !== "challenge-source-inventory-v2" || value.pins.sourceInventory.policyVersion !== "challenge-source-policy-v2")) throw new Error("Invalid current source inventory version");
  if (!object(value) || !Array.isArray(value.schedule) || !Array.isArray(value.rows) ||
      !object(value.deterministicRerun) || !Array.isArray(value.deterministicRerun.comparisons) ||
      typeof value.manifestSha256 !== "string" || typeof value.sourceSha256 !== "string" || value.suite !== "all" ||
      value.learnedGateEligible !== false || value.modelArtifact !== null || value.learnedChallengePass !== false ||
      typeof value.executionIntegrity !== "boolean") throw new Error("Invalid baseline migration report");
  for (const entry of value.schedule) {
    if (!object(entry) || typeof entry.key !== "string" || !["corpus", "live-strategic"].includes(String(entry.suite)) ||
        !["w", "b"].includes(String(entry.candidateSide)) || !Number.isSafeInteger(entry.arenaSeed) ||
        entry.inferenceSeed !== 0 || typeof entry.opening !== "string") throw new Error("Invalid baseline schedule");
  }
  for (const row of value.rows) {
    if (!object(row) || !object(row.match) || !Array.isArray(row.scfens) || !Array.isArray(row.resolves) ||
        !Array.isArray(row.bankTrail) || !object(row.finalBank) || !object(row.stop)) throw new Error("Invalid baseline evidence row");
  }
  for (const comparison of value.deterministicRerun.comparisons) {
    if (!object(comparison) || typeof comparison.key !== "string" || typeof comparison.equal !== "boolean" ||
        typeof comparison.firstSha256 !== "string" || typeof comparison.rerunSha256 !== "string") throw new Error("Invalid baseline rerun comparison");
  }
  return value as BaselineReport;
};
const scheduleEntry = ({ trace: _trace, ...match }: ScheduledMatch): Omit<ScheduledMatch, "trace"> => match;

export const compareBaselineReports = (original: unknown, current: unknown): BaselineReportComparison => compareReports(original, current, false);
export const compareBaselineReportsV2 = (original: unknown, current: unknown): BaselineReportComparison => compareReports(original, current, true);
const compareReports = (original: unknown, current: unknown, refreshed: boolean): BaselineReportComparison => {
  const before = report(original, "original", refreshed);
  const after = report(current, "current", refreshed);
  const complete = (value: BaselineReport): boolean => value.schedule.length === 54 && value.rows.length === 54 &&
    new Set(value.schedule.map((entry) => entry.key)).size === 54 &&
    value.rows.every((row, index) => canonical(scheduleEntry(row.match)) === canonical(value.schedule[index]));
  const exactSchedule = complete(before) && complete(after) && canonical(before.schedule) === canonical(after.schedule) &&
    before.manifestSha256 === after.manifestSha256 && before.sourceSha256 === after.sourceSha256;
  const context = loadTrustedExecutionContext("all");
  const comparisons = before.rows.map((row, index): BaselineMigrationComparison => {
    const next = after.rows[index];
    const originalSha256 = sha256(normalizeEvidence(row));
    const currentSha256 = next ? sha256(normalizeEvidence(next)) : "";
    return { key: row.match.key, originalSha256, currentSha256,
      equal: next?.match.key === row.match.key && originalSha256 === currentSha256,
      originalIntegrity: executionIntegrity(row, true, context),
      currentIntegrity: next !== undefined && executionIntegrity(next, true, context) };
  });
  const rerunVerified = (value: BaselineReport): boolean => value.deterministicRerun.performed === true &&
    value.deterministicRerun.equal === true && value.deterministicRerun.comparisons.length === 54 &&
    value.deterministicRerun.comparisons.every((entry, index) => {
      const row = value.rows[index];
      return row !== undefined && entry.key === row.match.key && entry.equal === true &&
        entry.firstSha256 === sha256(normalizeEvidence(row)) && entry.rerunSha256 === entry.firstSha256;
    });
  const deterministicRerun = rerunVerified(before) && rerunVerified(after);
  const integrity = before.executionIntegrity && after.executionIntegrity &&
    comparisons.length === 54 && comparisons.every((entry) => entry.originalIntegrity && entry.currentIntegrity);
  const semanticParity = comparisons.length === 54 && after.rows.length === 54 && comparisons.every((entry) => entry.equal);
  return {
    passed: exactSchedule && integrity && deterministicRerun && semanticParity,
    scheduledMatches: after.schedule.length, exactSchedule, executionIntegrity: integrity, deterministicRerun, semanticParity, comparisons,
  };
};

export const createMigration = (
  originalBytes: Uint8Array, originalVerificationBytes: Uint8Array, currentBytes: Uint8Array,
): PinMigrationReport => migrate(originalBytes, originalVerificationBytes, currentBytes, false) as PinMigrationReport;
export const createMigrationV2 = (
  originalBytes: Uint8Array, originalVerificationBytes: Uint8Array, currentBytes: Uint8Array,
): PinMigrationReportV2 => migrate(originalBytes, originalVerificationBytes, currentBytes, true) as PinMigrationReportV2;
const migrate = (originalBytes: Uint8Array, originalVerificationBytes: Uint8Array, currentBytes: Uint8Array, refreshed: boolean): PinMigrationReport | PinMigrationReportV2 => {
  if (sha256(originalBytes) !== ORIGINAL_BASELINE_SHA256) throw new Error("Original baseline raw-byte pin mismatch");
  if (sha256(originalVerificationBytes) !== ORIGINAL_VERIFICATION_SHA256) throw new Error("Original verification raw-byte pin mismatch");
  const decode = (bytes: Uint8Array): unknown => JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  const verification = decode(originalVerificationBytes);
  if (!object(verification) || verification.baselineReportSha256 !== ORIGINAL_BASELINE_SHA256) throw new Error("Original verification baseline pin mismatch");
  return {
    version: refreshed ? PIN_MIGRATION_VERSION : "challenge-pin-migration-v1",
    originalBaselineSha256: ORIGINAL_BASELINE_SHA256, originalVerificationSha256: ORIGINAL_VERIFICATION_SHA256,
    currentBaselineSha256: sha256(currentBytes), ...compareReports(decode(originalBytes), decode(currentBytes), refreshed),
  };
};
