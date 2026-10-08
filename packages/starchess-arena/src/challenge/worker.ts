// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { createInterface } from "node:readline";
import { runChallengeMatch } from "./runChallengeMatch";
import type { CheckedStages, PlanPermit, ScheduledMatch } from "./types";
import { WORKER_PROTOCOL } from "./types";

const send = (message: unknown) => {
  process.stdout.write(`${JSON.stringify(message)}\n`, (error) => {
    if (error) process.exit(1);
  });
};

type ParentMessage = {
  version?: string; kind?: string; messageOrdinal?: number; matchKey?: string;
  permit?: PlanPermit; stop?: "terminal" | "trace-exhausted" | "progress-limit"; subject?: string;
  request?: ScheduledMatch;
};

const inbox: ParentMessage[] = [];
let waiter: ((message: ParentMessage) => void) | null = null;
const push = (message: ParentMessage) => {
  if (waiter) { const resolve = waiter; waiter = null; resolve(message); return; }
  inbox.push(message);
};
const nextParent = (): Promise<ParentMessage> => inbox.length
  ? Promise.resolve(inbox.shift()!)
  : new Promise((resolve) => { waiter = resolve; });

let requested = false;
createInterface({ input: process.stdin }).on("line", (line) => {
  let message: ParentMessage;
  try { message = JSON.parse(line) as ParentMessage; }
  catch { process.exit(1); return; }
  if (!requested) {
    if (message.version !== WORKER_PROTOCOL || message.kind !== "request" || message.messageOrdinal !== 0 || !message.request) {
      process.exit(1);
    }
    requested = true;
    void run(message.request);
    return;
  }
  push(message);
});

const run = async (request: ScheduledMatch) => {
  let childOrdinal = 0;
  let parentOrdinal = 1;
  const sendChild = (body: Record<string, unknown>) => send({
    version: WORKER_PROTOCOL, matchKey: request.key, messageOrdinal: childOrdinal++, ...body,
  });
  const take = async (): Promise<ParentMessage> => {
    const message = await nextParent();
    if (message.version !== WORKER_PROTOCOL || message.matchKey !== request.key || message.messageOrdinal !== parentOrdinal) {
      process.exit(1);
    }
    parentOrdinal += 1;
    return message;
  };
  const checked: CheckedStages = {
    async turnOpen(input) {
      sendChild({ kind: "turn-open", planningOrdinal: input.planningOrdinal, begin: input.begin, bank: input.bank });
      const reply = await take();
      if (reply.kind === "permit" && reply.permit) return { kind: "permit", permit: reply.permit };
      if (reply.kind === "halt" && (reply.stop === "terminal" || reply.stop === "trace-exhausted" || reply.stop === "progress-limit")) {
        return { kind: "halt", stop: reply.stop };
      }
      process.exit(1);
    },
    async decision(input) {
      sendChild({
        kind: "decision", permitId: input.permit.permitId, planningOrdinal: input.permit.planningOrdinal,
        side: input.permit.side, turn: input.permit.turn, role: input.permit.role,
        actions: input.actions, reportedMinSpend: input.reportedMinSpend,
      });
      const reply = await take();
      if (reply.kind === "permit" && reply.permit) return { kind: "permit", permit: reply.permit };
      if (reply.kind === "decisions-complete") return { kind: "decisions-complete" };
      process.exit(1);
    },
    async settlement(input) {
      sendChild({ kind: "settlement", planningOrdinal: input.planningOrdinal, resolve: input.end, bank: input.bank });
      const reply = await take();
      if (reply.kind !== "accepted" || reply.subject !== "settlement") process.exit(1);
    },
    async admissionFailure(input) {
      sendChild({ kind: "admission-failure", stop: input.stop, rejectedQueue: input.rejectedQueue });
      const reply = await take();
      if (reply.kind !== "accepted" || reply.subject !== "admission-failure") process.exit(1);
    },
  };
  try {
    const evidence = await runChallengeMatch(request, { checked });
    sendChild({ kind: "complete", evidence });
  } catch {
    process.exit(1);
  }
};

send({ kind: "ready" });
