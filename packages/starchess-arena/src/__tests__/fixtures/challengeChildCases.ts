import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import {
  beginScTurn, endScTurn, formatScFen, normalizeSnapGas, parseScFen, scOutcome,
  type ScActionInput,
} from "@chess-coach/starchess-core";
import { grantStoredIncome, seedBankForOpening } from "../../run/bank";
import { commitPair, stageQueue } from "../../challenge/admission";
import { CHALLENGE_CONFIG } from "../../challenge/config";
import type { ChallengeEvidence, PlanPermit, ScheduledMatch } from "../../challenge/types";
import { WORKER_PROTOCOL } from "../../challenge/types";

const inbox: Record<string, unknown>[] = [];
let waiter: ((message: Record<string, unknown>) => void) | null = null;
const take = () => inbox.length ? Promise.resolve(inbox.shift()!)
  : new Promise<Record<string, unknown>>((resolve) => { waiter = resolve; });
const write = (message: unknown): Promise<void> => new Promise((resolve, reject) => {
  process.stdout.write(`${JSON.stringify(message)}\n`, (error) => error ? reject(error) : resolve());
});
createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line) as Record<string, unknown>;
  if (message.kind === "request") { void run(message.request as ScheduledMatch); return; }
  if (waiter) { const resolve = waiter; waiter = null; resolve(message); }
  else inbox.push(message);
});

const run = async (request: ScheduledMatch) => {
  const [mode, pidFile] = request.key.split(":");
  let ordinal = 0;
  const send = (body: Record<string, unknown>) => write({
    version: WORKER_PROTOCOL, matchKey: request.key, messageOrdinal: ordinal++, ...body,
  });
  let snap = parseScFen(request.opening);
  let bank = seedBankForOpening(snap);
  const evidence: ChallengeEvidence & { workerPid: number; descendantPid?: number; permitIds: string[] } = {
    match: request, policy: "baseline-v1", modelArtifact: null, learnedGateEligible: false, fallbackCount: 0,
    scfens: [formatScFen(normalizeSnapGas(snap))], resolves: [], bankTrail: [], finalBank: bank, outcome: null,
    stop: { kind: "exception", phase: "initial", planningOrdinal: 0, turn: snap.turn, reason: "fixture exception" },
    workerPid: process.pid, permitIds: [],
  };
  const invalid: ScActionInput[] = [{ kind: "classical", timing: "C", color: "w", from: "h4", to: "h5" }];
  const rejection = () => {
    const rejected = stageQueue(beginScTurn(snap).next, bank, "w", invalid, 0);
    if (rejected.ok) throw new Error("fixture queue admitted");
    evidence.stop = { ...rejected.failure, rejectedQueue: invalid };
  };
  if (mode === "direct-rejection") { rejection(); await send({ kind: "complete", evidence }); return; }
  if (mode === "direct-progress-limit") {
    evidence.stop.kind = "progress-limit";
    await send({ kind: "complete", evidence });
    return;
  }
  if (mode === "direct-terminal") {
    evidence.stop.kind = "terminal";
    evidence.outcome = scOutcome(snap);
    await send({ kind: "complete", evidence });
    return;
  }
  const begun = beginScTurn(snap);
  await send({ kind: "turn-open", planningOrdinal: 0, begin: begun, bank });
  let reply = await take();
  snap = begun.next;
  if (begun.asResolve) {
    evidence.resolves.push(begun.asResolve);
    evidence.scfens.push(formatScFen(normalizeSnapGas(snap)));
    evidence.bankTrail.push({ ...bank });
  }
  if (reply.kind === "halt") {
    evidence.stop = { kind: reply.stop as "terminal", phase: "turn-open", planningOrdinal: 0, turn: snap.turn };
    evidence.outcome = scOutcome(snap);
    await send({ kind: "complete", evidence });
    return;
  }
  if (mode === "permit-rejection") {
    rejection();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await send({ kind: "complete", evidence });
    return;
  }
  if (mode === "permit-exception" || mode === "permit-watchdog") {
    const permit = reply.permit as PlanPermit;
    evidence.stop = {
      kind: mode === "permit-exception" ? "exception" : "watchdog", phase: "candidate-plan",
      planningOrdinal: 0, turn: snap.turn, side: permit.side, reason: "fixture planning failure",
    };
    await send({ kind: "complete", evidence });
    return;
  }
  for (let index = 0; index < 2; index++) {
    const permit = reply.permit as PlanPermit;
    evidence.permitIds.push(permit.permitId);
    const actions = mode === "checked-rejection" && permit.side === "w" ? invalid : [];
    await send({
      kind: "decision", permitId: mode === "guessed-permit" ? "0".repeat(32)
        : mode === "replayed-permit" && index === 1 ? evidence.permitIds[0] : permit.permitId,
      planningOrdinal: permit.planningOrdinal, side: permit.side, turn: permit.turn, role: permit.role,
      actions, reportedMinSpend: permit.role === "candidate" ? null : 0,
    });
    if (mode === "guessed-permit" || (mode === "replayed-permit" && index === 1)) return;
    reply = await take();
  }
  if (mode === "checked-rejection") {
    rejection();
    await send({ kind: "admission-failure", stop: evidence.stop, rejectedQueue: invalid });
    await take();
    await send({ kind: "complete", evidence });
    return;
  }
  const white = stageQueue(snap, bank, "w", [], 0);
  const black = stageQueue(snap, bank, "b", [], 0);
  if (!white.ok || !black.ok) throw new Error("fixture empty queue rejected");
  const committed = commitPair(snap, bank, white.staged, black.staged);
  const settled = endScTurn(committed.snapshot, { skipTurnStartChecks: true });
  bank = grantStoredIncome(committed.bank, settled.next.turn);
  await send({ kind: "settlement", planningOrdinal: 0, resolve: settled, bank });
  await take();
  evidence.resolves.push(settled);
  evidence.scfens.push(formatScFen(normalizeSnapGas(settled.next)));
  evidence.bankTrail.push(bank);
  evidence.finalBank = bank;
  evidence.stop = { kind: "exception", phase: "settlement", planningOrdinal: 1, turn: settled.next.turn, reason: "fixture exception" };
  if (mode === "settlement-terminal") {
    evidence.stop.kind = "terminal";
    evidence.outcome = scOutcome(settled.next);
  }
  if (mode?.includes("descendant")) {
    const descendant = spawn(process.execPath, ["-e", "process.send('ready'); setInterval(() => {}, 1000)"], {
      detached: mode === "detached-descendant", stdio: ["ignore", process.stdout, "ignore", "ipc"],
    });
    await new Promise((resolve) => descendant.once("message", resolve));
    evidence.descendantPid = descendant.pid!;
    writeFileSync(pidFile!, JSON.stringify({ workerPid: process.pid, descendantPid: descendant.pid }));
    if (mode === "descendant-crash") process.exit(23);
    if (mode === "descendant-watchdog") { for (;;) {} }
  }
  if (mode === "message-limit") {
    for (let index = ordinal; index <= CHALLENGE_CONFIG.maxIpcMessages; index++) {
      await send({ kind: "phase", phase: "settlement", planningOrdinal: 1, turn: settled.next.turn });
    }
    return;
  }
  await send({ kind: "complete", evidence });
};

void write({ kind: "ready" });
