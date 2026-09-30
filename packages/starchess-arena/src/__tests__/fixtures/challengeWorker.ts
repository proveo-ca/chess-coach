// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { createInterface } from "node:readline";
import { endScTurn, formatScFen, normalizeSnapGas, parseScFen } from "@chess-coach/starchess-core";
import { seedBankForOpening, grantStoredIncome } from "../../run/bank";
import type { ChallengeEvidence, ChallengeProgress, ScheduledMatch } from "../../challenge/types";

const send = (message: unknown): Promise<void> => new Promise((resolve, reject) => {
  process.stdout.write(`${JSON.stringify(message)}\n`, (error) => error ? reject(error) : resolve());
});
const hang = () => new Promise<void>(() => {});
const loop = () => { for (;;) {} };

createInterface({ input: process.stdin }).on("line", async (line) => {
  const message = JSON.parse(line) as { kind: "request"; request: ScheduledMatch };
  const request = message.request;
  const snapshot = parseScFen(request.opening);
  const initialBank = seedBankForOpening(snapshot);
  const resolve = endScTurn(snapshot);
  const finalBank = grantStoredIncome(initialBank, resolve.next.turn);
  const nextScfen = formatScFen(normalizeSnapGas(resolve.next));
  const phase: ChallengeProgress = {
    kind: "phase", phase: request.key.includes("promise") ? "strategic-plan" : "candidate-plan",
    planningOrdinal: 7, turn: 3, side: "b",
  };
  const evidence: ChallengeEvidence & { workerPid: number } = {
    match: request, policy: "baseline-v1", modelArtifact: null,
    learnedGateEligible: false, fallbackCount: 0,
    scfens: [formatScFen(normalizeSnapGas(snapshot)), nextScfen],
    resolves: [resolve], bankTrail: [finalBank], finalBank,
    outcome: null,
    stop: { kind: "exception", phase: "candidate-plan", planningOrdinal: 1, turn: 1, side: "b", reason: "fixture exception" },
    workerPid: process.pid,
  };
  if (request.key === "ply-before-phase-crash") {
    await send({ kind: "phase", phase: "settlement", planningOrdinal: 0, turn: 0 });
    await send({ kind: "ply", scfen: nextScfen, resolve, bank: finalBank });
    process.exit(23);
  }
  if (request.key === "unknown-message") {
    await send({ kind: "unexpected" });
    return;
  }
  if (request.key === "malformed-phase") {
    await send({ kind: "phase", phase: "candidate-plan", planningOrdinal: "7", turn: 3 });
    return;
  }
  if (request.key === "duplicate-ready") {
    await send({ kind: "ready" });
    return;
  }
  if (request.key === "malformed-ply") {
    await send({ kind: "ply", scfen: nextScfen, resolve: {}, bank: initialBank });
    return;
  }
  if (request.key.includes("ply") || request.key === "normal") {
    await send({ kind: "ply", scfen: nextScfen, resolve, bank: finalBank });
  }
  if (request.key === "match-loop") phase.phase = "resolve";
  await send(phase);
  if (request.key === "repeat-plan") {
    setInterval(() => { void send({ ...phase, heartbeat: Date.now() }); }, 5);
    return;
  }
  if (request.key === "match-chatter") {
    let planningOrdinal = 8;
    setInterval(() => { void send({ ...phase, planningOrdinal: planningOrdinal++ }); }, 5);
    return;
  }
  if (request.key.includes("loop")) loop();
  if (request.key.includes("promise")) { await hang(); return; }
  if (request.key.includes("crash")) process.exit(23);
  if (request.key === "malformed-identity") evidence.match = { ...request, arenaSeed: request.arenaSeed + 1 };
  if (request.key === "malformed-arrays") evidence.bankTrail = [];
  if (request.key === "malformed-resolve") evidence.resolves = [{} as typeof resolve];
  if (request.key === "malformed-resolve-body") evidence.resolves[0]!.resolved = {} as typeof resolve.resolved;
  if (request.key === "malformed-scfens") evidence.scfens[1] = "invalid";
  if (request.key === "malformed-final-bank") evidence.finalBank = { w: -1, b: 0 };
  if (request.key === "malformed-outcome") Object.assign(evidence, { outcome: { winner: "invalid" } });
  if (request.key === "malformed-policy") evidence.policy = "learned-v1";
  if (request.key === "fabricated-terminal") {
    evidence.outcome = { winner: "w", draw: false };
    evidence.stop.kind = "terminal";
  }
  if (request.key === "wrong-ledger") evidence.bankTrail = [initialBank];
  if (request.key === "altered-resolve") evidence.resolves[0]!.resolved.moves = [{ from: "a1", to: "a2", color: "w", piece: "p" }];
  if (request.key === "invalid-stop") evidence.stop = { kind: "trace-exhausted", phase: "trace", planningOrdinal: 7, turn: 3 };
  if (request.key === "oversized-frame") {
    process.stdout.write("x".repeat(16_777_217));
    return;
  }
  if (request.key === "oversized-ply") {
    await send({ kind: "ply", scfen: nextScfen, resolve, bank: finalBank, excess: "x".repeat(1_048_577) });
    return;
  }
  if (request.key === "duplicate-ply") {
    await send({ kind: "ply", scfen: nextScfen, resolve, bank: finalBank });
    return;
  }
  if (request.key === "malformed-ply-prefix") evidence.scfens[1] = evidence.scfens[0]!;
  await send({ kind: "complete", evidence });
});

void send({ kind: "ready" });
