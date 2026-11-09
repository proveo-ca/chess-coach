// SPEC: _spec/recovery.md
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { environment, repository } from "./provision";

export const reviewedFiles = [
  "_work/gpu-owner-recovery/cuda-isolation.ts", "_work/gpu-owner-recovery/cuda-isolation.test.ts",
  "_work/gpu-owner-recovery/cuda-mise.toml", "_work/gpu-owner-recovery/provision.ts",
  "_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts",
  "_work/gpu-owner-recovery/tsconfig.json", "tsconfig.json",
] as const;
export const reviewPath = "_work/gpu-owner-recovery/cuda-isolation-reviewed-v3.json";
export const grantPath = "_work/gpu-owner-recovery/cuda-llvm-request.json";
export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("OBJECT_REQUIRED");
  return value as Record<string, unknown>;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const exactKeys = (value: object, keys: readonly string[]) => same(Object.keys(value).sort(), [...keys].sort());
const artifacts = [
  { name: "tracel-llvm-23.1.0-4-linux-x64.tar.xz", url: "https://github.com/tracel-ai/tracel-llvm/releases/download/v23.1.0-4/linux-x64.tar.xz", byteLength: 45439652,
    sha256: "c394bb1b10ac785f16d3d92d688a9343ba869f720e9cf9ca3f1abf2f401f165f", destination: "_work/gpu-owner-recovery/cache/home/.cache/tracel/tracel-llvm-23.1.0-4-linux-x64.tar.xz" },
  { name: "tracel-llvm-23.1.0-4-linux-x64.checksums.json", url: "https://github.com/tracel-ai/tracel-llvm/releases/download/v23.1.0-4/linux-x64.checksums.json", byteLength: 297,
    sha256: "57780b96c702d2ac595c52da61961549450648b8d18f5b81b7a1d06afa83682d", destination: "_work/gpu-owner-recovery/cache/home/.cache/tracel/tracel-llvm-23.1.0-4-linux-x64.checksums.json" },
];
const compileTargets = [
  ["cargo", "test", "--locked", "--offline", "--jobs", "2", "-p", "chess-coach-learning", "--features", "gpu-cuda", "--test", "finite_difference", "--no-run"],
  ["cargo", "test", "--locked", "--offline", "--jobs", "2", "-p", "chess-coach-policy-io", "--features", "gpu-cuda", "--test", "gpu", "--bins", "--no-run"],
];
const deniedAuthorities = [
  "otherDownloadsOrNewToolsAuthorized", "libdeviceReacquisitionAuthorized", "nvidiaRuntimeOrDriverAcquisitionAuthorized",
  "gccOrAlternativeCompilerAcquisitionAuthorized", "dependencySourceOrLockModificationAuthorized", "testBinaryOrModelExecutionAuthorized",
  "gpuExecutionAuthorized", "hostDockerImageOrProductionOperationsAuthorized", "normalDispatcherEnablementAuthorized", "trainingAuthorized", "publicationAuthorized",
];

