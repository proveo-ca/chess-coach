// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { createInterface } from "node:readline";
import { beginScTurn, endScTurn, formatScFen, normalizeSnapGas, parseScFen } from "@chess-coach/starchess-core";
import { grantStoredIncome, seedBankForOpening } from "../../run/bank";
import { commitPair, stageQueue } from "../../challenge/admission";
import type { ChallengeEvidence, PlanPermit, ScheduledMatch } from "../../challenge/types";
import { WORKER_PROTOCOL } from "../../challenge/types";

const send = (message: unknown): Promise<void> => new Promise((resolve, reject) => {
  process.stdout.write(`${JSON.stringify(message)}\n`, (error) => error ? reject(error) : resolve());
});
const hang = () => new Promise<void>(() => {});
const loop = () => { for (;;) {} };
const inbox: Record<string, unknown>[] = [];
let waiter: ((message: Record<string, unknown>) => void) | null = null;
const push = (message: Record<string, unknown>) => {
  if (waiter) { const resolve = waiter; waiter = null; resolve(message); return; }
  inbox.push(message);
};
const waitParent = () => inbox.length
  ? Promise.resolve(inbox.shift()!)
  : new Promise<Record<string, unknown>>((resolve) => { waiter = resolve; });

createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line) as { kind?: string; request?: ScheduledMatch };
  if (message.kind === "request" && message.request) { void handle(message.request); return; }
  push(message);
});

const handle = async (request: ScheduledMatch) => {
  let ordinal = 0;
  const sendChild = (body: Record<string, unknown>) => send({
    version: WORKER_PROTOCOL, matchKey: request.key, messageOrdinal: ordinal++, ...body,
  });
  const snapshot = parseScFen(request.opening);
  const initialBank = seedBankForOpening(snapshot);
  const begun = beginScTurn(snapshot);
  const open = begun.next;
  const white = stageQueue(open, initialBank, "w", [], 0);
  const black = stageQueue(open, initialBank, "b", [], 0);
  if (!white.ok || !black.ok) process.exit(1);
  const committed = commitPair(open, initialBank, white.staged, black.staged);
  const resolved = endScTurn(committed.snapshot, { skipTurnStartChecks: true });
  const finalBank = grantStoredIncome(committed.bank, resolved.next.turn);
  const nextScfen = formatScFen(normalizeSnapGas(resolved.next));
  const evidence: ChallengeEvidence & { workerPid?: number } = {
    match: request, policy: "baseline-v1", modelArtifact: null,
    learnedGateEligible: false, fallbackCount: 0,
    scfens: [formatScFen(normalizeSnapGas(snapshot)), nextScfen],
    resolves: [resolved], bankTrail: [finalBank], finalBank,
    outcome: null,
    stop: { kind: "exception", phase: "settlement", planningOrdinal: 1, turn: resolved.next.turn, reason: "fixture exception" },
  };
  const malformed = request.key.startsWith("malformed-") || ["fabricated-terminal", "wrong-ledger", "altered-resolve", "invalid-stop"].includes(request.key);
  if (malformed) {
    if (request.key === "malformed-identity") evidence.match = { ...request, arenaSeed: request.arenaSeed + 1 };
    if (request.key === "malformed-arrays") evidence.bankTrail = [];
    if (request.key === "malformed-resolve") evidence.resolves = [{} as typeof resolved];
    if (request.key === "malformed-resolve-body") evidence.resolves[0]!.resolved = {} as typeof resolved.resolved;
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
    if (request.key === "malformed-ply-prefix") evidence.scfens[1] = evidence.scfens[0]!;
    await sendChild({ kind: "complete", evidence });
    return;
  }
  if (request.key === "unknown-message") { await sendChild({ kind: "unexpected" }); return; }
  if (request.key === "malformed-phase") { await sendChild({ kind: "phase", phase: "candidate-plan", planningOrdinal: "7", turn: 3 }); return; }
  if (request.key === "duplicate-ready") { await send({ kind: "ready" }); return; }
  if (request.key === "malformed-ply" || request.key === "duplicate-ply" || request.key === "oversized-ply") {
    await sendChild({ kind: "ply", scfen: nextScfen, resolve: request.key === "malformed-ply" ? {} : resolved, bank: finalBank,
      ...(request.key === "oversized-ply" ? { excess: "x".repeat(1_048_577) } : {}) });
    if (request.key === "duplicate-ply") await sendChild({ kind: "ply", scfen: nextScfen, resolve: resolved, bank: finalBank });
    return;
  }
  if (request.key === "oversized-frame") { process.stdout.write("x".repeat(16_777_217)); return; }
  if (request.key === "match-loop") { loop(); return; }
  if (request.key === "crash") process.exit(23);
  if (request.key === "match-chatter") {
    setInterval(() => { void sendChild({ kind: "phase", phase: "ready", planningOrdinal: 0, turn: 0 }); }, 5);
    return;
  }
  await sendChild({ kind: "turn-open", planningOrdinal: 0, begin: begun, bank: initialBank });
  const first = await waitParent();
  const permit = first.permit as PlanPermit;
  if (request.key === "plan-loop") loop();
  if (request.key === "late-decision") {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await sendChild({
      kind: "decision", permitId: permit.permitId, planningOrdinal: permit.planningOrdinal, side: permit.side,
      turn: permit.turn, role: permit.role, actions: [], reportedMinSpend: null,
    });
    return;
  }
  if (request.key === "repeat-plan") {
    setInterval(() => { void sendChild({
      kind: "phase", phase: "candidate-plan", planningOrdinal: permit.planningOrdinal, turn: permit.turn, side: permit.side,
    }); }, 5);
    return;
  }
  await sendChild({
    kind: "decision", permitId: permit.permitId, planningOrdinal: permit.planningOrdinal, side: permit.side,
    turn: permit.turn, role: permit.role, actions: [], reportedMinSpend: permit.role === "candidate" ? null : 0,
  });
  const second = await waitParent();
  const nextPermit = second.permit as PlanPermit;
  if (request.key === "plan-promise") { await hang(); return; }
  await sendChild({
    kind: "decision", permitId: nextPermit.permitId, planningOrdinal: nextPermit.planningOrdinal, side: nextPermit.side,
    turn: nextPermit.turn, role: nextPermit.role, actions: [], reportedMinSpend: 0,
  });
  await waitParent();
  await sendChild({ kind: "settlement", planningOrdinal: 0, resolve: resolved, bank: finalBank });
  await waitParent();
  if (request.key === "ply-before-phase-crash" || request.key === "ply-crash" || request.key === "crash") process.exit(23);
  if (request.key === "ply-loop") loop();
  if (request.key === "ply-promise") { await hang(); return; }
  if (request.key === "normal") {
    evidence.workerPid = process.pid;
    await sendChild({ kind: "complete", evidence });
  }
};

void send({ kind: "ready" });
