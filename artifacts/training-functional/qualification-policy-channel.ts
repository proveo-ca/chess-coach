#!/usr/local/bin/bun
// SPEC: _spec/runtime-protocol.puml
import { constants } from "node:os";

export const NATIVE_EXECUTABLE = "/opt/retained-gpu/policy-channel";
export const ARGUMENT_COUNT = 3;
export const ABORT_GRACE_MS = 1000;
export const FIXED_ENV = Object.freeze({
  PATH: "/usr/local/cuda/bin:/usr/local/bin:/usr/bin:/bin", HOME: "/scratch/home", XDG_DATA_HOME: "/opt/tracel-data", TMPDIR: "/tmp",
  LD_LIBRARY_PATH: "/usr/local/cuda/lib64:/usr/lib/x86_64-linux-gnu:/usr/local/nvidia/lib64:/usr/local/nvidia/lib",
  CUDA_PATH: "/usr/local/cuda", RAYON_NUM_THREADS: "2", CUDA_CACHE_PATH: "/scratch/home/cuda-cache",
});
export type AbortSignal = "SIGINT" | "SIGTERM";
export type AdapterChild = { exited: Promise<number>; readonly signalCode: string | null; kill(signal: AbortSignal | "SIGKILL"): void };
export type AdapterIO = {
  args: readonly string[];
  spawn(command: string[], options: { env: typeof FIXED_ENV; stdin: "inherit"; stdout: "inherit"; stderr: "inherit" }): AdapterChild;
  nowMs(): number;
  schedule(ms: number, callback: () => void): () => void;
  onSignal(signal: AbortSignal, callback: () => void): () => void;
};

export function signalExitCode(signal: string): number {
  const number = (constants.signals as Record<string, number>)[signal];
  return Number.isInteger(number) && number > 0 && number < 128 ? 128 + number : 1;
}

export async function runAdapter(io: AdapterIO): Promise<number> {
  if (io.args.length !== ARGUMENT_COUNT || io.args.some(arg => typeof arg !== "string" || arg.includes("\0"))) return 2;
  let child: AdapterChild | null = null, settled = false, abortCode: number | null = null;
  let cancelGrace: (() => void) | undefined;
  const remove: (() => void)[] = [], forwarded = new Set<AbortSignal>();
  let expire!: (code: number) => void;
  const expired = new Promise<number>(resolve => { expire = resolve; });
  const kill = (signal: AbortSignal | "SIGKILL"): void => { if (child !== null && !settled) { try { child.kill(signal); } catch {} } };
  const abort = (signal: AbortSignal): void => {
    if (abortCode === null) {
      abortCode = signalExitCode(signal);
      try {
        const cutoff = io.nowMs() + ABORT_GRACE_MS;
        cancelGrace = io.schedule(Math.max(0, Math.min(ABORT_GRACE_MS, cutoff - io.nowMs())), () => { kill("SIGKILL"); expire(abortCode!); });
      } catch { kill("SIGKILL"); expire(abortCode); }
    }
    if (!forwarded.has(signal)) { forwarded.add(signal); kill(signal); }
  };
  try {
    for (const signal of ["SIGINT", "SIGTERM"] as const) remove.push(io.onSignal(signal, () => abort(signal)));
    if (abortCode !== null) return abortCode;
    child = io.spawn([NATIVE_EXECUTABLE, ...io.args], { env: FIXED_ENV, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    for (const signal of forwarded) kill(signal);
    const active = child;
    const exited = active.exited.then(code => {
      settled = true;
      return active.signalCode !== null ? signalExitCode(active.signalCode) : Number.isInteger(code) && code >= 0 && code <= 255 ? code : 1;
    }, () => { settled = true; return 1; });
    const code = await Promise.race([exited, expired]);
    return abortCode ?? code;
  } catch { kill("SIGKILL"); return abortCode ?? 1; }
  finally {
    cancelGrace?.();
    for (const cleanup of remove.reverse()) cleanup();
  }
}

if (import.meta.main) {
  const code = await runAdapter({
    args: Bun.argv.slice(2), spawn: (command, options) => Bun.spawn(command, options), nowMs: () => performance.now(),
    schedule: (ms, callback) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); },
    onSignal: (signal, callback) => { process.on(signal, callback); return () => { process.off(signal, callback); }; },
  });
  process.exit(code);
}
