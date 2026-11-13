// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { canonical, CHALLENGE_CONFIG } from "./config";
import { loadPinnedCorpus, REPOSITORY_ROOT, sha256 } from "./corpus";
import {
  expectedSchedule, loadTrustedExecutionContext, type TrustedExecutionContext,
} from "./schedule";
import { runSupervised } from "./supervisor";
import { executionIntegrity } from "./integrity";
import type { ChallengeEvidence, ChallengeStop } from "./types";
import { collectSourceInventory, type SourceInventoryV1 } from "./sourceInventory";

export { executionIntegrity } from "./integrity";

export type Suite = "all" | "corpus" | "live-strategic";

export const executionPins = () => ({
  version: "challenge-execution-pins-v3" as const,
  sourceInventory: collectSourceInventory(),
  configuration: CHALLENGE_CONFIG,
  configurationSha256: sha256(canonical(CHALLENGE_CONFIG)),
  nodeVersion: process.version,
  seatRng: "w:mulberry32(seed),b:mulberry32(~seed)",
  candidateInferenceSeed: 0,
});

export const normalizeEvidence = (evidence: ChallengeEvidence): string => {
  const { rejectedQueue, ...recordedStop } = evidence.stop;
  const stop = evidence.match.suite === "corpus" && evidence.stop.kind === "queue-rejected" && evidence.stop.side === "w"
    ? recordedStop : evidence.stop;
  return canonical({
  match: { key: evidence.match.key, suite: evidence.match.suite, candidateSide: evidence.match.candidateSide,
    arenaSeed: evidence.match.arenaSeed, inferenceSeed: evidence.match.inferenceSeed, opening: evidence.match.opening },
  policy: evidence.policy, modelArtifact: evidence.modelArtifact, learnedGateEligible: evidence.learnedGateEligible,
  fallbackCount: evidence.fallbackCount, scfens: evidence.scfens, resolves: evidence.resolves,
  bankTrail: evidence.bankTrail, finalBank: evidence.finalBank, outcome: evidence.outcome, stop,
  });
};

export type OutcomeBucket = "win" | "loss" | "draw" | "failure";
export type HistoricalExecutionPinsV2 = Omit<ReturnType<typeof executionPins>, "version" | "sourceInventory"> & {
  version: "challenge-execution-pins-v2"; sourceInventory: SourceInventoryV1;
};
export const decodeHistoricalExecutionPins = (value: unknown): HistoricalExecutionPinsV2 => {
  if (!record(value) || value.version !== "challenge-execution-pins-v2" || !record(value.sourceInventory) ||
    value.sourceInventory.version !== "challenge-source-inventory-v1" || value.sourceInventory.policyVersion !== "challenge-source-policy-v1") {
    throw new Error("Invalid historical execution pins");
  }
  return value as HistoricalExecutionPinsV2;
};
export type FailureReason =
  | { kind: "missing-record" }
  | { kind: "duplicate-record" }
  | { kind: "schedule-anomaly" }
  | { kind: "invalid-evidence" }
  | { kind: "execution-stop"; stopKind: Exclude<ChallengeStop["kind"], "terminal"> };
export type CaseClassification = {
  key: string; suite: "corpus" | "live-strategic"; bucket: OutcomeBucket; failureReason?: FailureReason;
};
export type ScheduleAnomaly = { kind: "unattributable"; key?: string };
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const rowKey = (row: unknown): string | undefined =>
  record(row) && record(row.match) && typeof row.match.key === "string" ? row.match.key : undefined;

