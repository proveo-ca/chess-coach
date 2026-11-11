// SPEC: _spec/gpu-qualification.puml
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBounded } from "../../_work/gpu-owner-recovery/verify";

export type Mode = "cpu" | "gpu";
export type Campaign = "regression" | "feasibility" | "full";
type Artifact = { executable: string; count: number };
type TestStep = Artifact & { id: string; selector?: string };
export type Limits = { perTestMs: number; totalMs: number; cleanupReserveMs: number };
type StepResult = { status: string; exitCode: number; failure: string | null; stdout: string };
type Stream = { path: string; bytes: number; sha256: string };
type Attempt = { id: string; argv: string[]; timeoutMs: number; attempted: boolean; status: string; exitCode?: number; failure?: string | null; streams?: Stream[] };
const workspace = "/build/native";
const packages = { learning: "chess-coach-learning", "policy-io": "chess-coach-policy-io" } as const;
export const gpuSelectors = [
  "cuda_f64_nonzero_native_scores_round_trip",
  "cuda_f64_direct_sgd_changes_policy_parameters",
  "cuda_feature_complete_sweep_for_active_relu_checks_2335_coordinates",
  "cuda_feature_complete_sweep_for_inactive_relu_checks_2335_coordinates",
  "cuda_f64_redundant_learning_channels_agree_and_reload",
  "cuda_f64_policy_channel_subprocesses_agree_and_reload",
] as const;
export const cpuCoverage: Record<string, number> = {
  "learning:lib:chess_coach_learning": 0, "learning:test:accumulation": 6, "learning:test:context": 1,
  "learning:test:episode": 6, "learning:test:finite_difference": 2, "learning:test:initialization": 1, "learning:test:model": 6,
  "policy-io:lib:chess_coach_policy_io": 1, "policy-io:bin:policy-channel": 0, "policy-io:bin:policy-initialize": 0, "policy-io:bin:policy-score": 0,
  "policy-io:test:channel": 4, "policy-io:test:f32": 1, "policy-io:test:gpu": 0, "policy-io:test:initialize": 2, "policy-io:test:score": 9,
};
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export function validateHostApproval(value: unknown, imageMode: string | undefined, label: string) {
  const approval = value as { version?: string; hostExecutionApproved?: boolean; mode: Mode; campaign: Campaign; maximumCampaignInvocations?: number;
    runId?: string; sourceManifestSha256?: string; limits: Limits } | null;
  if (!approval || approval.version !== "chess-coach.host-qualification-approval.v1" || approval.hostExecutionApproved !== true
    || !["cpu", "gpu"].includes(approval.mode) || imageMode !== approval.mode || approval.maximumCampaignInvocations !== 1 || approval.runId !== label) {
    throw Error("FRESH_HOST_APPROVAL_REQUIRED");
  }
  return approval;
}

export async function recordAttempt(attempts: Attempt[], id: string, argv: string[], timeoutMs: number, io: {
  execute(): Promise<Omit<StepResult, "stdout">>; capture(): Promise<{ stdout: string; streams: Stream[] }>;
}) {
  const attempt: Attempt = { id, argv, timeoutMs, attempted: true, status: "STARTED" };
  attempts.push(attempt);
  try {
    const result = await io.execute();
    Object.assign(attempt, result);
    const captured = await io.capture();
    attempt.streams = captured.streams;
    return { ...result, stdout: captured.stdout };
  } catch (error) {
    attempt.status = "FAIL";
    attempt.failure = String(error);
    throw error;
  }
}

export function readArtifacts(logs: Record<keyof typeof packages, string>, mode: Mode) {
  const artifacts = new Map<string, Artifact>();
  const binaries = new Map<string, string>();
  const prefix = `${workspace}/target-${mode}/x86_64-unknown-linux-gnu/release/`;
  for (const [owner, log] of Object.entries(logs)) {
    const messages = log.trim().split("\n").map(line => JSON.parse(line));
    const finished = messages.filter(message => message.reason === "build-finished");
    if (finished.length !== 1 || finished[0].success !== true || messages.at(-1)?.reason !== "build-finished") throw Error("SUCCESSFUL_CARGO_BUILD_REQUIRED");
    for (const message of messages) {
      if (message.reason !== "compiler-artifact" || message.executable === null || message.executable === undefined) continue;
      const pkg = Object.entries(packages).find(([directory, name]) => message.package_id === `path+file://${workspace}/crates/${directory}#${name}@0.1.0`);
      if (!pkg) continue;
      if (typeof message.executable !== "string" || resolve(message.executable) !== message.executable || !message.executable.startsWith(prefix)) throw Error("MODE_SPECIFIC_EXECUTABLE_REQUIRED");
      const features: unknown = message.features;
      if (!Array.isArray(features) || features.some(feature => typeof feature !== "string")
        || (mode === "gpu" ? !features.includes("gpu-cuda") || !features.includes("gpu-prepared-llvm") : features.some(feature => feature !== "default"))) throw Error("ARTIFACT_FEATURE_MISMATCH");
      const target = message.target;
      if (!target || typeof target.name !== "string" || !Array.isArray(target.kind) || target.kind.length !== 1) throw Error("ARTIFACT_TARGET_REQUIRED");
      if (message.profile?.test !== true) {
        if (pkg[0] === "policy-io" && target.kind[0] === "bin") {
          if (binaries.has(target.name)) throw Error("DUPLICATE_BINARY");
          binaries.set(target.name, message.executable);
        }
        continue;
      }
      if (pkg[0] !== owner) throw Error("HARNESS_LOG_OWNER_MISMATCH");
      const id = `${pkg[0]}:${target.kind[0]}:${target.name}`;
      const expected = mode === "cpu" ? cpuCoverage[id] : ({ "learning:test:finite_difference": 1, "policy-io:test:gpu": 1 } as Record<string, number>)[id];
      if (expected === undefined || artifacts.has(id)) throw Error("UNEXPECTED_OR_DUPLICATE_HARNESS");
      artifacts.set(id, { executable: message.executable, count: expected });
    }
  }
  const expected = mode === "cpu" ? Object.keys(cpuCoverage) : ["learning:test:finite_difference", "policy-io:test:gpu"];
  if (artifacts.size !== expected.length || expected.some(id => !artifacts.has(id))) throw Error("MISSING_HARNESS_COVERAGE");
  for (const name of ["policy-score", "policy-channel", "policy-initialize"]) {
    if (binaries.get(name) !== `${prefix}${name}`) throw Error("COMPILED_SUBPROCESS_PATH_REQUIRED");
  }
  return { artifacts, binaries };
}

