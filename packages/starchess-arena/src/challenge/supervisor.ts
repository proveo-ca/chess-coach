// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  beginScTurn, endScTurn, formatScFen, normalizeSnapGas, parseScFen, scOutcome, type EndScTurnResult, type PieceColor,
  type ScActionInput, type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import { grantStoredIncome, seedBankForOpening, type Bank } from "../run/bank";
import { commitPair, stageQueue } from "./admission";
import { canonical, CHALLENGE_CONFIG } from "./config";
import { replayExecutionIntegrity } from "./integrity";
import { expectedMatch, loadTrustedExecutionContext } from "./schedule";
import type { ChallengeEvidence, ChallengeProgress, ChallengeStop, PlanPermit, ScheduledMatch } from "./types";
import { WORKER_PROTOCOL } from "./types";

export type SupervisedOptions = {
  workerUrl?: URL;
  budgets?: { startupMs: number; planMs: number; matchMs: number };
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const ordinal = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const sideOf = (value: unknown) => value === undefined || value === "w" || value === "b";
const bankOf = (value: unknown): value is Bank => record(value) &&
  typeof value.w === "number" && Number.isSafeInteger(value.w) && value.w >= 0 && value.w <= 12 &&
  typeof value.b === "number" && Number.isSafeInteger(value.b) && value.b >= 0 && value.b <= 12;
const resolveResult = (value: unknown): value is EndScTurnResult => {
  if (!record(value) || !record(value.resolved)) return false;
  const resolved = value.resolved;
  return record(value.next) && typeof value.next.placement === "string" &&
    ordinal(value.next.turn) && bankOf(value.next.ccLives) && bankOf(value.next.gas) && bankOf(value.next.gasIncome) &&
    record(value.afterB) && typeof value.afterB.placement === "string" && Array.isArray(value.afterB.mines) &&
    Array.isArray(value.afterB.siegedTanks) && record(value.afterPending) &&
    typeof value.afterPending.placement === "string" && Array.isArray(value.afterPending.mines) &&
    bankOf(value.afterPending.ccLives) &&
    ["attacks", "moves", "pathRevealAttacks", "mineTriggers", "pathRevealMineTriggers",
      "moveCollisions", "promotions", "pendingCCShotsArmed"].every((key) => Array.isArray(resolved[key])) &&
    ["afterAttack", "afterMove", "afterAll"].every((key) => {
      const board = resolved[key];
      return record(board) && typeof board.placement === "string" && bankOf(board.ccLives) && Array.isArray(board.mines);
    }) &&
    ["ignoreAttacksOn", "events", "siegedThisTurn", "bMoves", "fMoves", "queue"]
      .every((key) => Array.isArray(value[key]));
};
const phaseEvent = (value: Record<string, unknown>): value is Record<string, unknown> & Extract<ChallengeProgress, { kind: "phase" }> =>
  value.kind === "phase" && typeof value.phase === "string" && value.phase.length > 0 &&
  ordinal(value.planningOrdinal) && ordinal(value.turn) && sideOf(value.side);
const scfenOf = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try { parseScFen(value); return true; } catch { return false; }
};
const paired = (value: EndScTurnResult, scfen: string): boolean => {
  try { return formatScFen(normalizeSnapGas(value.next)) === scfen; } catch { return false; }
};
const stopKinds = new Set<ChallengeStop["kind"]>([
  "terminal", "queue-rejected", "trace-exhausted", "watchdog", "progress-limit", "exception", "script-contract",
]);
const withoutWitness = (stop: ChallengeStop) => {
  const { sourcePlyIndex: _sourcePlyIndex, rejectedQueue: _rejectedQueue, ...failure } = stop;
  return failure;
};

