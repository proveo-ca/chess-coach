// SPEC: _spec/runtime-protocol.puml, _spec/supervision.puml
import type {} from "bun";
import { z } from "zod";
import type { NativeBoundary } from "../../contracts/src/native-protocol";
import { MAX_NATIVE_MESSAGE_BYTES } from "../../contracts/src/native-protocol";
import { NativeSession } from "./native-session";
import { ProcessTransport } from "./process-transport";
import { boundaryDigest } from "./worker";
import { jsonLines } from "./framing";

const startShape = z.strictObject({ version: z.literal("chess-coach.job.v1"), sessionId: z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/), operation: z.literal("native-proof") });
export interface NativeProofSession {
  initialize(): Promise<NativeBoundary>;
  open(): Promise<NativeBoundary>;
  settle(plans: { w: []; b: [] }): Promise<NativeBoundary>;
  close(): Promise<void>;
}
export class NativeJob {
  private phase: "boot" | "running" | "complete" | "failed" = "boot";
  private readonly originNs: bigint;
  constructor(private readonly sessionId: string, private readonly clockNs: () => bigint,
    private readonly createSession: (workDeadlineNs: bigint, cleanupDeadlineNs: bigint) => NativeProofSession,
    private readonly stopOwned: (reason: unknown) => Promise<void>) {
    if (!/^[A-Za-z0-9._:-]{1,64}$/.test(sessionId)) throw new Error("Native job: SESSION");
    this.originNs = clockNs();
  }
  boot(): string {
    if (this.phase !== "boot") throw new Error("Native job: PHASE");
    return JSON.stringify({ version: "chess-coach.job.v1", sessionId: this.sessionId, kind: "boot" });
  }
  async run(json: string): Promise<string> {
    if (this.phase !== "boot") {
      this.phase = "failed";
      const error = new Error("Native job: NO_RETRY");
      await this.stopOwned(error);
      throw error;
    }
    this.phase = "running";
    try {
      if (Buffer.byteLength(json) > 1048576) throw new Error("Native job: FRAME_BOUND");
      const request = startShape.parse(JSON.parse(json));
      if (request.sessionId !== this.sessionId) throw new Error("Native job: SESSION");
      const deadline = this.originNs + 10_000_000_000n;
      if (this.clockNs() < this.originNs || this.clockNs() >= deadline) throw new Error("Native job: DEADLINE");
      const session = this.createSession(deadline, this.originNs + 300_000_000_000n);
      const boundaries = [await session.initialize(), await session.open(), await session.settle({ w: [], b: [] })];
      await session.close();
      if (this.clockNs() >= deadline || this.phase !== "running") throw new Error("Native job: DEADLINE_OR_REVOKED");
      const reply = JSON.stringify({ version: "chess-coach.job.v1", sessionId: this.sessionId, kind: "native-proof-complete", boundaries: boundaries.map(boundaryDigest) });
      this.phase = "complete";
      return reply;
    } catch (error) { this.phase = "failed"; await this.stopOwned(error); throw error; }
  }
}

async function main(): Promise<void> {
  if (process.argv.length !== 3) throw new Error("Native job: ARGUMENTS");
  const sessionId = process.argv[2], clock = process.hrtime.bigint, ports: ProcessTransport[] = [];
  const stop = async (reason: unknown) => {
    const result = await Promise.allSettled(ports.map(port => port.terminate(reason)));
    const failed = result.flatMap(value => value.status === "rejected" ? [value.reason] : []);
    if (failed.length) throw new AggregateError(failed, "Native job: CLEANUP");
  };
  const job = new NativeJob(sessionId!, clock, (deadline, cleanup) => {
    const limits = { frameBytes: MAX_NATIVE_MESSAGE_BYTES, stdoutBytes: MAX_NATIVE_MESSAGE_BYTES, stderrBytes: 65536 };
    const main = new ProcessTransport({ executable: "/usr/local/bin/bun", entrypoint: "/app/packages/runtime/src/game-worker.ts", arguments: [sessionId!], cwd: "/app" }, limits, clock);
    ports.push(main);
    const reference = new ProcessTransport({ executable: "/usr/local/bin/bun", entrypoint: "/app/packages/runtime/src/reference-worker.ts", arguments: [sessionId!], cwd: "/app" }, limits, clock);
    ports.push(reference);
    return new NativeSession(sessionId!, "native-proof", main, reference, clock, deadline, cleanup);
  }, stop);
  await Bun.write(Bun.stdout, job.boot() + "\n");
  let ran = false;
  try {
    for await (const frame of jsonLines(Bun.stdin.stream(), 1048576, 1048576, clock)) {
      if (ran) throw new Error("Native job: TRAILING_INPUT");
      const reply = await job.run(frame.json);
      ran = true;
      await Bun.write(Bun.stdout, reply + "\n");
    }
    if (!ran) throw new Error("Native job: MISSING_START");
  } catch (error) { await stop(error); throw error; }
}

if (import.meta.main) {
  try { await main(); }
  catch (error) { await Bun.write(Bun.stderr, String(error) + "\n"); process.exitCode = 1; }
}
