// SPEC: _spec/runtime-protocol.puml
import { NativeSession } from "../src/native-session";
import type { OwnedTransport, ExitReceipt } from "../src/native-session";
import { NativeWorker } from "../src/worker";
import { currentGameDriver } from "../src/current-driver";
import type { NativeMode, NativeReply, NativeRequest, NativeRole } from "../../contracts/src/native-protocol";

export const cleanExit = (): ExitReceipt => ({ stdinClosed: true, stdoutEof: true, stderrEof: true, reaped: true, exitCode: 0, forced: false });
export class SyntheticTransport implements OwnedTransport {
  readonly requests: NativeRequest[] = [];
  readonly worker: NativeWorker<ReturnType<typeof currentGameDriver.initialize>["state"]>;
  alter: ((reply: NativeReply, request: NativeRequest) => NativeReply) | null = null;
  delay: (() => Promise<void>) | null = null;
  receipt = cleanExit();
  terminated = 0;
  finished = 0;
  constructor(readonly role: NativeRole, mode: NativeMode, private readonly clockNs: () => bigint) {
    this.worker = new NativeWorker(role, mode, "synthetic-session", currentGameDriver);
  }
  async exchange(json: string) {
    const request: NativeRequest = JSON.parse(json);
    this.requests.push(request);
    if (this.delay) await this.delay();
    const reply: NativeReply = JSON.parse(this.worker.handle(json));
    return { json: JSON.stringify(this.alter ? this.alter(reply, request) : reply), receivedNs: this.clockNs() };
  }
  async finish(): Promise<ExitReceipt> { this.finished++; return this.receipt; }
  async terminate(): Promise<void> { this.terminated++; }
}
export function syntheticSession(mode: NativeMode = "native-proof") {
  let now = 0n;
  const clock = () => now;
  const main = new SyntheticTransport("main", mode, clock), reference = new SyntheticTransport("reference", mode, clock);
  const session = new NativeSession("synthetic-session", mode, main, reference, clock, 10_000_000_000n, 300_000_000_000n);
  return { main, reference, session, setTime: (value: bigint) => { now = value; } };
}
