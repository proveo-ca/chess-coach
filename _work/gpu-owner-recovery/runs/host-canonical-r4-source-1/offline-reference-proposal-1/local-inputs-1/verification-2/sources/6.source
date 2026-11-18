// SPEC: _spec/recovery.md
import { createHash } from "node:crypto";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const work = resolve(root, "_work/gpu-owner-recovery");
const outputBound = 4 * 1024 * 1024;
const commands: Record<string, string[]> = {
  runner: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/verify.test.ts", "./_work/gpu-owner-recovery/audit-lock.test.ts"],
  "cuda-isolation": [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/cuda-isolation.test.ts"],
  "cuda-acquire": [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/cuda-continuation.test.ts", "./_work/gpu-owner-recovery/cuda-acquire.test.ts"],
  "cuda-archive": [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/cuda-tar.test.ts", "./_work/gpu-owner-recovery/cuda-elf.test.ts", "./_work/gpu-owner-recovery/cuda-archive.test.ts"],
  "cuda-bun-snapshot": [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/cuda-bun-snapshot.test.ts"],
  "cuda-bun-compatibility": [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/cuda-bun-compatibility-fixture.test.ts", "./_work/gpu-owner-recovery/cuda-bun-compatibility.test.ts"],
  "typecheck-source": [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "tsconfig.json"],
  "typecheck-tests": [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "tsconfig.tests.json"],
  "typecheck-tools": [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "_work/gpu-owner-recovery/tsconfig.json"],
  policy: [process.execPath, "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-policy.test.ts", "./packages/runtime/tests/gpu-policy-conformance.test.ts"],
  bridge: [process.execPath, "--no-env-file", "--no-install", "test", "./packages/contracts/tests/gpu-job.test.ts", "./packages/runtime/tests/gpu-job.test.ts", "./packages/runtime/tests/fixed-attempt-gpu-owner.test.ts"],
  "reference-guards": [process.execPath, "--no-env-file", "--no-install", "test", "./packages/runtime/tests/reference-bundles.test.ts", "--test-name-pattern", "reference source guard"],
  "review-ts": [process.execPath, "--no-env-file", "--no-install", "_work/gpu-owner-recovery/review-packet.ts"],
  "review-rust": [process.execPath, "--no-env-file", "--no-install", "_work/gpu-owner-recovery/review-packet.ts", "rust"],
};
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export type CommandResult = { status: "PASS" | "FAIL"; exitCode: number; failure: string | null; stdoutBytes: number; stderrBytes: number };

export function verificationArgv(stage: string): string[] {
  const argv = commands[stage];
  if (!argv) throw Error("CLOSED_STAGE_REQUIRED");
  return [...argv];
}

export async function sourceFilePaths(stage: string): Promise<string[]> {
  if (!commands[stage]) throw Error("CLOSED_STAGE_REQUIRED");
  const paths = new Set<string>();
  const patterns = ["runner", "typecheck-tools", "cuda-isolation", "cuda-acquire", "cuda-archive", "cuda-bun-snapshot", "cuda-bun-compatibility"].includes(stage) ? ["_work/gpu-owner-recovery/*.ts", "_work/gpu-owner-recovery/*.toml", "_work/gpu-owner-recovery/tsconfig.json", "tsconfig.json", "_work/gpu-owner-recovery/cuda-llvm-request.json", "_work/gpu-owner-recovery/cuda-isolation-reviewed-v3.json", "_work/gpu-owner-recovery/cuda-isolation-probe-3-classification.json", "_work/gpu-owner-recovery/runs/cuda-isolation-probe-3/*.{json,stdout,stderr}", "_work/gpu-owner-recovery/fixtures/cuda-tar-cases.json", "_work/gpu-owner-recovery/runs/cuda-llvm-acquire-1/**/*.{json,stdout,stderr,source}", "_work/gpu-owner-recovery/runs/cuda-llvm-acquire-1/archive/.operation", "_work/gpu-owner-recovery/runs/cuda-llvm-acquire-1/checksums/.operation", "_work/gpu-owner-recovery/runs/cuda-archive-plan-1/**/*.{json,stdout,stderr,source}", "_work/gpu-owner-recovery/runs/cuda-bun-snapshot-1/**/*.{json,source}", "_work/gpu-owner-recovery/runs/cuda-archive-audit-2/**/*.{json,stdout,stderr,source}", "_work/gpu-owner-recovery/runs/cuda-archive-v2-plan-1/*.{json,stdout,stderr}", "tooling/reference-entrypoints.json"] :
    ["package.json", "bun.lock", "tsconfig*.json", "packages/*/src/**/*.ts", "packages/*/tests/**/*.{ts,json}", "tooling/**/*.ts", "tooling/**/*.json", "schemas/**/*.json", "_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts", ...(stage.startsWith("review-") ? ["_work/gpu-owner-recovery/review-packet.ts"] : []), ...(stage === "review-rust" ? ["Cargo.toml", "Cargo.lock", "crates/gpu-owner/**/*.{rs,ts,toml}"] : [])];
  for (const pattern of patterns) for await (const path of new Bun.Glob(pattern).scan({ cwd: root, onlyFiles: true })) paths.add(path);
  if (["runner", "typecheck-tools", "cuda-isolation", "cuda-acquire", "cuda-archive", "cuda-bun-snapshot", "cuda-bun-compatibility"].includes(stage)) {
    for (const path of ["cuda-acquire-reviewed.json", "cuda-archive-reviewed.json", "cuda-archive-plan-1-classification.json", "cuda-bun-snapshot-reviewed.json",
      "runs/cuda-bun-snapshot-1/command.stdout", "runs/cuda-bun-snapshot-1/command.stderr", "runs/cuda-bun-snapshot-1/.operation",
      "cuda-bun-compatibility-request.json", "fixtures/cuda-bun-compatibility.json", "cuda-archive-reviewed-v2.json",
      "cuda-archive-audit-2-classification.json", "runs/cuda-archive-audit-2/.operation",
      "runs/cuda-bun-compatibility-1/llvm-request-halted.json"]) paths.add(`_work/gpu-owner-recovery/${path}`);
  }
  return [...paths].sort();
}

export async function runBounded(argv: string[], directory: string, timeoutMs: number, options: { cwd?: string; environment?: Record<string, string> } = {}): Promise<CommandResult> {
  if (resolve(directory) !== directory || !directory.startsWith(work + "/") || !argv.length || timeoutMs <= 0) throw Error("RECOVERY_RUN_CONTEXT");
  const stdout = await open(resolve(directory, "command.stdout"), "wx", 0o600);
  const stderr = await open(resolve(directory, "command.stderr"), "wx", 0o600);
  const deadline = performance.now() + timeoutMs;
  let child: ReturnType<typeof Bun.spawn> | undefined, failure: string | null = null, reaped = false, commandFinished = false, shutdownInitiated = false;
  let finishCommand!: (code: number) => void;
  const commandExit = new Promise<number>(resolve => { finishCommand = resolve; });
  const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];
  const killGroup = () => {
    if (child && !reaped) {
      shutdownInitiated = true;
      try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
    }
  };
  const stop = (reason: string) => {
    failure ??= reason;
    killGroup();
    if (reaped) for (const reader of readers) void reader.cancel().catch(() => {});
  };
  const environment = options.environment ?? { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(work, "scratch/home"), TMPDIR: resolve(work, "scratch/tmp"),
    LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", MISE_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false", RAYON_NUM_THREADS: "2" };
  const timer = setTimeout(() => stop("COMMAND_DEADLINE"), timeoutMs);
  let stdoutBytes = 0, stderrBytes = 0, exitCode = -1;
  const drain = async (stream: ReadableStream<Uint8Array>, file: Awaited<ReturnType<typeof open>>, account: (bytes: number) => number) => {
    const reader = stream.getReader(); readers.push(reader);
    try {
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        if (performance.now() >= deadline) stop("COMMAND_DEADLINE");
        const previous = account(chunk.byteLength), keep = Math.max(0, Math.min(chunk.byteLength, outputBound - previous));
        if (keep) await file.writeFile(chunk.subarray(0, keep));
        if (keep < chunk.byteLength) stop("COMMAND_OUTPUT_BOUND");
      }
    } finally { reader.releaseLock(); }
  };
  try {
    child = Bun.spawn([process.execPath, "--no-env-file", "--no-install", resolve(work, "command-supervisor.ts")], {
      cwd: root, env: environment, stdin: "ignore", stdout: "pipe", stderr: "pipe", detached: true,
      ipc(message: unknown) {
        const frame = message as { kind?: unknown; exitCode?: unknown; failure?: unknown } | null;
        if (commandFinished || !frame || frame.kind !== "command-exit" || !Number.isInteger(frame.exitCode) || (frame.failure !== null && typeof frame.failure !== "string")) {
          stop("COMMAND_SUPERVISOR_PROTOCOL"); return;
        }
        commandFinished = true;
        if (typeof frame.failure === "string") failure ??= frame.failure;
        finishCommand(frame.exitCode as number);
      },
    });
    const exit = child.exited.then(code => {
      reaped = true;
      if (!shutdownInitiated || !commandFinished) { stop("COMMAND_SUPERVISOR_EXIT"); finishCommand(-1); }
      return code;
    });
    child.send({ argv, cwd: options.cwd ?? root, environment });
    const tasks = [drain(child.stdout as ReadableStream<Uint8Array>, stdout, bytes => { const before = stdoutBytes; stdoutBytes += bytes; return before; }),
      drain(child.stderr as ReadableStream<Uint8Array>, stderr, bytes => { const before = stderrBytes; stderrBytes += bytes; return before; })];
    await Promise.all(tasks.map(task => task.catch(error => stop(String(error)))));
    exitCode = await commandExit;
    killGroup();
    await exit;
    if (performance.now() >= deadline) stop("COMMAND_DEADLINE");
    await stdout.sync(); await stderr.sync();
    if (performance.now() >= deadline) stop("COMMAND_DEADLINE");
  } catch (error) { stop(String(error)); if (child) { exitCode = await child.exited; reaped = true; } }
  finally { clearTimeout(timer); await stdout.close(); await stderr.close(); }
  return { status: exitCode === 0 && failure === null ? "PASS" : "FAIL", exitCode, failure, stdoutBytes, stderrBytes };
}

async function main() {
  const [stage, label] = Bun.argv.slice(2);
  if (Bun.argv.length !== 4 || !commands[stage!] || !/^[a-z0-9-]{1,48}$/.test(label ?? "")) throw Error("CLOSED_STAGE_AND_UNIQUE_LABEL_REQUIRED");
  const project = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  if (project.name !== "chess-coach" || resolve(process.cwd()) !== resolve(root)) throw Error("REPOSITORY_ROOT_REQUIRED");
  await mkdir(resolve(work, "scratch/home"), { recursive: true, mode: 0o700 });
  await mkdir(resolve(work, "scratch/tmp"), { recursive: true, mode: 0o700 });
  await mkdir(resolve(work, "runs"), { recursive: true, mode: 0o700 });
  const directory = resolve(work, "runs", label!);
  await mkdir(directory, { mode: 0o700 });
  const manifest = await Promise.all((await sourceFilePaths(stage!)).map(async path => ({ path, sha256: digest(await readFile(resolve(root, path))) })));
  const sourceManifestJson = JSON.stringify(manifest, null, 2) + "\n";
  await writeFile(resolve(directory, "sources.json"), sourceManifestJson, { flag: "wx", mode: 0o600 });
  const argv = verificationArgv(stage!), result = await runBounded(argv, directory, 600_000);
  const changed = (await Promise.all(manifest.map(async entry => digest(await readFile(resolve(root, entry.path))) !== entry.sha256))).some(Boolean);
  if (changed) { result.status = "FAIL"; result.failure ??= "SOURCE_CHANGED_DURING_VERIFICATION"; }
  const receipt = { version: "chess-coach.recovery-receipt.v1", runId: label, stage, sourceManifestSha256: digest(Buffer.from(sourceManifestJson)), argv,
    ...result, stdout: { path: relative(root, resolve(directory, "command.stdout")), bytes: result.stdoutBytes, sha256: digest(await readFile(resolve(directory, "command.stdout"))) },
    stderr: { path: relative(root, resolve(directory, "command.stderr")), bytes: result.stderrBytes, sha256: digest(await readFile(resolve(directory, "command.stderr"))) },
    sourceCount: manifest.length, sourceChanged: changed, bunVersion: Bun.version, actualHostExecuted: false, cudaGpuCodeExecuted: false, trainingReady: false };
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ receipt: relative(root, resolve(directory, "receipt.json")), status: result.status, trainingReady: false }));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (import.meta.main) await main();