export function qualificationPlan(mode: Mode, campaign: Campaign, artifacts: Map<string, Artifact>): TestStep[] {
  if (mode === "cpu" && campaign === "regression") return Object.keys(cpuCoverage).map(id => {
    const artifact = artifacts.get(id);
    if (!artifact) throw Error("MISSING_HARNESS_COVERAGE");
    return { id, ...artifact };
  });
  if (mode !== "gpu" || !["feasibility", "full"].includes(campaign)) throw Error("MODE_CAMPAIGN_MISMATCH");
  return gpuSelectors.slice(0, campaign === "feasibility" ? 2 : 6).map(selector => {
    const key = selector.startsWith("cuda_feature_") ? "learning:test:finite_difference" : "policy-io:test:gpu";
    const artifact = artifacts.get(key);
    if (!artifact) throw Error("MISSING_HARNESS_COVERAGE");
    return { id: selector, executable: artifact.executable, selector, count: 1 };
  });
}

export function validateLimits(limits: Limits, steps: number) {
  if (![limits.perTestMs, limits.totalMs, limits.cleanupReserveMs].every(value => Number.isSafeInteger(value) && value > 0)
    || limits.totalMs < steps * limits.perTestMs + limits.cleanupReserveMs) throw Error("EXPLICIT_COMPLETE_CAMPAIGN_BUDGET_REQUIRED");
}

export function testPassed(result: StepResult, expected: number) {
  const summaries = [...result.stdout.matchAll(/^test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored;.*$/gm)];
  return result.status === "PASS" && result.exitCode === 0 && result.failure === null && summaries.length === 1
    && Number(summaries[0]![1]) === expected && Number(summaries[0]![2]) === 0 && Number(summaries[0]![3]) === 0;
}

export async function executeQualification(plan: TestStep[], limits: Limits, io: {
  now(): number; run(step: TestStep, argv: string[], deadlineMs: number): Promise<StepResult>;
}) {
  validateLimits(limits, plan.length);
  const deadline = io.now() + limits.totalMs;
  const results = [];
  for (const step of plan) {
    const remaining = deadline - io.now() - limits.cleanupReserveMs;
    if (remaining <= 0) return { status: "FAIL_CAMPAIGN_DEADLINE", results };
    const argv = [step.executable, ...(step.selector ? [step.selector, "--exact", "--ignored"] : []), "--test-threads=1", "--nocapture", "--color=never"];
    const result = await io.run(step, argv, Math.min(limits.perTestMs, remaining));
    const accepted = testPassed(result, step.count);
    results.push({ id: step.id, ...result, accepted });
    if (!accepted) return { status: "FAIL_TEST", results };
  }
  return { status: io.now() <= deadline - limits.cleanupReserveMs ? "PASS_TESTS_ONLY" : "FAIL_CAMPAIGN_DEADLINE", results };
}

export async function sourceInputPaths(root: string) {
  const paths = new Set(["Cargo.toml", "Cargo.lock", "schemas/feature-layout.json", "tooling/runtime/qualification.ts", "tooling/runtime/Dockerfile.gpu-qualification",
    "tooling/runtime/gpu-build-inputs.json", "_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts"]);
  for (const pattern of ["crates/*/Cargo.toml", "crates/**/*.rs"]) for await (const path of new Bun.Glob(pattern).scan({ cwd: root, onlyFiles: true })) paths.add(path);
  return [...paths].sort();
}

export async function sourceInventory(root: string) {
  return Promise.all((await sourceInputPaths(root)).map(async path => ({ path, sha256: hash(await readFile(resolve(root, path))) })));
}