export const runSupervised = (
  request: ScheduledMatch,
  options: SupervisedOptions = {},
): Promise<ChallengeEvidence> => new Promise((resolve) => {
  let opening = request.opening;
  let initialBank: Bank = { w: 0, b: 0 };
  let initialTurn = 0;
  let openingError: string | undefined;
  let snap: ScFenSnapshot | undefined;
  try {
    snap = parseScFen(request.opening);
    opening = formatScFen(normalizeSnapGas(snap));
    initialBank = seedBankForOpening(snap);
    initialTurn = snap.turn;
  } catch (error) {
    openingError = `invalid opening: ${String(error)}`;
  }
  const scfens = [opening];
  const resolves: EndScTurnResult[] = [];
  const bankTrail: Bank[] = [];
  let bank = { ...initialBank };
  let lastPhase: Extract<ChallengeProgress, { kind: "phase" }> = {
    kind: "phase", phase: "startup", planningOrdinal: 0, turn: initialTurn,
  };
  let child: ChildProcess | undefined;
  const ownsProcessGroup = process.platform !== "win32";
  let ready = false;
  let messageCount = 0;
  let childOrdinal = 0;
  let parentOrdinal = 0;
  let frameChunks: Buffer[] = [];
  let frameBytes = 0;
  let result: ChallengeEvidence | undefined;
  let startupTimer: NodeJS.Timeout | undefined;
  let matchTimer: NodeJS.Timeout | undefined;
  let planTimer: NodeJS.Timeout | undefined;
  let decisionDeadline: bigint | null = null;
  let stage = "expect-turn-open";
  let planningOrdinal = 0;
  let permitSerial = 0;
  let inputBatch = 0;
  let permitBatch = -1;
  let activePermit: PlanPermit | null = null;
  let openSnap: ScFenSnapshot | undefined;
  let openBank: Bank | undefined;
  let expectedStop: ChallengeStop | null = null;
  let expectedStopKind: ChallengeStop["kind"] | null = null;
  const decisions: Partial<Record<PieceColor, ScActionInput[]>> = {};
  const budgets = options.budgets ?? CHALLENGE_CONFIG;
  const policySides = (["w", "b"] as const).filter((side) => side === request.candidateSide || request.suite !== "corpus");

  const clearTimers = () => {
    clearTimeout(startupTimer);
    clearTimeout(matchTimer);
    clearTimeout(planTimer);
    startupTimer = matchTimer = planTimer = undefined;
    decisionDeadline = null;
  };
  const failed = (kind: ChallengeStop["kind"], reason: string): ChallengeEvidence => ({
    match: request, policy: CHALLENGE_CONFIG.baselineVersion,
    modelArtifact: null, learnedGateEligible: false, fallbackCount: 0,
    scfens: [...scfens], resolves: [...resolves], bankTrail: [...bankTrail],
    finalBank: { ...(bankTrail.at(-1) ?? initialBank) }, outcome: null,
    stop: {
      kind, phase: lastPhase.phase,
      planningOrdinal: resolves.filter((entry) => !entry.events.some((event) => event.id.startsWith("ev-begin-"))).length,
      turn: resolves.at(-1)?.next.turn ?? initialTurn, ...(lastPhase.side ? { side: lastPhase.side } : {}), reason,
    },
  });
  const killOwnedProcesses = () => {
    if (ownsProcessGroup && child?.pid) {
      try { process.kill(-child.pid, "SIGKILL"); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill("SIGKILL");
      }
    }
    child?.kill("SIGKILL");
  };
  const finish = (evidence: ChallengeEvidence) => {
    if (result) return;
    result = evidence;
    if (!child) { clearTimers(); resolve(evidence); return; }
    killOwnedProcesses();
  };
  const fail = (kind: ChallengeStop["kind"], reason: string) => finish(failed(kind, reason));
  const protocolError = (reason: string) => fail("script-contract", `worker protocol error: ${reason}`);
  const writeParent = (body: Record<string, unknown>) => {
    child?.stdin?.write(`${JSON.stringify({
      version: WORKER_PROTOCOL, matchKey: request.key, messageOrdinal: parentOrdinal++, ...body,
    })}\n`, (error) => {
      if (error) fail("exception", `worker request failed: ${error.message}`);
    });
  };
  const acceptResolve = (resolveResultValue: EndScTurnResult, nextBank: Bank) => {
    const next = formatScFen(normalizeSnapGas(resolveResultValue.next));
    if (!paired(resolveResultValue, next)) { protocolError("unpaired resolve"); return false; }
    scfens.push(next);
    resolves.push(resolveResultValue);
    bankTrail.push({ ...nextBank });
    snap = resolveResultValue.next;
    bank = { ...nextBank };
    return true;
  };
  const issuePermit = (side: PieceColor) => {
    if (!snap) return;
    const role = side === request.candidateSide ? "candidate" : "strategic";
    activePermit = {
      permitId: randomBytes(16).toString("hex"), matchKey: request.key,
      planningOrdinal, side, turn: snap.turn, role,
    };
    stage = "expect-decision";
    lastPhase = {
      kind: "phase", phase: role === "candidate" ? "candidate-plan" : "strategic-plan",
      planningOrdinal, turn: snap.turn, side,
    };
    decisionDeadline = process.hrtime.bigint() + BigInt(budgets.planMs) * 1_000_000n;
    clearTimeout(planTimer);
    planTimer = setTimeout(() => fail("watchdog", "plan timeout"), budgets.planMs);
    permitBatch = inputBatch;
    permitSerial += 1;
    writeParent({ kind: "permit", permit: activePermit });
  };

  const validCompletion = (value: unknown): value is ChallengeEvidence => {
    if (!record(value) || !record(value.match) || canonical(value.match) !== canonical(request) ||
        value.policy !== CHALLENGE_CONFIG.baselineVersion || value.modelArtifact !== null ||
        value.learnedGateEligible !== false || value.fallbackCount !== 0 ||
        !Array.isArray(value.scfens) || !value.scfens.every(scfenOf) ||
        !Array.isArray(value.resolves) || !value.resolves.every(resolveResult) ||
        !Array.isArray(value.bankTrail) || !value.bankTrail.every(bankOf) || !bankOf(value.finalBank) ||
        value.scfens.length !== value.resolves.length + 1 || value.scfens.length !== scfens.length ||
        value.bankTrail.length !== value.resolves.length || value.resolves.length !== resolves.length ||
        (value.scfens[0] !== opening && value.scfens[0] !== request.opening) ||
        !record(value.stop) || !stopKinds.has(value.stop.kind as ChallengeStop["kind"]) ||
        !phaseEvent({ ...value.stop, kind: "phase" }) ||
        (value.stop.reason !== undefined && typeof value.stop.reason !== "string")) return false;
    switch (value.stop.kind) {
      case "terminal":
        if (!snap || !scOutcome(snap) || !(stage === "expect-turn-open" ||
          (stage === "expect-complete" && expectedStopKind === "terminal"))) return false;
        break;
      case "queue-rejected":
        if (stage !== "expect-complete" || expectedStopKind !== "queue-rejected" || !expectedStop ||
          canonical(value.stop) !== canonical(expectedStop)) return false;
        break;
      case "trace-exhausted":
      case "progress-limit":
        if (stage !== "expect-complete" || expectedStopKind !== value.stop.kind) return false;
        break;
      case "exception":
      case "watchdog":
        break;
      default:
        return false;
    }
    if (value.outcome !== null && (!record(value.outcome) ||
        !((value.outcome.winner === null && value.outcome.draw === true) ||
          ((value.outcome.winner === "w" || value.outcome.winner === "b") &&
            (value.outcome.draw === false || value.outcome.draw === undefined))))) return false;
    if ((value.stop.kind === "terminal") !== (value.outcome !== null) ||
        !replayExecutionIntegrity(value as ChallengeEvidence, request)) return false;
    if (value.bankTrail.length > 0 && canonical(value.finalBank) !== canonical(value.bankTrail.at(-1))) return false;
    const completedResolves = value.resolves as EndScTurnResult[];
    const completedScfens = value.scfens as string[];
    const completedBanks = value.bankTrail as Bank[];
    return resolves.every((entry, index) => canonical(entry) === canonical(completedResolves[index]) &&
      scfens[index + 1] === completedScfens[index + 1] && canonical(bankTrail[index]) === canonical(completedBanks[index]));
  };
  const boundChild = (message: Record<string, unknown>): boolean => {
    if (message.version !== WORKER_PROTOCOL || message.matchKey !== request.key || message.messageOrdinal !== childOrdinal) {
      protocolError("ordinal or session mismatch");
      return false;
    }
    childOrdinal += 1;
    return true;
  };

  const onMessage = (message: unknown, receivedAt: bigint) => {
    if (result) return;
    try {
      if (!record(message)) { protocolError("non-object message"); return; }
      if (++messageCount > CHALLENGE_CONFIG.maxIpcMessages) { protocolError("message count limit exceeded"); return; }
      const limit = message.kind === "complete" ? CHALLENGE_CONFIG.maxCompletionBytes : CHALLENGE_CONFIG.maxProgressBytes;
      if (Buffer.byteLength(JSON.stringify(message), "utf8") > limit) { protocolError("message byte limit exceeded"); return; }
      if (message.kind === "ready") {
        if (ready) { protocolError("duplicate ready"); return; }
        ready = true;
        clearTimeout(startupTimer);
        startupTimer = undefined;
        lastPhase = { ...lastPhase, phase: "ready" };
        matchTimer = setTimeout(() => fail("watchdog", "match timeout"), budgets.matchMs);
        writeParent({ kind: "request", request });
        return;
      }
      if (!ready) { protocolError("message before ready"); return; }
      if (!boundChild(message)) return;
      if (message.kind === "phase") {
        if (!phaseEvent(message)) { protocolError("malformed phase"); return; }
        const same = message.phase === lastPhase.phase && message.planningOrdinal === lastPhase.planningOrdinal &&
          message.turn === lastPhase.turn && message.side === lastPhase.side;
        if (!same) protocolError("phase contradicts checked stage");
        return;
      }
      if (message.kind === "decision" && decisionDeadline !== null && receivedAt >= decisionDeadline) {
        fail("watchdog", "plan timeout");
        return;
      }
      if (message.kind === "turn-open") {
        if (stage !== "expect-turn-open" || !snap || message.planningOrdinal !== planningOrdinal ||
            !record(message.begin) || !bankOf(message.bank)) { protocolError("unexpected turn-open"); return; }
        const local = beginScTurn(snap);
        if (canonical(local) !== canonical(message.begin) || canonical(bank) !== canonical(message.bank)) {
          protocolError("turn-open does not match authoritative begin"); return;
        }
        if (local.asResolve && !acceptResolve(local.asResolve, bank)) return;
        snap = local.next;
        if (scOutcome(snap)) {
          expectedStopKind = "terminal";
          stage = "expect-complete";
          writeParent({ kind: "halt", stop: "terminal" });
          return;
        }
        if (planningOrdinal >= CHALLENGE_CONFIG.maxWindows || resolves.length >= CHALLENGE_CONFIG.maxRecordedPlies) {
          expectedStopKind = "progress-limit";
          stage = "expect-complete";
          writeParent({ kind: "halt", stop: "progress-limit" });
          return;
        }
        if (request.suite === "corpus" && !request.trace?.windows[planningOrdinal]) {
          expectedStopKind = "trace-exhausted";
          stage = "expect-complete";
          writeParent({ kind: "halt", stop: "trace-exhausted" });
          return;
        }
        openSnap = structuredClone(snap);
        openBank = { ...bank };
        issuePermit(policySides[0]!);
        return;
      }
      if (message.kind === "decision") {
        if (inputBatch === permitBatch) { protocolError("decision preceded permit"); return; }
        if (stage !== "expect-decision" || !activePermit || !openSnap || !openBank || !Array.isArray(message.actions) ||
            message.permitId !== activePermit.permitId || message.side !== activePermit.side ||
            message.planningOrdinal !== activePermit.planningOrdinal || message.turn !== activePermit.turn ||
            message.role !== activePermit.role) { protocolError("unexpected decision"); return; }
        const actions = message.actions as ScActionInput[];
        const staged = stageQueue(openSnap, openBank, activePermit.side, actions, planningOrdinal);
        if (activePermit.role === "candidate" && message.reportedMinSpend !== null) {
          protocolError("candidate reported a spend"); return;
        }
        if (activePermit.role === "strategic" && (typeof message.reportedMinSpend !== "number" ||
            (staged.ok && message.reportedMinSpend !== staged.staged.spend))) {
          protocolError("strategic spend differs from admitted deployment costs"); return;
        }
        clearTimeout(planTimer);
        planTimer = undefined;
        decisionDeadline = null;
        decisions[activePermit.side] = actions;
        const nextIndex = +policySides.indexOf(activePermit.side) + 1;
        if (nextIndex < policySides.length) { issuePermit(policySides[nextIndex]!); return; }
        stage = "expect-admission-or-settlement";
        activePermit = null;
        writeParent({ kind: "decisions-complete" });
        return;
      }
      if (message.kind === "admission-failure") {
        if (stage !== "expect-admission-or-settlement" || !openSnap || !openBank || !record(message.stop) ||
            !Array.isArray(message.rejectedQueue) || (message.stop.side !== "w" && message.stop.side !== "b")) {
          protocolError("unexpected admission failure"); return;
        }
        const failure = message.stop as ChallengeStop;
        const side = failure.side!;
        const expectedActions = request.suite === "corpus" && side === "w"
          ? request.trace?.windows[planningOrdinal]?.actions
          : decisions[side];
        if (!expectedActions || canonical(message.rejectedQueue) !== canonical(expectedActions)) {
          protocolError("admission failure queue mismatch"); return;
        }
        const staged = stageQueue(openSnap, openBank, side, expectedActions, planningOrdinal);
        if (staged.ok || canonical(withoutWitness(failure)) !== canonical(staged.failure)) {
          protocolError("admission failure does not match authoritative rejection"); return;
        }
        expectedStop = failure;
        expectedStopKind = "queue-rejected";
        stage = "expect-complete";
        lastPhase = { kind: "phase", phase: "admission", planningOrdinal, turn: openSnap.turn, side };
        writeParent({ kind: "accepted", subject: "admission-failure" });
        return;
      }
      if (message.kind === "settlement") {
        if (stage !== "expect-admission-or-settlement" || !openSnap || !openBank || !resolveResult(message.resolve) ||
            !bankOf(message.bank) || message.planningOrdinal !== planningOrdinal) {
          protocolError("unexpected settlement"); return;
        }
        const whiteActions = request.suite === "corpus" ? request.trace?.windows[planningOrdinal]?.actions : decisions.w;
        const blackActions = decisions.b;
        if (!whiteActions || !blackActions) { protocolError("missing checked selections"); return; }
        const white = stageQueue(openSnap, openBank, "w", whiteActions, planningOrdinal);
        const black = stageQueue(openSnap, openBank, "b", blackActions, planningOrdinal);
        if (!white.ok || !black.ok) { protocolError("settlement follows a rejected queue"); return; }
        const committed = commitPair(openSnap, openBank, white.staged, black.staged);
        const expected = endScTurn(committed.snapshot, { skipTurnStartChecks: true });
        const nextBank = grantStoredIncome(committed.bank, expected.next.turn);
        if (canonical(expected) !== canonical(message.resolve) || canonical(nextBank) !== canonical(message.bank)) {
          protocolError("settlement does not match authoritative resolution"); return;
        }
        if (!acceptResolve(expected, nextBank)) return;
        planningOrdinal += 1;
        lastPhase = { kind: "phase", phase: "settlement", planningOrdinal, turn: expected.next.turn };
        stage = "expect-turn-open";
        writeParent({ kind: "accepted", subject: "settlement" });
        return;
      }
      if (message.kind === "complete") {
        if (!validCompletion(message.evidence)) { protocolError("malformed completion"); return; }
        finish(message.evidence);
        return;
      }
      protocolError("unknown message kind");
    } catch (error) {
      protocolError(String(error));
    }
  };
  const onError = (error: Error) => fail("exception", `worker error: ${error.message}`);
  const onData = (chunk: Buffer) => {
    if (result) return;
    inputBatch += 1;
    let start = 0;
    while (start < chunk.length && !result) {
      const newline = chunk.indexOf(10, start);
      const end = newline < 0 ? chunk.length : newline;
      const part = chunk.subarray(start, end);
      if (frameBytes + part.length > CHALLENGE_CONFIG.maxCompletionBytes) {
        protocolError("frame byte limit exceeded");
        frameChunks = [];
        frameBytes = 0;
        return;
      }
      frameChunks.push(part);
      frameBytes += part.length;
      if (newline < 0) return;
      const receivedAt = process.hrtime.bigint();
      const frame = Buffer.concat(frameChunks, frameBytes);
      frameChunks = [];
      frameBytes = 0;
      try { onMessage(JSON.parse(frame.toString("utf8")), receivedAt); }
      catch { protocolError("invalid JSON frame"); }
      start = newline + 1;
    }
  };
  const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
    clearTimers();
    child!.stdout?.removeListener("data", onData);
    frameChunks = [];
    frameBytes = 0;
    child!.removeListener("error", onError);
    child!.stdin?.removeListener("error", onError);
    result ??= failed("exception", `worker exited before completion (code=${code}, signal=${signal})`);
    resolve(result);
  };
  const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
    result ??= failed("exception", `worker exited before completion (code=${code}, signal=${signal})`);
    killOwnedProcesses();
    child!.stdout?.destroy();
    child!.stdin?.destroy();
  };

  if (openingError) { fail("exception", openingError); return; }
  if (request.suite === "corpus" || expectedMatch(loadTrustedExecutionContext("all"), request.key)) {
    const trusted = expectedMatch(loadTrustedExecutionContext("all"), request.key);
    if (!trusted || canonical(request) !== canonical(trusted)) {
      fail("script-contract", "untrusted roster request"); return;
    }
  }
  if (![budgets.startupMs, budgets.planMs, budgets.matchMs]
    .every((ms) => Number.isSafeInteger(ms) && ms > 0 && ms <= 2_147_483_647)) {
    fail("script-contract", "invalid watchdog budgets"); return;
  }
  startupTimer = setTimeout(() => fail("watchdog", "startup timeout"), budgets.startupMs);
  try {
    child = spawn(process.execPath, ["--import", createRequire(import.meta.url).resolve("tsx"),
      fileURLToPath(options.workerUrl ?? new URL("./worker.ts", import.meta.url))], {
      detached: ownsProcessGroup, stdio: ["pipe", "pipe", "ignore"],
    });
    child.stdout!.on("data", onData);
    child.on("error", onError);
    child.stdin!.on("error", onError);
    child.once("exit", onExit);
    child.once("close", onClose);
  } catch (error) {
    fail("exception", `worker launch failed: ${String(error)}`);
  }
});
