// SPEC: _spec/runtime-protocol.puml
import type {} from "bun";
import type { ExitReceipt, OwnedTransport } from "./native-session";
import { jsonLines } from "./framing";

export type ProcessLimits = { frameBytes: number; stdoutBytes: number; stderrBytes: number };
export type FixedProcess = { executable: string; entrypoint: string; arguments: readonly string[]; cwd: string; runtime?: "bun" }
  | { executable: string; arguments: readonly string[]; cwd: string; runtime: "native" };
type Pending = { resolve: (value: { json: string; receivedNs: bigint }) => void; reject: (error: unknown) => void };

export class ProcessTransport implements OwnedTransport {
  private readonly child: Bun.Subprocess<"pipe", "pipe", "pipe">;
  private readonly stdoutTask: Promise<void>;
  private readonly stderrTask: Promise<void>;
  private pending: Pending | null = null;
  private fatal: unknown = null;
  private closeExpected = false;
  private stdinClosed = false;
  private stdoutEof = false;
  private stderrEof = false;
  private forced = false;
  private termination: Promise<void> | null = null;
  private readonly errors: Uint8Array[] = [];
  private readonly frameBytes: number;

  constructor(spec: FixedProcess, limits: ProcessLimits, clockNs: () => bigint) {
    const paths = [spec.executable, spec.cwd, ...(spec.runtime === "native" ? [] : [spec.entrypoint])];
    if (!paths.every(path => path.startsWith("/") && !path.includes("\0")) ||
      Object.values(limits).some(value => !Number.isSafeInteger(value) || value < 1) || limits.stdoutBytes < limits.frameBytes) throw new Error("Process transport: CONFIGURATION");
    this.frameBytes = limits.frameBytes;
    const command = spec.runtime === "native" ? [spec.executable, ...spec.arguments]
      : [spec.executable, "--no-env-file", "--no-install", spec.entrypoint, ...spec.arguments];
    this.child = Bun.spawn(command, { cwd: spec.cwd,
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", NODE_ENV: "production", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", RAYON_NUM_THREADS: "2" },
      stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    this.stdoutTask = this.readOutput(limits, clockNs).catch(error => { this.reject(error); });
    this.stderrTask = this.readErrors(limits.stderrBytes).catch(error => { this.reject(error); });
  }

  private reject(error: unknown): void {
    this.fatal ??= error;
    const pending = this.pending;
    this.pending = null;
    pending?.reject(this.fatal);
  }
  private async readOutput(limits: ProcessLimits, clockNs: () => bigint): Promise<void> {
    for await (const frame of jsonLines(this.child.stdout, limits.frameBytes, limits.stdoutBytes, clockNs, true)) {
      if (this.pending === null) throw new Error("Process transport: UNSOLICITED_OUTPUT");
      const pending = this.pending;
      this.pending = null;
      pending.resolve(frame);
    }
    if (!this.forced) this.stdoutEof = true;
    if (this.pending !== null || !this.closeExpected && !this.forced) throw new Error("Process transport: EARLY_EOF");
  }
  private async readErrors(maxBytes: number): Promise<void> {
    const reader = this.child.stderr.getReader();
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) { if (!this.forced) this.stderrEof = true; return; }
        size += value.byteLength;
        if (size > maxBytes) throw new Error("Process transport: STDERR_BOUND");
        this.errors.push(value.slice());
      }
    } finally { try { await reader.cancel(); } finally { reader.releaseLock(); } }
  }
  async exchange(json: string): Promise<{ json: string; receivedNs: bigint }> {
    if (this.fatal !== null) throw this.fatal;
    if (this.pending !== null || this.stdinClosed || this.closeExpected || this.forced) throw new Error("Process transport: CLOSED_OR_PENDING");
    if (json.length > this.frameBytes || Buffer.byteLength(json) > this.frameBytes) throw new Error("Process transport: INPUT_BOUND");
    const message = JSON.parse(json);
    this.closeExpected = message.operation === "close" || message.command?.kind === "close";
    const result = new Promise<{ json: string; receivedNs: bigint }>((resolve, reject) => { this.pending = { resolve, reject }; });
    try {
      const write = Promise.resolve().then(async () => { this.child.stdin.write(json + "\n"); await this.child.stdin.flush(); });
      const [, frame] = await Promise.all([write, result]);
      if (this.fatal !== null) throw this.fatal;
      return frame;
    } catch (error) { this.reject(error); throw error; }
  }
  async finish(): Promise<ExitReceipt> {
    if (!this.closeExpected || this.pending !== null) throw new Error("Process transport: CLOSE_PROTOCOL");
    if (!this.stdinClosed) { await this.child.stdin.end(); this.stdinClosed = true; }
    const [, , exitCode] = await Promise.all([this.stdoutTask, this.stderrTask, this.child.exited]);
    if (this.fatal !== null) throw this.fatal;
    return { stdinClosed: this.stdinClosed, stdoutEof: this.stdoutEof, stderrEof: this.stderrEof, reaped: true, exitCode, forced: this.forced };
  }
  stderr(): Uint8Array { return Buffer.concat(this.errors); }
  terminate(reason: unknown): Promise<void> {
    if (this.termination !== null) return this.termination;
    this.forced = true;
    this.reject(reason);
    this.termination = (async () => {
      if (this.child.exitCode === null) this.child.kill("SIGKILL");
      try { await this.child.stdin.end(); this.stdinClosed = true; } catch {}
      await this.child.exited;
      await Promise.allSettled([this.stdoutTask, this.stderrTask]);
    })();
    return this.termination;
  }
}
