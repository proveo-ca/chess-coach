// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { fork, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  formatScFen, normalizeSnapGas, parseScFen, type EndScTurnResult,
} from "@chess-coach/starchess-core";
import { seedBankForOpening, type Bank } from "../run/bank";
import { canonical, CHALLENGE_CONFIG } from "./config";
import { executionIntegrity } from "./integrity";
import type { ChallengeEvidence, ChallengeProgress, ChallengeStop, ScheduledMatch } from "./types";

export type SupervisedOptions = {
  workerUrl?: URL;
  budgets?: { startupMs: number; planMs: number; matchMs: number };
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const ordinal = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const side = (value: unknown) => value === undefined || value === "w" || value === "b";
const bank = (value: unknown): value is Bank => record(value) &&
  typeof value.w === "number" && Number.isSafeInteger(value.w) && value.w >= 0 && value.w <= 12 &&
  typeof value.b === "number" && Number.isSafeInteger(value.b) && value.b >= 0 && value.b <= 12;
const resolveResult = (value: unknown): value is EndScTurnResult => {
  if (!record(value) || !record(value.resolved)) return false;
  const resolved = value.resolved;
  return record(value.next) && typeof value.next.placement === "string" &&
    ordinal(value.next.turn) && bank(value.next.ccLives) && bank(value.next.gas) && bank(value.next.gasIncome) &&
    record(value.afterB) && typeof value.afterB.placement === "string" && Array.isArray(value.afterB.mines) &&
    Array.isArray(value.afterB.siegedTanks) && record(value.afterPending) &&
    typeof value.afterPending.placement === "string" && Array.isArray(value.afterPending.mines) &&
    bank(value.afterPending.ccLives) &&
    ["attacks", "moves", "pathRevealAttacks", "mineTriggers", "pathRevealMineTriggers",
      "moveCollisions", "promotions", "pendingCCShotsArmed"].every((key) => Array.isArray(resolved[key])) &&
    ["afterAttack", "afterMove", "afterAll"].every((key) => {
      const board = resolved[key];
      return record(board) && typeof board.placement === "string" && bank(board.ccLives) && Array.isArray(board.mines);
    }) &&
    ["ignoreAttacksOn", "events", "siegedThisTurn", "bMoves", "fMoves", "queue"]
      .every((key) => Array.isArray(value[key]));
};
const phaseEvent = (value: Record<string, unknown>): value is Record<string, unknown> & Extract<ChallengeProgress, { kind: "phase" }> =>
  value.kind === "phase" && typeof value.phase === "string" && value.phase.length > 0 &&
  ordinal(value.planningOrdinal) && ordinal(value.turn) && side(value.side);
const scfen = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try { parseScFen(value); return true; } catch { return false; }
};
const paired = (value: EndScTurnResult, scfen: string): boolean => {
  try { return formatScFen(normalizeSnapGas(value.next)) === scfen; } catch { return false; }
};
const stopKinds = new Set<ChallengeStop["kind"]>([
  "terminal", "queue-rejected", "trace-exhausted", "watchdog", "progress-limit", "exception", "script-contract",
]);

