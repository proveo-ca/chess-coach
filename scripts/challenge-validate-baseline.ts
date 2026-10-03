// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonical, CHALLENGE_CONFIG } from "../packages/starchess-arena/src/challenge/config";
import { loadPinnedCorpus, MANIFEST_SHA256, REPOSITORY_ROOT, sha256, type AuditedCorpus, type PinnedCorpusBytes } from "../packages/starchess-arena/src/challenge/corpus";
import { classifyScheduledEvidence, normalizeEvidence, summarize } from "../packages/starchess-arena/src/challenge/evidence";
import { executionIntegrity } from "../packages/starchess-arena/src/challenge/integrity";
import { createMigration, createMigrationV2, ORIGINAL_BASELINE_SHA256, ORIGINAL_VERIFICATION_SHA256 } from "../packages/starchess-arena/src/challenge/pinMigration";
import { expectedSchedule, loadTrustedExecutionContext, type TrustedExecutionContext } from "../packages/starchess-arena/src/challenge/schedule";
import { collectSourceInventory, collectSourceInventoryV2 } from "../packages/starchess-arena/src/challenge/sourceInventory";
import type { ChallengeEvidence, ScheduledMatch } from "../packages/starchess-arena/src/challenge/types";
import { measureCoverage } from "../packages/starchess-arena/src/challengeContract/coverage";

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const decode = (bytes: Uint8Array): unknown => JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
const requireObject = (value: unknown, label: string): Record<string, unknown> => {
  if (!object(value)) throw new Error(`Invalid ${label} object`);
  return value;
};
const limitsModule: unknown = createRequire(import.meta.url)("../packages/starchess-arena/hermetic/evidence-limits.mjs");
const sharedLimits = requireObject(requireObject(limitsModule, "shared limits module").evidenceLimits, "shared evidence limits");
if (typeof sharedLimits.fileBytes !== "number" || !Number.isSafeInteger(sharedLimits.fileBytes) || sharedLimits.fileBytes <= 0 ||
  typeof sharedLimits.retainedBytes !== "number" || !Number.isSafeInteger(sharedLimits.retainedBytes) || sharedLimits.retainedBytes < sharedLimits.fileBytes) {
  throw new Error("Invalid shared evidence byte limits");
}
const evidenceLimits = { fileBytes: sharedLimits.fileBytes, retainedBytes: sharedLimits.retainedBytes };
const exact = (actual: unknown, expected: unknown, label: string): void => {
  if (canonical(actual) !== canonical(expected)) throw new Error(`${label} mismatch`);
};
const bank = (value: unknown): boolean => object(value) &&
  typeof value.w === "number" && Number.isSafeInteger(value.w) && value.w >= 0 &&
  typeof value.b === "number" && Number.isSafeInteger(value.b) && value.b >= 0;
const matchShape = (value: unknown): value is ScheduledMatch => object(value) &&
  typeof value.key === "string" && (value.suite === "corpus" || value.suite === "live-strategic") &&
  (value.candidateSide === "w" || value.candidateSide === "b") && Number.isSafeInteger(value.arenaSeed) &&
  value.inferenceSeed === 0 && typeof value.opening === "string";
const evidenceShape = (value: unknown): value is ChallengeEvidence => {
  if (!object(value) || !matchShape(value.match) || value.policy !== CHALLENGE_CONFIG.baselineVersion ||
    value.modelArtifact !== null || value.learnedGateEligible !== false || value.fallbackCount !== 0 ||
    !Array.isArray(value.scfens) || !value.scfens.every((entry: unknown) => typeof entry === "string") ||
    !Array.isArray(value.resolves) || !value.resolves.every(object) ||
    !Array.isArray(value.bankTrail) || !value.bankTrail.every(bank) || !bank(value.finalBank) || !object(value.stop)) return false;
  const stop = value.stop;
  if (typeof stop.kind !== "string" || !["terminal", "queue-rejected", "trace-exhausted", "watchdog", "progress-limit", "exception"].includes(stop.kind) ||
    typeof stop.phase !== "string" || !Number.isSafeInteger(stop.planningOrdinal) || !Number.isSafeInteger(stop.turn)) return false;
  return value.outcome === null || (object(value.outcome) && typeof value.outcome.draw === "boolean" &&
    (value.outcome.winner === null || value.outcome.winner === "w" || value.outcome.winner === "b"));
};

