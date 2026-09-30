// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { canonical, CHALLENGE_CONFIG } from "./config";
import { loadPinnedCorpus, REPOSITORY_ROOT, sha256 } from "./corpus";
import { buildSchedule } from "./schedule";
import { runSupervised } from "./supervisor";
import { executionIntegrity } from "./integrity";
import type { ChallengeEvidence } from "./types";
import { collectSourceInventory } from "./sourceInventory";

export { executionIntegrity } from "./integrity";

export type Suite = "all" | "corpus" | "live-strategic";

export const executionPins = () => ({
  version: "challenge-execution-pins-v2",
  sourceInventory: collectSourceInventory(),
  configuration: CHALLENGE_CONFIG,
  configurationSha256: sha256(canonical(CHALLENGE_CONFIG)),
  nodeVersion: process.version,
  seatRng: "w:mulberry32(seed),b:mulberry32(~seed)",
  candidateInferenceSeed: 0,
});

export const normalizeEvidence = (evidence: ChallengeEvidence): string => canonical({
  match: { key: evidence.match.key, suite: evidence.match.suite, candidateSide: evidence.match.candidateSide,
    arenaSeed: evidence.match.arenaSeed, inferenceSeed: evidence.match.inferenceSeed, opening: evidence.match.opening },
  policy: evidence.policy, modelArtifact: evidence.modelArtifact, learnedGateEligible: evidence.learnedGateEligible,
  fallbackCount: evidence.fallbackCount, scfens: evidence.scfens, resolves: evidence.resolves,
  bankTrail: evidence.bankTrail, finalBank: evidence.finalBank, outcome: evidence.outcome, stop: evidence.stop,
});

export const summarize = (rows: ChallengeEvidence[]) => {
  const count = (suite: "corpus" | "live-strategic") => {
    const cases = rows.filter((row) => row.match.suite === suite);
    return {
      scheduled: cases.length,
      wins: cases.filter((row) => executionIntegrity(row) && row.stop.kind === "terminal" && row.outcome?.winner === row.match.candidateSide).length,
      losses: cases.filter((row) => row.stop.kind === "terminal" && row.outcome?.winner !== null && row.outcome?.winner !== row.match.candidateSide).length,
      draws: cases.filter((row) => row.stop.kind === "terminal" && row.outcome?.draw).length,
      failures: cases.filter((row) => row.stop.kind !== "terminal").length,
      stopKinds: Object.fromEntries([...new Set(cases.map((row) => row.stop.kind))].sort()
        .map((kind) => [kind, cases.filter((row) => row.stop.kind === kind).length])),
    };
  };
  return { corpus: count("corpus"), liveStrategic: count("live-strategic") };
};

export const runBaselineSuite = async (suite: Suite = "all", rerun = true) => {
  const corpus = loadPinnedCorpus();
  const pins = executionPins();
  const schedule = buildSchedule(corpus).filter((match) => suite === "all" || match.suite === suite);
  const rows: ChallengeEvidence[] = [];
  for (const request of schedule) rows.push(await runSupervised(request));
  const comparisons: { key: string; equal: boolean; firstSha256: string; rerunSha256: string }[] = [];
  if (rerun) {
    const auditedAgain = loadPinnedCorpus();
    if (corpus.manifestSha256 !== auditedAgain.manifestSha256 || canonical(pins) !== canonical(executionPins())) throw new Error("execution pins changed before rerun");
    const repeatedSchedule = buildSchedule(auditedAgain).filter((match) => suite === "all" || match.suite === suite);
    for (const [index, request] of repeatedSchedule.entries()) {
      const repeated = await runSupervised(request);
      const first = normalizeEvidence(rows[index]!);
      const second = normalizeEvidence(repeated);
      comparisons.push({ key: request.key, equal: first === second, firstSha256: sha256(first), rerunSha256: sha256(second) });
    }
  }
  if (canonical(pins) !== canonical(executionPins())) throw new Error("execution pins changed during suite");
  const integrity = rows.every((row) => executionIntegrity(row));
  return {
    version: "phase2-baseline-report-v1", kind: "phase2-current-baseline", learnedGateEligible: false, modelArtifact: null,
    independentVerification: "_spec/evidence/ml-adjutant-phase2/verification.json",
    migrationReference: "_spec/evidence/ml-adjutant-phase2/pin-migration.json",
    manifestSha256: corpus.manifestSha256, sourceSha256: corpus.manifest.sourceSha256, pins,
    suite, schedule: schedule.map(({ trace: _trace, ...entry }) => entry),
    summary: summarize(rows), executionIntegrity: integrity,
    deterministicRerun: { performed: rerun, equal: rerun ? comparisons.every((entry) => entry.equal) : null, comparisons },
    learnedChallengePass: false,
    rows: rows.map(({ match, ...evidence }) => ({
      ...evidence, match,
      historicalSource: match.trace ? { gameId: match.trace.gameId, result: match.trace.historicalResult, traceSha256: match.trace.traceSha256 } : null,
    })),
  };
};
