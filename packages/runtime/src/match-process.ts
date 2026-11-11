// SPEC: _spec/match-runtime.puml
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { Readable } from "node:stream";
import { MAX_MATCH_COMPLETION_BYTES } from "../../contracts/src/match";
import type { ExitReceipt } from "./native-session";
import type { MatchCutoffReceipt, OwnedMatchTransport } from "./match-session";
import type { FixedProcess } from "./process-transport";
import { jsonLines } from "./framing";

type Frame = { json: string; receivedNs: bigint };
type Pending = { resolve(value: Frame): void; reject(error: unknown): void };
export class MatchProcess implements OwnedMatchTransport {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly exited: Promise<number | null>;
  private readonly output: Promise<void>;
  private readonly errors: Promise<void>;
  private pending: Pending | null = null;
  private frame: Frame | null = null;
  private fatal: unknown = null;
  private closing = false;
  private stopping = false;
  private stdinClosed = false;
  private stdoutEof = false;
  private stderrEof = false;
  private reaped = false;
  private exitCode: number | null = null;
  private stopTask: Promise<MatchCutoffReceipt> | null = null;
  private readonly stderrChunks: Uint8Array[] = [];

  constructor(spec: FixedProcess, private readonly clockNs: () => bigint, private readonly cleanupDeadlineNs: bigint) {
    const paths = [spec.executable, spec.cwd, ...(spec.runtime === "native" ? [] : [spec.entrypoint])];
    if (!paths.every(path => path.startsWith("/") && !path.includes("\0")) || cleanupDeadlineNs <= clockNs()) throw new Error("Match process: CONFIGURATION");
    const args = spec.runtime === "native" ? spec.arguments : ["--no-env-file", "--no-install", spec.entrypoint, ...spec.arguments];
    this.child = spawn(spec.executable, [...args], { cwd: spec.cwd, detached: true, stdio: ["pipe", "pipe", "pipe"],
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", NODE_ENV: "production", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", RAYON_NUM_THREADS: "2" } });
    this.exited = new Promise(resolve => {
      this.child.once("error", error => { this.reject(error); resolve(null); });
      this.child.once("exit", code => { this.reaped = true; this.exitCode = code; resolve(code); });
    });
    this.child.stdin.on("error", error => { if (!this.stopping) this.reject(error); });
    this.output = this.readOutput().catch(error => { this.reject(error); });
    this.errors = this.readErrors().catch(error => { this.reject(error); });
  }
  private reject(error: unknown): void {
    this.fatal ??= error;
    const pending = this.pending; this.pending = null;
    pending?.reject(error);
  }
  private async readOutput(): Promise<void> {
    const stream = Readable.toWeb(this.child.stdout) as unknown as ReadableStream<Uint8Array>;
    for await (const frame of jsonLines(stream, MAX_MATCH_COMPLETION_BYTES, 64 * 1024 * 1024, this.clockNs, true)) {
      if (this.pending === null) throw new Error("Match process: UNSOLICITED_OUTPUT");
      this.frame = frame;
      const pending = this.pending; this.pending = null;
      pending.resolve(frame);
    }
    this.stdoutEof = true;
    if (!this.stopping && (this.pending !== null || !this.closing)) throw new Error("Match process: EARLY_EOF");
  }
  private async readErrors(): Promise<void> {
    let bytes = 0;
    for await (const chunk of this.child.stderr) {
      const data = new Uint8Array(chunk);
      bytes += data.byteLength;
      if (bytes > 8 * 1024 * 1024) throw new Error("Match process: STDERR_BOUND");
      this.stderrChunks.push(data.slice());
    }
    this.stderrEof = true;
  }
  async exchange(json: string): Promise<Frame> {
    if (this.fatal !== null) throw this.fatal;
    if (this.pending !== null || this.closing || this.stopping || this.stdinClosed) throw new Error("Match process: CLOSED_OR_PENDING");
    if (Buffer.byteLength(json) > 1024 * 1024) throw new Error("Match process: INPUT_BOUND");
    this.closing = JSON.parse(json).operation === "close";
    this.frame = null;
    const reply = new Promise<Frame>((resolve, reject) => { this.pending = { resolve, reject }; });
    const write = new Promise<void>((resolve, reject) => { this.child.stdin.write(json + "\n", error => error ? reject(error) : resolve()); });
    try {
      const [, result] = await Promise.all([write, reply]);
      if (this.fatal !== null) throw this.fatal;
      return result;
    } catch (error) { if (!this.stopping) this.reject(error); throw error; }
  }
  private async endInput(): Promise<void> {
    if (this.stdinClosed) return;
    await new Promise<void>(resolve => {
      if (this.child.stdin.destroyed || this.child.stdin.writableFinished) resolve();
      else this.child.stdin.end(resolve);
    });
    this.stdinClosed = true;
  }
  private groupExists(): boolean {
    if (this.child.pid === undefined) throw new Error("Match process: MISSING_PID");
    try { process.kill(-this.child.pid, 0); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false; throw error; }
  }
  private async groupGone(): Promise<boolean> {
    while (this.groupExists()) {
      if (this.clockNs() >= this.cleanupDeadlineNs) return false;
      await new Promise<void>(resolve => setTimeout(resolve, 2));
    }
    return this.clockNs() < this.cleanupDeadlineNs;
  }
  private receipt(): ExitReceipt {
    return { stdinClosed: this.stdinClosed, stdoutEof: this.stdoutEof, stderrEof: this.stderrEof, reaped: this.reaped, exitCode: this.exitCode, forced: this.stopping };
  }
  async finish(): Promise<ExitReceipt> {
    if (!this.closing || this.pending !== null || this.stopping) throw new Error("Match process: CLOSE_PROTOCOL");
    await this.endInput();
    await Promise.all([this.exited, this.output, this.errors]);
    if (this.fatal !== null) throw this.fatal;
    if (!await this.groupGone()) throw new Error("Match process: GROUP_REMAINS");
    return this.receipt();
  }
  cutoff(reason: unknown): Promise<MatchCutoffReceipt> {
    if (this.stopTask !== null) return this.stopTask;
    this.stopping = true;
    this.stopTask = (async () => {
      const fault = this.fatal !== null;
      const pending = this.pending; this.pending = null; pending?.reject(reason);
      if (this.child.pid !== undefined) {
        try { process.kill(-this.child.pid, "SIGKILL"); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
      }
      await this.endInput();
      await Promise.all([this.exited, this.output, this.errors]);
      const groupGone = await this.groupGone();
      return { exit: this.receipt(), groupGone, fault: fault || this.fatal !== null, frame: this.frame };
    })();
    return this.stopTask;
  }
  async terminate(reason: unknown): Promise<void> {
    const result = await this.cutoff(reason);
    if (!result.exit.reaped || !result.groupGone) throw new Error("Match process: CLEANUP");
  }
  stderr(): Uint8Array { return Buffer.concat(this.stderrChunks); }
}