const boundedReader = () => {
  let retainedBytes = 0;
  return (path: string | URL): Buffer => {
    const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = fstatSync(descriptor);
      if (!before.isFile() || !Number.isSafeInteger(before.size) || before.size < 0 || before.size > evidenceLimits.fileBytes) {
        throw new Error(`Validator input exceeds byte cap or is not a regular file: ${path}`);
      }
      if (before.size > evidenceLimits.retainedBytes - retainedBytes) throw new Error("Validator retained-input byte cap exceeded");
      retainedBytes += before.size;
      const bytes = Buffer.alloc(before.size);
      let offset = 0;
      while (offset < bytes.length) {
        const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
        if (count === 0) throw new Error(`Validator input truncated during read: ${path}`);
        offset += count;
      }
      const after = fstatSync(descriptor);
      if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw new Error(`Validator input changed during read: ${path}`);
      return bytes;
    } finally { closeSync(descriptor); }
  };
};

type ValidatedBaseline = { report: Record<string, unknown>; rows: ChallengeEvidence[] };
const validateBaseline = (
  value: unknown, phase: "original" | "current", corpus: AuditedCorpus, context: TrustedExecutionContext, refreshed: boolean,
): ValidatedBaseline => {
  const report = requireObject(value, `${phase} baseline`);
  const number = phase === "original" ? "phase1" : "phase2";
  const directory = phase === "current" && refreshed ? "r2-refresh" : number;
  if (report.version !== `${number}-baseline-report-v${phase === "current" && refreshed ? 2 : 1}` || report.kind !== (phase === "original" ? "phase1-baseline" : "phase2-current-baseline") ||
    report.independentVerification !== `_spec/evidence/ml-adjutant-${directory}/verification.json` ||
    (phase === "current" && report.migrationReference !== `_spec/evidence/ml-adjutant-${directory}/pin-migration.json`) ||
    report.suite !== "all" || report.learnedGateEligible !== false || report.modelArtifact !== null ||
    report.learnedChallengePass !== false || report.executionIntegrity !== true ||
    report.manifestSha256 !== corpus.manifestSha256 || report.sourceSha256 !== corpus.manifest.sourceSha256) {
    throw new Error(`Invalid ${phase} baseline provenance or flags`);
  }
  const schedule = expectedSchedule(context);
  if (schedule.length !== 54 || !Array.isArray(report.schedule) || !report.schedule.every(matchShape) ||
    !Array.isArray(report.rows) || report.rows.length !== 54 || !report.rows.every(evidenceShape)) {
    throw new Error(`Invalid ${phase} scheduled evidence shape or cardinality`);
  }
  exact(report.schedule, schedule.map(({ trace: _trace, ...match }) => match), `${phase} ordered schedule`);
  const rows: ChallengeEvidence[] = report.rows;
  for (const [index, authority] of schedule.entries()) {
    const row = rows[index]!;
    exact(row.match, authority, `${phase} row match ${authority.key}`);
    const submitted = requireObject(report.rows[index], `${phase} row`);
    exact(submitted.historicalSource, authority.trace ? {
      gameId: authority.trace.gameId, result: authority.trace.historicalResult, traceSha256: authority.trace.traceSha256,
    } : null, `${phase} historical source ${authority.key}`);
    if (!executionIntegrity(row, true, context)) throw new Error(`Authoritative replay failed: ${phase}/${authority.key}`);
  }
  const accounting = classifyScheduledEvidence(rows, context);
  if (!accounting.acceptanceValid) throw new Error(`Invalid ${phase} authoritative accounting`);
  exact(report.summary, summarize(rows, context), `${phase} full summary`);
  if (phase === "current" || report.accounting !== undefined) exact(report.accounting, accounting, `${phase} full accounting`);
  const rerun = requireObject(report.deterministicRerun, `${phase} deterministic rerun`);
  const comparisons = rows.map((row) => {
    const digest = sha256(normalizeEvidence(row));
    return { key: row.match.key, equal: true, firstSha256: digest, rerunSha256: digest };
  });
  exact(rerun, { performed: true, equal: true, comparisons }, `${phase} deterministic rerun consistency`);
  return { report, rows };
};