export function validateGrant(value: unknown): void {
  const grant = object(value), limits = object(grant.requestedExecutionLimits), authorization = object(grant.authorization);
  if (grant.version !== "chess-coach.cuda-llvm-development-request.v1" || grant.authorityGranted !== true || grant.phase !== "ISOLATION_PREFLIGHT_FIRST" ||
      authorization.grantStatus !== "APPROVED_NOT_EXECUTED" || authorization.firstActualFailureStopsSequence !== true ||
      !["EXACT_TWO_LLVM_FILES_GATED_LOCAL_PROVISIONING_AND_TWO_ISOLATED_NO_RUN_TARGETS_ONLY", "REVIEWED_INERT_ISOLATION_PROBE_ONLY"].includes(String(authorization.scope)) ||
      grant.renewedExecutorDecisionRequired === true || grant.status !== "APPROVED_CONDITIONAL_DEVELOPMENT_SEQUENCE" ||
      grant.objective !== "REAL_SOURCE_CUDA_FEATURE_NO_RUN_COMPILATION_ONLY" ||
      grant.executionGate !== "STATIC_TESTS_TYPES_ADVERSARIAL_AND_SECURITY_REVIEW_BEFORE_OPERATIONS" ||
      grant.taskConfiguration !== "_work/gpu-owner-recovery/cuda-mise.toml" ||
      !same(grant.compileTargets, compileTargets) || deniedAuthorities.some(key => grant[key] !== false) ||
      limits.namespaceAndCustodyPreflightDeadlineMs !== 30_000 || limits.stopSequenceAtFirstFailure !== true || limits.automaticRetryAllowed !== false) throw Error("EXACT_PREFLIGHT_GRANT_REQUIRED");
  if (!Array.isArray(grant.artifacts) || grant.artifacts.length !== artifacts.length || artifacts.some((expected, index) => {
    const actual = object((grant.artifacts as unknown[])[index]);
    return !exactKeys(actual, Object.keys(expected)) || Object.entries(expected).some(([key, value]) => actual[key] !== value);
  })) throw Error("EXACT_ARTIFACT_IDENTITIES_REQUIRED");
}

export type ReviewInputs = { record: unknown; grantBytes: Uint8Array; files: Readonly<Record<string, Uint8Array>> };
export function validateReview(record: unknown, grantBytes: Uint8Array, files: Readonly<Record<string, Uint8Array>>): void {
  const review = object(record), hashes = object(review.files);
  const accepted = ["staticUnitTestsPassed", "staticTypesPassed", "adversarialSourceAccepted", "securitySourceAccepted"];
  if (!exactKeys(review, ["version", ...accepted, "requestSha256", "files"]) || review.version !== "chess-coach.cuda-isolation-source-review.v1" ||
      accepted.some(key => review[key] !== true)) throw Error("ACCEPTED_SOURCE_REVIEW_REQUIRED");
  if (review.requestSha256 !== sha256(grantBytes) || !exactKeys(hashes, reviewedFiles) || !exactKeys(files, reviewedFiles) ||
      reviewedFiles.some(path => !/^[a-f0-9]{64}$/.test(String(hashes[path])) || hashes[path] !== sha256(files[path]!))) throw Error("REVIEW_HASH_MISMATCH");
  validateGrant(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(grantBytes)));
}

export function isolationEnvironment(): Record<string, string> {
  return { ...environment, MISE_OVERRIDE_CONFIG_FILENAMES: "cuda-mise.toml" };
}

export function validateTaskConfiguration(bytes: Uint8Array): void {
  if (bytes.byteLength > 4096) throw Error("EXACT_TASK_CONFIGURATION_REQUIRED");
  const configuration = Bun.TOML.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!same(configuration, { tasks: { "cuda:isolation-probe": { dir: "../..",
    run: "/usr/local/bin/bun --no-env-file --no-install _work/gpu-owner-recovery/cuda-isolation.ts probe" } } })) throw Error("EXACT_TASK_CONFIGURATION_REQUIRED");
}

export type MiseStage = { name: "00-trust" | "01-config" | "02-inert-probe"; argv: string[] };
export function miseStagePlan(): MiseStage[] {
  return [
    { name: "00-trust", argv: ["/usr/local/bin/mise", "trust", resolve(repository, "_work/gpu-owner-recovery/cuda-mise.toml")] },
    { name: "01-config", argv: ["/usr/local/bin/mise", "config", "ls", "--json"] },
    { name: "02-inert-probe", argv: ["/usr/local/bin/mise", "run", "--raw", "cuda:isolation-probe"] },
  ];
}

export function validateMiseDiscovery(bytes: Uint8Array): void {
  if (bytes.byteLength > 65536) throw Error("SOLE_TASKS_CONFIGURATION_REQUIRED");
  const configuration: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!Array.isArray(configuration) || configuration.length !== 1) throw Error("SOLE_TASKS_CONFIGURATION_REQUIRED");
  const selected = object(configuration[0]);
  if (selected.path !== resolve(repository, "_work/gpu-owner-recovery/cuda-mise.toml") ||
      (selected.tools !== undefined && (!Array.isArray(selected.tools) || selected.tools.length !== 0))) throw Error("SOLE_TASKS_CONFIGURATION_REQUIRED");
}