export const classifyScheduledEvidence = (rows: readonly unknown[], context: TrustedExecutionContext) => {
  const schedule = expectedSchedule(context);
  const grouped = new Map<string, unknown[]>();
  const anomalies: ScheduleAnomaly[] = [];
  for (const row of rows) {
    const key = rowKey(row);
    if (!key || !schedule.some((match) => match.key === key)) {
      anomalies.push({ kind: "unattributable", ...(key ? { key } : {}) });
      continue;
    }
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const unattributable = anomalies.length > 0;
  const cases: CaseClassification[] = schedule.map((match) => {
    const fail = (failureReason: FailureReason): CaseClassification => ({
      key: match.key, suite: match.suite, bucket: "failure", failureReason,
    });
    if (unattributable) return fail({ kind: "schedule-anomaly" });
    const group = grouped.get(match.key) ?? [];
    if (group.length === 0) return fail({ kind: "missing-record" });
    if (group.length !== 1) return fail({ kind: "duplicate-record" });
    const row = group[0];
    if (!record(row) || !record(row.match) || !record(row.stop) || !executionIntegrity(row as ChallengeEvidence, true, context)) {
      return fail({ kind: "invalid-evidence" });
    }
    const evidence = row as ChallengeEvidence;
    if (evidence.stop.kind !== "terminal" || evidence.outcome === null) {
      return fail({ kind: "execution-stop", stopKind: evidence.stop.kind as Exclude<ChallengeStop["kind"], "terminal"> });
    }
    if (evidence.outcome.draw || evidence.outcome.winner === null) {
      return { key: match.key, suite: match.suite, bucket: "draw" };
    }
    return {
      key: match.key, suite: match.suite,
      bucket: evidence.outcome.winner === match.candidateSide ? "win" : "loss",
    };
  });
  const blocking = new Set(["missing-record", "duplicate-record", "invalid-evidence", "schedule-anomaly"]);
  return {
    version: "challenge-accounting-v1" as const,
    acceptanceValid: cases.every((entry) => !entry.failureReason || !blocking.has(entry.failureReason.kind)),
    cases, anomalies,
  };
};

export const summarize = (rows: ChallengeEvidence[], context?: TrustedExecutionContext) => {
  const trusted = context ?? loadTrustedExecutionContext("all");
  const accounting = classifyScheduledEvidence(rows, trusted);
  const count = (suite: "corpus" | "live-strategic") => {
    const cases = accounting.cases.filter((entry) => entry.suite === suite);
    const submitted = rows.filter((row) => row.match?.suite === suite);
    return {
      scheduled: cases.length,
      wins: cases.filter((entry) => entry.bucket === "win").length,
      losses: cases.filter((entry) => entry.bucket === "loss").length,
      draws: cases.filter((entry) => entry.bucket === "draw").length,
      failures: cases.filter((entry) => entry.bucket === "failure").length,
      stopKinds: Object.fromEntries([...new Set(submitted.map((row) => row.stop.kind))].sort()
        .map((kind) => [kind, submitted.filter((row) => row.stop.kind === kind).length])),
    };
  };
  return { corpus: count("corpus"), liveStrategic: count("live-strategic") };
};

export const runBaselineSuite = async (suite: Suite = "all", rerun = true) => {
  const corpus = loadPinnedCorpus();
  const pins = executionPins();
  const context = loadTrustedExecutionContext(suite);
  const schedule = expectedSchedule(context);
  const rows: ChallengeEvidence[] = [];
  for (const request of schedule) rows.push(await runSupervised(request));
  const comparisons: { key: string; equal: boolean; firstSha256: string; rerunSha256: string }[] = [];
  if (rerun) {
    const auditedAgain = loadPinnedCorpus();
    if (corpus.manifestSha256 !== auditedAgain.manifestSha256 || canonical(pins) !== canonical(executionPins())) throw new Error("execution pins changed before rerun");
    const repeatedSchedule = expectedSchedule(loadTrustedExecutionContext(suite));
    for (const [index, request] of repeatedSchedule.entries()) {
      const repeated = await runSupervised(request);
      const first = normalizeEvidence(rows[index]!);
      const second = normalizeEvidence(repeated);
      comparisons.push({ key: request.key, equal: first === second, firstSha256: sha256(first), rerunSha256: sha256(second) });
    }
  }
  if (canonical(pins) !== canonical(executionPins())) throw new Error("execution pins changed during suite");
  const accounting = classifyScheduledEvidence(rows, context);
  const integrity = accounting.acceptanceValid;
  return {
    version: "phase2-baseline-report-v2", kind: "phase2-current-baseline", learnedGateEligible: false, modelArtifact: null,
    independentVerification: "_spec/evidence/ml-adjutant-r2-refresh/verification.json",
    migrationReference: "_spec/evidence/ml-adjutant-r2-refresh/pin-migration.json",
    manifestSha256: corpus.manifestSha256, sourceSha256: corpus.manifest.sourceSha256, pins,
    suite, schedule: schedule.map(({ trace: _trace, ...entry }) => entry),
    summary: summarize(rows, context), accounting, executionIntegrity: integrity,
    deterministicRerun: { performed: rerun, equal: rerun ? comparisons.every((entry) => entry.equal) : null, comparisons },
    learnedChallengePass: false,
    rows: rows.map(({ match, ...evidence }) => ({
      ...evidence, match,
      historicalSource: match.trace ? { gameId: match.trace.gameId, result: match.trace.historicalResult, traceSha256: match.trace.traceSha256 } : null,
    })),
  };
};