export const validateEvidenceFiles = (args: readonly string[]): void => validateFiles(args, false);
export const validateEvidenceFilesV2 = (args: readonly string[]): void => validateFiles(args, true);
const validateFiles = (args: readonly string[], refreshed: boolean): void => {
  if (args.length !== 7 || args.some((argument) => !argument)) {
    throw new Error("Expected [currentBaseline, originalBaseline, originalVerification, migration, coverage, contract, frozenSourceRoot]");
  }
  const [currentPath, originalPath, verificationPath, migrationPath, coveragePath, contractPath, frozenSourceRoot] = args as
    readonly [string, string, string, string, string, string, string];
  const read = boundedReader();
  const currentBytes = read(currentPath);
  const originalBytes = read(originalPath);
  const verificationBytes = read(verificationPath);
  const migrationBytes = read(migrationPath);
  const coverageBytes = read(coveragePath);
  const contractBytes = read(contractPath);
  if (sha256(originalBytes) !== ORIGINAL_BASELINE_SHA256 || sha256(verificationBytes) !== ORIGINAL_VERIFICATION_SHA256) {
    throw new Error("Original evidence raw-byte pin mismatch");
  }
  const root = pathToFileURL(`${resolve(frozenSourceRoot)}${sep}`);
  const manifestBytes = read(new URL("_spec/corpora/ml-adjutant-corpus.manifest.json", root));
  if (sha256(manifestBytes) !== MANIFEST_SHA256) throw new Error("Frozen manifest pin mismatch");
  const manifest = requireObject(decode(manifestBytes), "frozen manifest");
  if (typeof manifest.sourcePath !== "string" || manifest.sourcePath.startsWith("/") || manifest.sourcePath.includes("\\") ||
    manifest.sourcePath.split("/").some((part) => !part || part === "." || part === "..")) throw new Error("Invalid frozen corpus source path");
  const corpusBytes: PinnedCorpusBytes = { manifestBytes, sourceBytes: read(new URL(manifest.sourcePath, root)) };
  const corpus = loadPinnedCorpus(root, corpusBytes);
  const context = loadTrustedExecutionContext("all", root, corpusBytes);
   const current = validateBaseline(decode(currentBytes), "current", corpus, context, refreshed);
   validateBaseline(decode(originalBytes), "original", corpus, context, refreshed);
  const verification = requireObject(decode(verificationBytes), "original verification");
  if (verification.version !== "phase1-independent-verification-v1" ||
    verification.baselineReport !== "_spec/evidence/ml-adjutant-phase1/baseline-report.json" ||
    verification.baselineReportSha256 !== ORIGINAL_BASELINE_SHA256) throw new Error("Original verification provenance mismatch");
  const hermeticPins = requireObject(decode(read(new URL("packages/starchess-arena/hermetic/pins.json", REPOSITORY_ROOT))), "trusted hermetic pins");
  if (typeof hermeticPins.node !== "string" || !/^\d+\.\d+\.\d+$/.test(hermeticPins.node)) throw new Error("Invalid trusted hermetic Node pin");
  const pins = {
    version: refreshed ? "challenge-execution-pins-v3" : "challenge-execution-pins-v2", sourceInventory: refreshed ? collectSourceInventoryV2(fileURLToPath(root)) : collectSourceInventory(fileURLToPath(root)),
    configuration: CHALLENGE_CONFIG, configurationSha256: sha256(canonical(CHALLENGE_CONFIG)),
    nodeVersion: `v${hermeticPins.node}`, seatRng: "w:mulberry32(seed),b:mulberry32(~seed)", candidateInferenceSeed: 0,
  };
  exact(requireObject(current.report.pins, "current execution pins"), pins, "Current execution pins");
  const migration = (refreshed ? createMigrationV2 : createMigration)(originalBytes, verificationBytes, currentBytes);
  if (migration.passed !== true) throw new Error("Recomputed migration parity failed");
  exact(requireObject(decode(migrationBytes), "migration"), {
    ...migration, fromPinFormat: "phase1-legacy-digests", toPinFormat: pins.version,
    inventorySha256: pins.sourceInventory.inventorySha256, importAuditSha256: sha256(canonical(pins.sourceInventory.audit)),
    newlyCoveredPaths: pins.sourceInventory.files.filter((entry) =>
      !entry.path.startsWith("packages/starchess-core/src/") &&
      !["challenge", "cli", "players", "run"].some((directory) => entry.path.startsWith(`packages/starchess-arena/src/${directory}/`))).map((entry) => entry.path),
  }, "Full pin migration");
  const coverage = measureCoverage(root, corpusBytes);
  exact(measureCoverage(root, corpusBytes), coverage, "Host coverage rerun");
  if (coverage.codecRepresentability.covered !== coverage.codecRepresentability.total ||
    coverage.featureRepresentability.covered !== coverage.featureRepresentability.total) throw new Error("Incomplete reference representability");
  exact(requireObject(decode(coverageBytes), "coverage"), coverage, "Full frozen-corpus coverage");
  exact(requireObject(decode(contractBytes), "contract"), {
    version: refreshed ? "phase2-contract-report-v2" : "phase2-contract-report-v1", pins, coverageSha256: sha256(canonical(coverage)),
    baselineReportSha256: sha256(currentBytes), phase1BaselineReportSha256: migration.originalBaselineSha256,
    migrationParity: migration.passed, coverageDeterministic: true,
    observationCodecVersion: coverage.observationCodecVersion, candidateCodecVersion: coverage.candidateCodecVersion,
    enumerationVersion: coverage.enumerationVersion, comparatorVersion: coverage.comparatorVersion,
    featureSchema: coverage.featureSchema, learnedGateEligible: false, modelArtifact: null,
  }, "Full contract report");
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateEvidenceFilesV2(process.argv.slice(2));
  console.log("ok");
}
