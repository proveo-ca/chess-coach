// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { canonical, CHALLENGE_CONFIG } from "./config";
import { loadPinnedCorpus, REPOSITORY_ROOT, sha256 } from "./corpus";
import { buildSchedule } from "./schedule";
import { runSupervised } from "./supervisor";
import { executionIntegrity } from "./integrity";
import type { ChallengeEvidence } from "./types";

export { executionIntegrity } from "./integrity";

export type Suite = "all" | "corpus" | "live-strategic";

const sourceDigest = (paths: string[]): string => {
  const root = fileURLToPath(REPOSITORY_ROOT);
  const entries: { path: string; hash: string }[] = [];
  const walk = (relative: string) => {
    const absolute = join(root, relative);
    for (const entry of readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory() && entry.name !== "__tests__") walk(path);
      else if (entry.isFile() && entry.name.endsWith(".ts")) entries.push({ path, hash: sha256(readFileSync(join(root, path))) });
    }
  };
  for (const path of paths) walk(path);
  return sha256(canonical(entries));
};

export const executionPins = () => ({
  configuration: CHALLENGE_CONFIG,
  configurationSha256: sha256(canonical(CHALLENGE_CONFIG)),
  coreRulesSha256: sourceDigest(["packages/starchess-core/src"]),
  adapterSha256: sourceDigest(["packages/starchess-arena/src/challenge", "packages/starchess-arena/src/cli"]),
  strategicAndLedgerSha256: sourceDigest(["packages/starchess-arena/src/players", "packages/starchess-arena/src/run"]),
  dependencyLockSha256: sha256(readFileSync(new URL("pnpm-lock.yaml", REPOSITORY_ROOT))),
  runtimeConfigurationSha256: sha256(canonical([
    "package.json", "pnpm-workspace.yaml", "packages/starchess-arena/package.json", "packages/starchess-arena/tsconfig.json",
    "packages/starchess-core/package.json", "packages/starchess-core/tsconfig.json",
  ].map((path) => ({ path, hash: sha256(readFileSync(new URL(path, REPOSITORY_ROOT))) })))),
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
    version: "phase1-baseline-report-v1", kind: "phase1-baseline", learnedGateEligible: false, modelArtifact: null,
    independentVerification: "_spec/evidence/ml-adjutant-phase1/verification.json",
    manifestSha256: corpus.manifestSha256, sourceSha256: corpus.manifest.sourceSha256, pins,
    suite, schedule: schedule.map(({ trace: _trace, ...entry }) => entry),
    summary: summarize(rows), executionIntegrity: integrity,
    deterministicRerun: { performed: rerun, equal: rerun ? comparisons.every((entry) => entry.equal) : null, comparisons },
    learnedChallengePass: false,
    rows: rows.map(({ match, ...evidence }) => ({
      ...evidence, match: { ...match, trace: undefined },
      historicalSource: match.trace ? { gameId: match.trace.gameId, result: match.trace.historicalResult, traceSha256: match.trace.traceSha256 } : null,
    })),
  };
};
