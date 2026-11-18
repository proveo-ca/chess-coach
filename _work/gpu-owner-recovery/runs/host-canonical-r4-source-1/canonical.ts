// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { decodeNativeReply, decodeNativeRequest, MAX_NATIVE_MESSAGE_BYTES } from "../../../../packages/contracts/src/native-protocol";
import type { NativeBoundary, NativeRole } from "../../../../packages/contracts/src/native-protocol";
import { NativeJob } from "../../../../packages/runtime/src/job";
import type { NativeProofSession } from "../../../../packages/runtime/src/job";
import { NativeSession } from "../../../../packages/runtime/src/native-session";
import type { ExitReceipt, OwnedTransport } from "../../../../packages/runtime/src/native-session";
import { ProcessTransport } from "../../../../packages/runtime/src/process-transport";
import { boundaryDigest } from "../../../../packages/runtime/src/worker";

type Factory = (role: NativeRole, sessionId: string, clockNs: () => bigint) => OwnedTransport;
type Frame = { bytes: number; sha256: string };
type Exchange = { role: NativeRole; request: Frame; operation: string; ordinal: number; cursor: number; stagedCursor: number | null; requestDigest: string | null;
  reply?: Frame & { receivedNs: string; kind?: string; role?: NativeRole; ordinal?: number; cursor?: number; stagedCursor?: number | null; digest?: string | null }; error?: string };
type Lifecycle = { role: NativeRole; finish: ExitReceipt | null; finishError: string | null; terminateCalls: number; terminateError: string | null };
type Boundary = { boundary: NativeBoundary; digest: string; bytes: number; sha256: string };
type Receipt = { execution: "MOCK" | "REAL"; scope: "FIXED_NATIVE_PROOF_ONLY"; trainingExecuted: false; trainingReady: false;
  referenceInputDelivery: "REFERENCE_INPUT_DELIVERY_UNSELECTED"; independentReferenceQualified: false; hostProofQualified: false;
  phase: string; success: boolean; originNs: string | null; workDeadlineNs: string | null; cleanupDeadlineNs: string | null;
  boot: (Frame & { json: string }) | null; start: (Frame & { json: string }) | null; reply: (Frame & { json: string }) | null;
  exchanges: Exchange[]; boundaries: Boundary[]; lifecycle: Lifecycle[]; failures: { phase: string; message: string }[];
  cleanup: "NOT_REQUESTED" | "COMPLETE" | "FAILED" };

function frame(json: string): Frame { return { bytes: Buffer.byteLength(json), sha256: createHash("sha256").update(json).digest("hex") }; }
function message(error: unknown): string { return String(error).slice(0, 4096); }
function fixedPort(role: NativeRole, sessionId: string, clockNs: () => bigint): OwnedTransport {
  return new ProcessTransport({ executable: "/usr/local/bin/bun", cwd: "/app", arguments: [sessionId],
    entrypoint: role === "main" ? "/app/packages/runtime/src/game-worker.ts" : "/app/packages/runtime/src/reference-worker.ts" },
  { frameBytes: MAX_NATIVE_MESSAGE_BYTES, stdoutBytes: MAX_NATIVE_MESSAGE_BYTES, stderrBytes: 65536 }, clockNs);
}