async function main() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const [approvalPath, label] = Bun.argv.slice(2);
  if (root !== workspace + "/" || Bun.argv.length !== 4 || !/^qualification-[a-z0-9-]{1,48}$/.test(label ?? "")) throw Error("HOST_QUALIFICATION_CONTEXT_REQUIRED");
  const approvalBytes = await readFile(approvalPath!);
  const approval = validateHostApproval(JSON.parse(approvalBytes.toString()), process.env.QUALIFICATION_IMAGE_MODE, label!);
  const mode: Mode = approval.mode, campaign: Campaign = approval.campaign;
  const directory = resolve(root, "_work/gpu-owner-recovery/runs", label!);
  await mkdir(directory);
  const results: Attempt[] = [];
  let status = "FAIL_PREFLIGHT", failure: string | null = null;
  let sourceManifestSha256: string | null = null;
  let sourceChanged = false;
  let inventory: Awaited<ReturnType<typeof sourceInventory>> = [];
  const artifacts: { path: string; sha256: string }[] = [];
  try {
    const sourceBytes = await readFile(resolve(root, "qualification/source-manifest.json"));
    sourceManifestSha256 = hash(sourceBytes);
    inventory = await sourceInventory(root);
    if (approval.sourceManifestSha256 !== sourceManifestSha256 || JSON.stringify(JSON.parse(sourceBytes.toString())) !== JSON.stringify(inventory)) throw Error("SOURCE_GENERATION_MISMATCH");
    const logs = { learning: await readFile(resolve(root, `qualification/${mode}-learning.stdout`), "utf8"),
      "policy-io": await readFile(resolve(root, `qualification/${mode}-policy.stdout`), "utf8") };
    const selected = readArtifacts(logs, mode);
    const plan = qualificationPlan(mode, campaign, selected.artifacts);
    validateLimits(approval.limits, plan.length);
    for (const path of new Set([...plan.map(step => step.executable), ...selected.binaries.values()])) {
      await access(path, constants.X_OK);
      artifacts.push({ path, sha256: hash(await readFile(path)) });
    }
    await writeFile(resolve(directory, "approval.json"), approvalBytes, { flag: "wx" });
    await writeFile(resolve(directory, "sources.json"), sourceBytes, { flag: "wx" });
    const environment: Record<string, string> = { PATH: "/usr/local/bin:/usr/bin:/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC",
      HOME: resolve(root, "_work/gpu-owner-recovery/scratch/home"), TMPDIR: resolve(root, "_work/gpu-owner-recovery/scratch/tmp"), RAYON_NUM_THREADS: "2", RUST_TEST_THREADS: "1" };
    if (mode === "gpu") environment.CUDA_PATH = "/usr/local/cuda";
    for (const name of ["LD_LIBRARY_PATH", "NVIDIA_VISIBLE_DEVICES", "CUDA_VISIBLE_DEVICES"]) if (process.env[name] !== undefined) environment[name] = process.env[name]!;
    const outcome = await executeQualification(plan, approval.limits, { now: () => performance.now(), run: async (step, argv, timeoutMs) => {
      const stepDirectory = resolve(directory, step.id);
      await mkdir(stepDirectory);
      return recordAttempt(results, step.id, argv, timeoutMs, {
        execute: () => runBounded(argv, stepDirectory, timeoutMs, { cwd: root, environment }),
        capture: async () => {
          const streams = await Promise.all(["stdout", "stderr"].map(async stream => {
            const path = resolve(stepDirectory, `command.${stream}`), bytes = await readFile(path);
            return { path: relative(root, path), bytes: bytes.length, sha256: hash(bytes) };
          }));
          return { streams, stdout: await readFile(resolve(stepDirectory, "command.stdout"), "utf8") };
        },
      });
    } });
    status = outcome.status;
  } catch (error) { failure = String(error); status = results.length ? "FAIL_EXECUTION" : "FAIL_PREFLIGHT"; }
  try { sourceChanged = inventory.length > 0 && JSON.stringify(await sourceInventory(root)) !== JSON.stringify(inventory); }
  catch { sourceChanged = true; }
  if (sourceChanged) status = "FAIL_SOURCE_CHANGED";
  const receipt = { version: "chess-coach.host-qualification.v1", mode, campaign, status, failure, sourceManifestSha256, sourceChanged, artifacts, results,
    approvalSha256: hash(approvalBytes), runId: approval.runId, testLoopLimits: approval.limits,
    campaignInvocationsConsumed: 1, remainingCampaignInvocations: 0, automaticRetryAuthorized: false, outputBytesPerStreamLimit: 4194304,
    trainingReady: false, canonicalBothQualified: false, integratedR4Qualified: false, operationalTelemetryQualified: false,
    fullAssuranceQualified: false, trainingExecuted: false };
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status, receipt: resolve(directory, "receipt.json"), trainingReady: false }));
  process.exitCode = status === "PASS_TESTS_ONLY" ? 0 : 1;
}

if (import.meta.main) await main();