export const runSupervised = (
  request: ScheduledMatch,
  options: SupervisedOptions = {},
): Promise<ChallengeEvidence> => new Promise((resolve) => {
  let opening = request.opening;
  let initialBank: Bank = { w: 0, b: 0 };
  let initialTurn = 0;
  let openingError: string | undefined;
  try {
    const snapshot = parseScFen(request.opening);
    opening = formatScFen(normalizeSnapGas(snapshot));
    initialBank = seedBankForOpening(snapshot);
    initialTurn = snapshot.turn;
  } catch (error) {
    openingError = `invalid opening: ${String(error)}`;
  }
  const scfens = [opening];
  const resolves: EndScTurnResult[] = [];
  const bankTrail: Bank[] = [];
  let lastPhase: Extract<ChallengeProgress, { kind: "phase" }> = {
    kind: "phase", phase: "startup", planningOrdinal: 0, turn: initialTurn,
  };
  let child: ChildProcess | undefined;
  let ready = false;
  let messageCount = 0;
  let result: ChallengeEvidence | undefined;
  let startupTimer: NodeJS.Timeout | undefined;
  let matchTimer: NodeJS.Timeout | undefined;
  let planTimer: NodeJS.Timeout | undefined;
  const budgets = options.budgets ?? CHALLENGE_CONFIG;

  const clearTimers = () => {
    clearTimeout(startupTimer);
    clearTimeout(matchTimer);
    clearTimeout(planTimer);
    startupTimer = matchTimer = planTimer = undefined;
  };
  const failed = (kind: ChallengeStop["kind"], reason: string): ChallengeEvidence => ({
    match: request, policy: CHALLENGE_CONFIG.baselineVersion,
    modelArtifact: null, learnedGateEligible: false, fallbackCount: 0,
    scfens: [...scfens], resolves: [...resolves], bankTrail: [...bankTrail],
    finalBank: { ...(bankTrail.at(-1) ?? initialBank) }, outcome: null,
    stop: {
      kind, phase: lastPhase.phase, planningOrdinal: lastPhase.planningOrdinal,
      turn: lastPhase.turn, ...(lastPhase.side ? { side: lastPhase.side } : {}), reason,
    },
  });
  const finish = (evidence: ChallengeEvidence) => {
    if (result) return;
    result = evidence;
    clearTimers();
    if (!child) { resolve(evidence); return; }
    child.kill("SIGKILL");
  };
  const fail = (kind: ChallengeStop["kind"], reason: string) => finish(failed(kind, reason));
  const protocolError = (reason: string) => fail("script-contract", `worker protocol error: ${reason}`);

  const validCompletion = (value: unknown): value is ChallengeEvidence => {
    if (!record(value) || !record(value.match) || canonical(value.match) !== canonical(request) ||
        value.policy !== CHALLENGE_CONFIG.baselineVersion || value.modelArtifact !== null ||
        value.learnedGateEligible !== false || value.fallbackCount !== 0 ||
        !Array.isArray(value.scfens) || !value.scfens.every(scfen) ||
        !Array.isArray(value.resolves) || !value.resolves.every(resolveResult) ||
        !Array.isArray(value.bankTrail) || !value.bankTrail.every(bank) || !bank(value.finalBank) ||
        value.scfens.length !== value.resolves.length + 1 ||
        value.bankTrail.length !== value.resolves.length ||
        (value.scfens[0] !== opening && value.scfens[0] !== request.opening) ||
        value.resolves.length < resolves.length || !record(value.stop) ||
        !stopKinds.has(value.stop.kind as ChallengeStop["kind"]) ||
        !phaseEvent({ ...value.stop, kind: "phase" }) ||
        (value.stop.reason !== undefined && typeof value.stop.reason !== "string")) return false;
    if (value.outcome !== null && (!record(value.outcome) ||
        !((value.outcome.winner === null && value.outcome.draw === true) ||
          ((value.outcome.winner === "w" || value.outcome.winner === "b") &&
            (value.outcome.draw === false || value.outcome.draw === undefined))))) return false;
    if ((value.stop.kind === "terminal") !== (value.outcome !== null) || !executionIntegrity(value as ChallengeEvidence)) return false;
    if (value.bankTrail.length > 0 && canonical(value.finalBank) !== canonical(value.bankTrail.at(-1))) return false;
    const completedResolves = value.resolves;
    const completedScfens = value.scfens;
    const completedBanks = value.bankTrail;
    if (!completedResolves.every((entry, i) => paired(entry, completedScfens[i + 1]))) return false;
    return resolves.every((entry, i) => canonical(entry) === canonical(completedResolves[i]) &&
      scfens[i + 1] === completedScfens[i + 1] && canonical(bankTrail[i]) === canonical(completedBanks[i]));
  };

  const onMessage = (message: unknown) => {
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
        child!.send({ kind: "request", request }, (error) => {
          if (error) fail("exception", `worker request failed: ${error.message}`);
        });
        return;
      }
      if (!ready) { protocolError("message before ready"); return; }
      if (message.kind === "phase") {
        if (!phaseEvent(message)) { protocolError("malformed phase"); return; }
        const repeated = message.phase === lastPhase.phase &&
          message.planningOrdinal === lastPhase.planningOrdinal &&
          message.turn === lastPhase.turn && message.side === lastPhase.side;
        lastPhase = {
          kind: "phase", phase: message.phase, planningOrdinal: message.planningOrdinal,
          turn: message.turn, ...(message.side ? { side: message.side } : {}),
        };
        if (!repeated) {
          clearTimeout(planTimer);
          planTimer = undefined;
          if (message.phase === "candidate-plan" || message.phase === "strategic-plan") {
            planTimer = setTimeout(() => fail("watchdog", "plan timeout"), budgets.planMs);
          }
        }
        return;
      }
      if (message.kind === "ply") {
        if (resolves.length >= CHALLENGE_CONFIG.maxRecordedPlies) { protocolError("recorded ply limit exceeded"); return; }
        if (!scfen(message.scfen) || !resolveResult(message.resolve) || !bank(message.bank) ||
            !paired(message.resolve, message.scfen)) {
          protocolError("malformed ply"); return;
        }
        const prefix: ChallengeEvidence = {
          ...failed("trace-exhausted", "prefix validation"), scfens: [...scfens, message.scfen],
          resolves: [...resolves, message.resolve], bankTrail: [...bankTrail, message.bank], finalBank: message.bank,
        };
        if (!executionIntegrity(prefix)) { protocolError("invalid ply progression or resources"); return; }
        scfens.push(message.scfen);
        resolves.push(message.resolve);
        bankTrail.push(message.bank);
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
  const onDisconnect = () => fail("exception", "worker disconnected before completion");
  const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
    clearTimers();
    child!.removeListener("message", onMessage);
    child!.removeListener("error", onError);
    child!.removeListener("disconnect", onDisconnect);
    result ??= failed("exception", `worker exited before completion (code=${code}, signal=${signal})`);
    resolve(result);
  };

  if (openingError) { fail("exception", openingError); return; }
  if (![budgets.startupMs, budgets.planMs, budgets.matchMs]
    .every((ms) => Number.isFinite(ms) && ms > 0 && ms <= 2_147_483_647)) {
    fail("script-contract", "invalid watchdog budgets"); return;
  }
  startupTimer = setTimeout(() => fail("watchdog", "startup timeout"), budgets.startupMs);
  try {
    child = fork(fileURLToPath(options.workerUrl ?? new URL("./worker.ts", import.meta.url)), [], {
      execPath: process.execPath,
      execArgv: ["--import", createRequire(import.meta.url).resolve("tsx")],
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      serialization: "json",
    });
    child.on("message", onMessage);
    child.on("error", onError);
    child.on("disconnect", onDisconnect);
    child.once("close", onClose);
  } catch (error) {
    fail("exception", `worker launch failed: ${String(error)}`);
  }
});