export function createCanonicalProof(input: { sessionId: string; clockNs: () => bigint; createPort?: Factory }) {
  const { sessionId, clockNs, createPort } = input;
  if (createPort !== undefined && typeof createPort !== "function") throw new TypeError("Canonical proof: PORT_FACTORY");
  const { factory, execution } = createPort === undefined ? { factory: fixedPort, execution: "REAL" as const }
    : { factory: createPort, execution: "MOCK" as const };
  const record: Receipt = { execution, scope: "FIXED_NATIVE_PROOF_ONLY",
    trainingExecuted: false, trainingReady: false, referenceInputDelivery: "REFERENCE_INPUT_DELIVERY_UNSELECTED",
    independentReferenceQualified: false, hostProofQualified: false, phase: "boot", success: false,
    originNs: null, workDeadlineNs: null, cleanupDeadlineNs: null, boot: null, start: null, reply: null,
    exchanges: [], boundaries: [], lifecycle: [], failures: [], cleanup: "NOT_REQUESTED" };
  let origin: bigint | null = null;
  const clock = () => {
    const now = clockNs();
    if (origin === null) {
      origin = now;
      record.originNs = String(now);
      record.workDeadlineNs = String(now + 10_000_000_000n);
      record.cleanupDeadlineNs = String(now + 300_000_000_000n);
    }
    return now;
  };
  const owned: { port: OwnedTransport; lifecycle: Lifecycle; termination: Promise<void> | null }[] = [];
  function acquire(role: NativeRole, deadline: bigint): OwnedTransport {
    record.phase = `create:${role}`;
    if (clock() >= deadline) throw new Error("Canonical proof: ORIGINAL_WORK_DEADLINE");
    const port = factory(role, sessionId, clock);
    if (owned.some(entry => entry.port === port)) throw new Error("Canonical proof: SAME_UNDERLYING_PORT");
    const lifecycle: Lifecycle = { role, finish: null, finishError: null, terminateCalls: 0, terminateError: null };
    const entry = { port, lifecycle, termination: null as Promise<void> | null };
    owned.push(entry);
    record.lifecycle.push(lifecycle);
    if (clock() >= deadline) throw new Error("Canonical proof: ORIGINAL_WORK_DEADLINE");
    return {
      async exchange(json) {
        record.phase = `exchange:${role}`;
        const request = decodeNativeRequest(json);
        const item: Exchange = { role, request: frame(json), operation: request.operation, ordinal: request.ordinal, cursor: request.cursor,
          stagedCursor: request.operation === "commit" ? request.stagedCursor : null, requestDigest: request.operation === "commit" ? request.digest : null };
        record.exchanges.push(item);
        try {
          const raw = await port.exchange(json);
          item.reply = { ...frame(raw.json), receivedNs: String(raw.receivedNs) };
          const reply = decodeNativeReply(raw.json);
          Object.assign(item.reply, { kind: reply.kind, role: reply.role, ordinal: reply.ordinal, cursor: reply.cursor,
            stagedCursor: reply.kind === "staged" ? reply.stagedCursor : null,
            digest: reply.kind === "staged" ? boundaryDigest(reply.boundary) : reply.kind === "committed" ? reply.digest : null });
          return raw;
        } catch (error) { item.error = message(error); throw error; }
      },
      async finish() {
        record.phase = `finish:${role}`;
        try { const receipt = await port.finish(); lifecycle.finish = structuredClone(receipt); return receipt; }
        catch (error) { lifecycle.finishError = message(error); throw error; }
      },
      terminate: reason => terminate(entry, reason),
    };
  }
  function terminate(entry: typeof owned[number], reason: unknown): Promise<void> {
    if (entry.termination === null) {
      entry.lifecycle.terminateCalls++;
      entry.termination = Promise.resolve().then(() => entry.port.terminate(reason)).catch(error => {
        entry.lifecycle.terminateError = message(error); throw error;
      });
    }
    return entry.termination;
  }
  async function stopOwned(reason: unknown): Promise<void> {
    record.success = false;
    record.reply = null;
    if (record.failures.length < 32) record.failures.push({ phase: record.phase, message: message(reason) });
    record.phase = "cleanup";
    const cleanup = Promise.allSettled(owned.map(entry => terminate(entry, reason)));
    const deadline = (origin ?? 0n) + 300_000_000_000n;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const remaining = deadline - clock();
      if (remaining <= 0n) throw new Error("Canonical proof: ORIGINAL_CLEANUP_DEADLINE");
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Canonical proof: ORIGINAL_CLEANUP_DEADLINE")), Number((remaining + 999999n) / 1000000n));
      });
      const results = await Promise.race([cleanup, timeout]);
      if (clock() >= deadline) throw new Error("Canonical proof: ORIGINAL_CLEANUP_DEADLINE");
      const failures = results.flatMap(result => result.status === "rejected" ? [result.reason] : []);
      if (failures.length) throw new AggregateError(failures, "Canonical proof: CLEANUP_ERRORS");
      record.cleanup = "COMPLETE";
    } catch (error) {
      record.cleanup = "FAILED";
      if (record.failures.length < 32) record.failures.push({ phase: "cleanup", message: message(error) });
      throw error;
    } finally { if (timer !== undefined) clearTimeout(timer); record.phase = "failed"; }
  }
  const job = new NativeJob(sessionId, clock, (deadline, cleanup) => {
    const main = acquire("main", deadline), reference = acquire("reference", deadline);
    const delegate = new NativeSession(sessionId, "native-proof", main, reference, clock, deadline, cleanup);
    const capture = async (phase: string, action: () => Promise<NativeBoundary>) => {
      record.phase = phase;
      const boundary = await action();
      record.boundaries.push({ boundary: structuredClone(boundary), digest: boundaryDigest(boundary), ...frame(JSON.stringify(boundary)) });
      return boundary;
    };
    const session: NativeProofSession = {
      initialize: () => capture("initialize", () => delegate.initialize()),
      open: () => capture("open", () => delegate.open()),
      settle: plans => capture("settle", () => delegate.settle(plans)),
      close: async () => { record.phase = "close"; await delegate.close(); },
    };
    return session;
  }, stopOwned);
  return {
    boot() {
      const json = job.boot();
      record.boot = { json, ...frame(json) };
      return json;
    },
    async run(json: string) {
      record.start = { json: json.slice(0, 1048576), ...frame(json) };
      try {
        const reply = await job.run(json);
        record.reply = { json: reply, ...frame(reply) };
        record.success = true;
        record.phase = "complete";
        return reply;
      } catch (error) { record.success = false; record.reply = null; record.phase = "failed"; throw error; }
    },
    receipt: () => structuredClone(record),
  };
}