export type MiseStageResult = { exitCode: number; stdout: Uint8Array; failure?: string | null };
export type TrustedMiseStageIO = {
  verifyOutsideGate: () => Promise<void>;
  readTaskConfiguration: () => Promise<Uint8Array>;
  run: (stage: MiseStage) => Promise<MiseStageResult>;
};
export async function runMiseStages(trusted: TrustedMiseStageIO) {
  const completedStages: MiseStage["name"][] = [];
  for (const stage of miseStagePlan()) {
    await trusted.verifyOutsideGate();
    validateTaskConfiguration(await trusted.readTaskConfiguration());
    const result = await trusted.run(stage);
    if (!Number.isInteger(result.exitCode) || result.exitCode < 0 || result.exitCode > 255) throw Error("INVALID_MISE_STAGE_EXIT");
    if (result.exitCode !== 0 || (result.failure !== undefined && result.failure !== null)) return { exitCode: result.exitCode || 1, failedStage: stage.name,
      failure: result.failure ?? null, completedStages, inertProbePassed: false, buildIsolationQualified: false,
      custodyQualified: false, cudaCompilationEstablished: false, trainingReady: false };
    if (stage.name === "01-config") validateMiseDiscovery(result.stdout);
    await trusted.verifyOutsideGate();
    completedStages.push(stage.name);
  }
  return { exitCode: 0, failedStage: null, failure: null, completedStages, inertProbePassed: true,
    buildIsolationQualified: false, custodyQualified: false, cudaCompilationEstablished: false, trainingReady: false };
}

const libraryRoot = "/usr/lib/x86_64-linux-gnu/";
function physicalPathAllowed(guest: string, path: string): boolean {
  return guest === "/usr/bin/true" ? path === "/usr/bin/true" || path === "/usr/bin/gnutrue" : path.startsWith(libraryRoot);
}
const bindings = [
  { guest: "/usr/bin/true", cap: 1024 * 1024 },
  { guest: `${libraryRoot}libc.so.6`, cap: 16 * 1024 * 1024 },
  { guest: `${libraryRoot}ld-linux-x86-64.so.2`, cap: 1024 * 1024 },
] as const;
export type ProbeFile = { guest: string; path: string; device: string; inode: string; byteLength: number; mode: number; uid: number; sha256: string };
export function validateProbeFiles(files: readonly ProbeFile[]): void {
  if (files.length !== bindings.length || bindings.some((binding, index) => {
    const file = files[index];
    return !file || file.guest !== binding.guest || resolve(file.path) !== file.path ||
      !physicalPathAllowed(binding.guest, file.path) ||
      !/^[0-9]+$/.test(file.device) || !/^[1-9][0-9]*$/.test(file.inode) || !Number.isSafeInteger(file.byteLength) ||
      file.byteLength <= 0 || file.byteLength > binding.cap || !Number.isInteger(file.mode) || (file.mode & 0o170000) !== 0o100000 ||
      (file.mode & 0o111) === 0 || (file.mode & 0o022) !== 0 || file.uid !== 0 || !/^[a-f0-9]{64}$/.test(file.sha256);
  })) throw Error("UNSUPPORTED_TRUSTED_FILE_LAYOUT");
}

export async function readProbeFiles(): Promise<ProbeFile[]> {
  if (process.platform !== "linux" || process.arch !== "x64") throw Error("LINUX_X86_64_GNU_REQUIRED");
  const files: ProbeFile[] = [];
  for (const binding of bindings) {
    const path = await realpath(binding.guest);
    if (resolve(path) !== path || !physicalPathAllowed(binding.guest, path)) throw Error("UNSUPPORTED_TRUSTED_FILE_LAYOUT");
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const before = await handle.stat({ bigint: true });
      if (!before.isFile() || before.size <= 0n || before.size > BigInt(binding.cap)) throw Error("UNSUPPORTED_TRUSTED_FILE_LAYOUT");
      const bytes = Buffer.alloc(Number(before.size) + 1);
      let length = 0;
      while (length < bytes.length) {
        const result = await handle.read(bytes, length, bytes.length - length, length);
        if (result.bytesRead === 0) break;
        length += result.bytesRead;
      }
      const after = await handle.stat({ bigint: true });
      if (BigInt(length) !== before.size || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
          before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) throw Error("TRUSTED_FILE_CHANGED");
      files.push({ guest: binding.guest, path, device: String(before.dev), inode: String(before.ino), byteLength: length,
        mode: Number(before.mode), uid: Number(before.uid), sha256: sha256(bytes.subarray(0, length)) });
    } finally { await handle.close(); }
  }
  validateProbeFiles(files);
  return files;
}

export function probeArgv(files: readonly ProbeFile[]): string[] {
  validateProbeFiles(files);
  return ["/usr/bin/bwrap", "--die-with-parent", "--unshare-user", "--unshare-net", "--clearenv", "--cap-drop", "ALL",
    "--setenv", "PATH", "/usr/bin:/bin", "--setenv", "LANG", "C",
    ...["/usr", "/usr/bin", "/usr/lib", "/usr/lib/x86_64-linux-gnu", "/usr/lib64"].flatMap(path => ["--dir", path]),
    ...files.flatMap(file => ["--ro-bind", file.path, file.guest]),
    "--symlink", "usr/bin", "/bin", "--symlink", "usr/lib", "/lib", "--symlink", "usr/lib64", "/lib64",
    "--symlink", "../lib/x86_64-linux-gnu/ld-linux-x86-64.so.2", "/usr/lib64/ld-linux-x86-64.so.2",
    "--dev", "/dev", "--dir", "/proc", "--chdir", "/", "--", "/usr/bin/true"];
}

export type ProbeSpawnOptions = { cwd: "/"; env: Record<string, string>; stdin: "ignore"; stdout: "inherit"; stderr: "inherit"; detached: false };
export type TrustedSpawn = (argv: string[], options: ProbeSpawnOptions) => { exited: Promise<number> };
export type TrustedProbeIO = { readReview: () => Promise<ReviewInputs>; readProbeFiles: () => Promise<ProbeFile[]>; spawn: TrustedSpawn };
const productionIO: TrustedProbeIO = {
  async readReview() {
    const record: unknown = JSON.parse(await readFile(resolve(repository, reviewPath), "utf8"));
    const grantBytes = await readFile(resolve(repository, grantPath));
    const files = Object.fromEntries(await Promise.all(reviewedFiles.map(async path => [path, await readFile(resolve(repository, path))])));
    return { record, grantBytes, files };
  },
  readProbeFiles,
  spawn: (argv, options) => Bun.spawn(argv, options),
};

export async function probe(args: readonly string[], trusted: TrustedProbeIO = productionIO) {
  if (args.length !== 1 || args[0] !== "probe") throw Error("CLOSED_PROBE_CLI_REQUIRED");
  const review = await trusted.readReview();
  validateReview(review.record, review.grantBytes, review.files);
  const inputs = await trusted.readProbeFiles();
  const exitCode = await trusted.spawn(probeArgv(inputs), {
    cwd: "/", env: { PATH: "/usr/bin:/bin", LANG: "C" }, stdin: "ignore", stdout: "inherit", stderr: "inherit", detached: false,
  }).exited;
  if (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) throw Error("INVALID_PROBE_EXIT");
  return { exitCode, inertProbePassed: exitCode === 0, buildIsolationQualified: false, custodyQualified: false,
    cudaCompilationEstablished: false, trainingReady: false, inputs };
}

if (import.meta.main) {
  try {
    const result = await probe(Bun.argv.slice(2));
    console.log(JSON.stringify(result));
    process.exitCode = result.exitCode;
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
