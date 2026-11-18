// @bun
// _work/gpu-owner-recovery/qualification/cpu-host.ts
import { createHash } from "crypto";
import { constants } from "fs";
import { copyFile, lstat as lstat2, mkdir as mkdir2, readFile as readFile2, statfs as statfs2, writeFile as writeFile2 } from "fs/promises";
import { dirname, relative, resolve } from "path";
import { pathToFileURL } from "url";

// _work/gpu-owner-recovery/qualification/host-build/build.ts
import { lstat, mkdir, readFile, readdir, statfs, writeFile } from "fs/promises";
async function treeBytes(path, files = { entries: (path2) => readdir(path2, { withFileTypes: true }), size: async (path2) => (await lstat(path2)).size }) {
  let total = 0;
  for (const entry of await files.entries(path)) {
    const child = path + "/" + entry.name;
    try {
      total += entry.isDirectory() ? await treeBytes(child, files) : await files.size(child);
    } catch (error) {
      if (error.code !== "ENOENT")
        throw error;
    }
  }
  return total;
}
function watchWorkspace(p, paths, stop, io = {
  free: async () => {
    const space = await statfs(paths.workspace);
    return Number(space.bavail) * Number(space.bsize);
  },
  bytes: async () => await treeBytes(paths.workspace) + await treeBytes(paths.evidence)
}) {
  let closed = false, pending = null;
  const stops = new Set;
  const request = (reason) => {
    const job = stop(reason);
    stops.add(job);
    job.finally(() => stops.delete(job)).catch(() => {});
    return job;
  };
  const check = () => {
    if (closed)
      return Promise.resolve();
    return pending ??= (async () => {
      try {
        if (await io.free() < p.limits.minimumRunningFreeBytes || await io.bytes() > p.limits.workspaceSoftBytes)
          await request("WORKSPACE_SOFT_LIMIT_OR_FREE_SPACE");
      } catch {
        await request("WORKSPACE_MONITOR_FAILED");
      }
    })().finally(() => {
      pending = null;
    });
  };
  const interrupt = () => {
    if (!closed)
      request("HOST_BUILD_INTERRUPTED");
  };
  const timer = setInterval(() => {
    check();
  }, 5000);
  process.on("SIGTERM", interrupt);
  process.on("SIGINT", interrupt);
  return { check, interrupt, close: async () => {
    closed = true;
    clearInterval(timer);
    process.off("SIGTERM", interrupt);
    process.off("SIGINT", interrupt);
    if (pending)
      await pending;
    await Promise.all([...stops]);
  } };
}
function protectFinalizationSignals(signals = process) {
  let interrupted = false;
  const protect = () => {
    interrupted = true;
  };
  for (const name of ["SIGTERM", "SIGINT"])
    signals.on(name, protect);
  return { observed: () => interrupted, release: () => {
    for (const name of ["SIGTERM", "SIGINT"])
      signals.off(name, protect);
  } };
}
// _work/gpu-owner-recovery/qualification/host-build/plan.json
var plan_default = {
  version: "chess-coach.owned-container-native-build-proposal.v1",
  status: "SOURCE_ONLY_AWAITING_EXPLICIT_BUILD_METHOD_AND_HOST_APPROVAL",
  method: "OWNED_DOCKER_CONTAINER_NATIVE_BUILD_ONLY_NOT_QUALIFICATION_IMAGE_BUILD",
  runId: "host-gpu-native-build-1",
  grant: "--approved-host-gpu-native-build-1",
  context: "_work/gpu-owner-recovery/cache/host-receive-2/context",
  workspace: "_work/gpu-owner-recovery/cache/host-gpu-native-build-1",
  evidence: "_work/gpu-owner-recovery/runs/host-gpu-native-build-1",
  engine: "unix:///var/run/docker.sock",
  rustImage: "docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb",
  bunImage: "docker.io/oven/bun@sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038",
  sourceManifestSha256: "9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863",
  existingHelpers: [
    { path: "_work/gpu-owner-recovery/verify.ts", sha256: "9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58" },
    { path: "_work/gpu-owner-recovery/command-supervisor.ts", sha256: "88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6" }
  ],
  cudaBindingTrial: "13000",
  resources: { cpus: 2, memoryBytes: 8589934592, memoryPlusSwapBytes: 8589934592, cargoJobs: 2, rayonThreads: 2, uidGid: "CURRENT_OPERATOR_NUMERIC_UID_GID" },
  limits: { overallMs: 4200000, normalOperationsMs: 4020000, nativeWorkMs: 3600000, cleanupMs: 120000, receiptReserveMs: 60000, dockerCommandMs: 120000, artifactValidationMs: 120000, minimumFreeBytes: 68719476736, minimumRunningFreeBytes: 17179869184, workspaceSoftBytes: 34359738368, stagingBytes: 536870912, stagingFiles: 3800, bunPostCopyBytes: 134217728, supervisedStreamBytes: 4194304, hostDockerStreamsBytes: 83886080, nativeStreamsBytes: 41943040, canonicalLogCopiesBytes: 16777216, hostReceiptBytes: 2097152 },
  maximums: { donorCreates: 1, donorStarts: 0, bunCopies: 1, workerCreates: 1, workerStarts: 1, workerLogFollows: 1, terminalInspections: 1, workerStops: 1, workerKills: 1, containerRemovals: 2, dockerOperations: 10, cargoCompilations: 2 },
  hostExecutionApproved: false,
  stagingAndNativeCompilationApproved: false,
  qualificationImageBuildAuthorized: false,
  sharedBuilderModificationAuthorized: false,
  imagePullOrDependencyFetchAuthorized: false,
  gpuExecutionAuthorized: false,
  trainingAuthorized: false,
  automaticRetryAuthorized: false,
  sourcePublicationRequired: false,
  helperDownloads: 0,
  trainingReady: false
};
// _work/gpu-owner-recovery/qualification/cpu-host-plan.json
var cpu_host_plan_default = {
  version: "chess-coach.closed-cpu-host-proposal.v1",
  status: "UNAPPROVED_SOURCE_ONLY",
  method: "OWNED_CPU_CONTAINER_FRESH_OFFLINE_BUILD_AND_CPU39_REGRESSION",
  runId: "host-cpu39-1",
  grant: "--approved-host-cpu39-1",
  root: "/home/gu1lty/Projects/proveo/chess-coach",
  workspace: "_work/gpu-owner-recovery/cache/host-cpu39-1",
  evidence: "_work/gpu-owner-recovery/runs/host-cpu39-1",
  engine: "unix:///var/run/docker.sock",
  rustImage: "docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb",
  retained: {
    native: "_work/gpu-owner-recovery/cache/host-gpu-native-build-2/native",
    bun: "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun",
    cargo: "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/cargo-home"
  },
  nativeManifestMetadata: "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json",
  sourceManifestSha256: "7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec",
  cargoLockSha256: "77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955",
  existingHelpers: [
    { path: "_work/gpu-owner-recovery/verify.ts", sha256: "9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58" },
    { path: "_work/gpu-owner-recovery/command-supervisor.ts", sha256: "88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6" },
    { path: "_work/gpu-owner-recovery/qualification/host-build/build.ts", sha256: "3b83c50932c5092f45b147602bb26ae530628e2fdbf7d6e5a7e4363ae65c1ac8" }
  ],
  resources: { cpus: 2, memoryBytes: 8589934592, memoryPlusSwapBytes: 8589934592, cargoJobs: 2, rayonThreads: 2, serialTestThreads: 1, class: "C1_ORDINARY_CAPS_NOT_QUOTA_OR_FIT_GUARANTEES" },
  testLoop: { perTestMs: 120000, totalMs: 1950000, cleanupReserveMs: 30000 },
  coverage: { sourceFiles: 65, copiedFiles: 66, harnesses: 16, executables: 19, learningTests: 22, policyTests: 17, tests: 39, emptyHarnesses: 5 },
  limits: { overallMs: 4200000, normalOperationsMs: 4020000, cleanupMs: 120000, receiptReserveMs: 60000, workerMs: 3600000, compilationMs: 1500000, startupAndFinalizationMs: 150000, workerFinalizationMs: 30000, dockerCommandMs: 120000, versionMs: 1e4, minimumFreeBytes: 68719476736, minimumRunningFreeBytes: 17179869184, workspaceSoftBytes: 34359738368, scratchSoftBytes: 2147483648, evidenceSoftBytes: 268435456, watchMs: 5000, stagingBytes: 2097152, stagingFiles: 66, supervisedStreamBytes: 4194304, hostReceiptBytes: 2097152 },
  maximums: { hostInvocations: 1, dockerOperations: 7, workerCreates: 1, workerStarts: 1, workerLogFollows: 1, terminalInspections: 1, workerStops: 1, workerKills: 1, containerRemovals: 1, cargoCompilations: 2, versionCommands: 2, donors: 0, imageBuilds: 0, imagePulls: 0, gpuRequests: 0 },
  hostExecutionApproved: false,
  sourcePublicationRequiredBeforeHostExecution: true,
  stagingAndNativeCompilationApproved: false,
  nativeManifestCopyApproved: false,
  cargoArchiveUnpackIntoFreshWritableHomeApproved: false,
  cpuRegressionExecutionApproved: false,
  retainedMutationAuthorized: false,
  imageOperationAuthorized: false,
  dependencyAcquisitionAuthorized: false,
  sharedBuilderModificationAuthorized: false,
  gpuExecutionAuthorized: false,
  llvmExecutionAuthorized: false,
  automaticRetryAuthorized: false,
  trainingAuthorized: false,
  publicationAuthorized: false,
  trainingReady: false
};

// _work/gpu-owner-recovery/qualification/cpu-host.ts
var requireValue = (value, reason) => {
  if (!value)
    throw Error(reason);
};
var digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
var errorText = (error) => error instanceof Error ? error.message : String(error);
var freeze = (value) => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value))
      freeze(child);
    Object.freeze(value);
  }
  return value;
};
var cpuPlan = freeze(structuredClone(cpu_host_plan_default));
function validatePlan(value = cpuPlan) {
  requireValue(JSON.stringify(value) === JSON.stringify(cpuPlan), "CLOSED_CPU39_PLAN_REQUIRED");
  requireValue(value.limits.overallMs === value.limits.normalOperationsMs + value.limits.cleanupMs + value.limits.receiptReserveMs, "WHOLE_CLOCK_BUDGET_REQUIRED");
  requireValue(value.limits.workerMs === value.limits.compilationMs + value.testLoop.totalMs + value.limits.startupAndFinalizationMs, "COMPLETE_WORKER_BUDGET_REQUIRED");
  return value;
}
function cpuPaths(root = cpuPlan.root) {
  requireValue(root === cpuPlan.root, "FIXED_HOST_ROOT_REQUIRED");
  const workspace = resolve(root, cpuPlan.workspace), evidence = resolve(root, cpuPlan.evidence);
  return {
    workspace,
    evidence,
    native: workspace + "/native",
    cargo: workspace + "/cargo-home",
    scratch: workspace + "/scratch",
    inner: evidence + "/inner",
    retainedNative: resolve(root, cpuPlan.retained.native),
    retainedCargo: resolve(root, cpuPlan.retained.cargo),
    bun: resolve(root, cpuPlan.retained.bun)
  };
}
function cpuBuildCommands() {
  return ["learning", "policy-io"].map((owner) => ({ id: owner === "learning" ? "cpu-learning" : "cpu-policy", argv: ["cargo", "test", "--release", "--target", "x86_64-unknown-linux-gnu", "--locked", "--offline", "--jobs", "2", "-p", "chess-coach-" + owner, "--tests", "--no-run", "--message-format=json"] }));
}
var docker = (...argv) => ["docker", "--host=" + cpuPlan.engine, ...argv];
function cpuWorkerCreate(paths, uid, gid) {
  requireValue(Number.isSafeInteger(uid) && uid >= 0 && Number.isSafeInteger(gid) && gid >= 0, "NUMERIC_OPERATOR_UID_GID_REQUIRED");
  requireValue(JSON.stringify(paths) === JSON.stringify(cpuPaths()), "CLOSED_CPU_PATHS_REQUIRED");
  const mounts = [
    [paths.retainedNative, "/retained/native", true],
    [paths.bun, "/usr/local/bin/bun", true],
    [paths.native, "/build/native", false],
    [paths.cargo, "/capture/cargo-home", false],
    [paths.retainedCargo + "/registry/index", "/capture/cargo-home/registry/index", true],
    [paths.retainedCargo + "/registry/cache", "/capture/cargo-home/registry/cache", true],
    [paths.evidence, "/evidence", true],
    [paths.inner, "/build/native/_work/gpu-owner-recovery/runs/" + cpuPlan.runId, false],
    [paths.scratch, "/build/native/_work/gpu-owner-recovery/scratch", false]
  ];
  const environment = {
    CARGO_HOME: "/capture/cargo-home",
    CARGO_TARGET_DIR: "/build/native/target-cpu",
    CARGO_BUILD_JOBS: "2",
    CARGO_NET_OFFLINE: "true",
    CARGO_NET_RETRY: "0",
    RAYON_NUM_THREADS: "2",
    RUST_TEST_THREADS: "1",
    RUSTUP_AUTO_INSTALL: "0",
    HOME: "/build/native/_work/gpu-owner-recovery/scratch/home",
    TMPDIR: "/build/native/_work/gpu-owner-recovery/scratch/tmp",
    PATH: "/usr/local/cargo/bin:/usr/local/bin:/usr/bin:/bin",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    TZ: "UTC"
  };
  return docker("create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=" + uid + ":" + gid, "--cidfile=" + paths.evidence + "/worker.cid", "--label=chess-coach.cpu39=" + cpuPlan.runId, "--workdir=/build/native", "--entrypoint=/usr/local/bin/bun", ...mounts.flatMap(([source, target, ro]) => {
    requireValue(source.startsWith("/") && !source.includes(","), "ABSOLUTE_COMMA_FREE_MOUNT_REQUIRED");
    return ["--mount", `type=bind,source=${source},target=${target}${ro ? ",readonly" : ""}`];
  }), ...Object.entries(environment).flatMap(([key, value]) => ["--env", key + "=" + value]), cpuPlan.rustImage, "--no-env-file", "--no-install", "/evidence/driver.mjs");
}
function cpuManifest(bytes) {
  requireValue(bytes.byteLength <= cpuPlan.limits.stagingBytes && digest(bytes) === cpuPlan.sourceManifestSha256, "CPU_NATIVE65_MANIFEST_HASH_REQUIRED");
  const rows = JSON.parse(Buffer.from(bytes).toString());
  requireValue(Array.isArray(rows) && rows.length === 65 && new Set(rows.map((row) => row.path)).size === 65, "EXACT_NATIVE65_REQUIRED");
  for (const row of rows)
    requireValue(typeof row.path === "string" && !row.path.startsWith("/") && row.path.split("/").every((part) => /^[a-zA-Z0-9_.-]+$/.test(part) && part !== "." && part !== "..") && /^[a-f0-9]{64}$/.test(row.sha256), "MANIFEST_SOURCE_PATH_REQUIRED");
  return rows;
}
async function stageCpuSources(io) {
  const from = "/retained/native", to = "/build/native", manifestPath = "qualification/source-manifest.json";
  io.check();
  const manifestStat = await io.stat(from + "/" + manifestPath);
  io.check();
  requireValue(manifestStat.isFile() && manifestStat.size > 0 && manifestStat.size <= cpuPlan.limits.stagingBytes, "REGULAR_BOUNDED_MANIFEST_REQUIRED");
  const bytes = await io.read(from + "/" + manifestPath);
  io.check();
  requireValue(bytes.byteLength === manifestStat.size, "MANIFEST_SIZE_CHANGED");
  const inventory = cpuManifest(bytes);
  let copiedBytes = 0, copiedFiles = 0;
  for (const row of [...inventory, { path: manifestPath, sha256: cpuPlan.sourceManifestSha256 }]) {
    io.check();
    const source = from + "/" + row.path, target = to + "/" + row.path, stat = await io.stat(source);
    io.check();
    requireValue(stat.isFile() && Number.isSafeInteger(stat.size) && stat.size >= 0, "STAGING_REGULAR_FILE_REQUIRED");
    copiedBytes += stat.size;
    copiedFiles++;
    requireValue(copiedBytes <= cpuPlan.limits.stagingBytes && copiedFiles <= cpuPlan.limits.stagingFiles, "CPU_SOURCE_COPY_BOUND");
    await io.mkdir(dirname(target));
    io.check();
    await io.copy(source, target, constants.COPYFILE_EXCL);
    io.check();
    const copied = await io.stat(target);
    io.check();
    requireValue(copied.isFile() && copied.size === stat.size && await io.hash(target) === row.sha256, "STAGED_SOURCE_HASH_REQUIRED:" + row.path);
    io.check();
  }
  requireValue(copiedFiles === 66, "EXACT_66_SOURCE_COPIES_REQUIRED");
  return { inventory, copiedBytes, copiedFiles, sourceManifestSha256: digest(bytes) };
}
async function executeCpuWorker(io) {
  const deadline = Math.min(io.startedAt + cpuPlan.limits.workerMs, io.deadline), attempts = [], invoked = new Set, artifacts = [];
  let phase = "staging", failure = null, qualification = null, staging = null;
  let sourceChanged = null, sourceStabilityChecked = false, compilationAttempts = 0, outcome = null;
  const check = () => requireValue(io.now() < deadline - cpuPlan.limits.workerFinalizationMs, "CPU_WORKER_PHASE_DEADLINE:" + phase);
  const command = async (id, argv, ms) => {
    check();
    requireValue(ms > 0 && ms <= deadline - cpuPlan.limits.workerFinalizationMs - io.now(), "COMPLETE_PHASE_COMMAND_BUDGET_REQUIRED");
    const result = await qualification.recordAttempt(attempts, id, argv, ms, {
      execute: async () => {
        invoked.add(id);
        const out = await io.execute(id, argv, ms);
        check();
        return out;
      },
      capture: async () => {
        const captured = await io.capture(id);
        check();
        requireValue(captured.streams.length === 2 && captured.streams.every((stream) => stream.bytes >= 0 && stream.bytes <= cpuPlan.limits.supervisedStreamBytes && /^[a-f0-9]{64}$/.test(stream.sha256)), "BOUNDED_TWO_STREAM_CAPTURE_REQUIRED");
        return captured;
      }
    });
    check();
    return result;
  };
  try {
    check();
    const boot = await io.bootstrap(check);
    check();
    qualification = boot.qualification;
    staging = boot.staging;
    requireValue(staging.copiedFiles === 66 && staging.copiedBytes <= cpuPlan.limits.stagingBytes && staging.sourceManifestSha256 === cpuPlan.sourceManifestSha256 && staging.inventory.length === 65, "CPU_NATIVE65_STAGING_REQUIRED");
    const before = await io.inventory();
    check();
    requireValue(JSON.stringify(before) === JSON.stringify(staging.inventory), "CPU_STAGED_SOURCE_INVENTORY_REQUIRED");
    qualification.validateLimits(cpuPlan.testLoop, 16);
    const coverage = Object.entries(qualification.cpuCoverage);
    requireValue(coverage.length === 16 && coverage.reduce((n, [, count]) => n + count, 0) === 39 && coverage.filter(([, count]) => count === 0).length === 5 && coverage.filter(([id]) => id.startsWith("learning:")).reduce((n, [, count]) => n + count, 0) === 22, "FROZEN_CPU39_COVERAGE_REQUIRED");
    phase = "version-guards";
    for (const name of ["rustc", "cargo"]) {
      const result = await command(name + "-version", [name, "--version"], cpuPlan.limits.versionMs);
      requireValue(result.status === "PASS" && result.exitCode === 0 && result.failure === null && new RegExp("^" + name + " 1\\.95\\.0 ").test(result.stdout), "CPU_TOOLCHAIN_VERSION_REQUIRED:" + name);
    }
    phase = "compilation";
    requireValue(io.now() + cpuPlan.limits.compilationMs + cpuPlan.testLoop.totalMs + cpuPlan.limits.workerFinalizationMs <= deadline, "COMPLETE_COMPILE_AND_CPU_LOOP_BUDGET_REQUIRED");
    const compileDeadline = io.now() + cpuPlan.limits.compilationMs, logs = {};
    for (const build of cpuBuildCommands()) {
      const ms = Math.floor(compileDeadline - io.now());
      requireValue(ms > 0, "AGGREGATE_CPU_COMPILATION_DEADLINE");
      compilationAttempts++;
      const result = await command(build.id, build.argv, ms);
      requireValue(io.now() < compileDeadline, "AGGREGATE_CPU_COMPILATION_DEADLINE");
      requireValue(result.status === "PASS" && result.exitCode === 0 && result.failure === null, "CPU_COMPILATION_FAILED:" + build.id);
      logs[build.id] = result.stdout;
    }
    phase = "artifacts";
    const selected = qualification.readArtifacts({ learning: logs["cpu-learning"], "policy-io": logs["cpu-policy"] }, "cpu");
    check();
    const steps = qualification.qualificationPlan("cpu", "regression", selected.artifacts);
    requireValue(steps.length === 16 && steps.reduce((n, step) => n + step.count, 0) === 39 && steps.filter((step) => step.count === 0).length === 5, "COMPLETE_CPU39_PLAN_REQUIRED");
    const executables = new Set([...steps.map((step) => step.executable), ...selected.binaries.values()]);
    requireValue(executables.size === 19, "NINETEEN_DISTINCT_CPU_EXECUTABLES_REQUIRED");
    for (const executable of executables) {
      check();
      const artifact = await io.artifact(executable, check);
      check();
      requireValue(artifact.executable === executable && artifact.bytes > 0 && Number.isSafeInteger(artifact.bytes) && /^[a-f0-9]{64}$/.test(artifact.sha256), "ACTUAL_CPU_EXECUTABLE_METADATA_REQUIRED");
      artifacts.push(artifact);
    }
    phase = "cpu-regression";
    requireValue(io.now() + cpuPlan.testLoop.totalMs + cpuPlan.limits.workerFinalizationMs <= deadline, "COMPLETE_CPU_LOOP_BUDGET_REQUIRED");
    outcome = await qualification.executeQualification(steps, cpuPlan.testLoop, { now: io.now, run: async (step, argv, ms) => {
      requireValue(ms === cpuPlan.testLoop.perTestMs, "COMPLETE_CPU_HARNESS_BUDGET_REQUIRED");
      requireValue(!argv.includes("--ignored") && !argv.includes("--exact") && argv.length === 4 && argv[0] === step.executable, "UNFILTERED_SERIAL_CPU_COMMAND_REQUIRED");
      return command(step.id, argv, ms);
    } });
    check();
    requireValue(outcome.status === "PASS_TESTS_ONLY" && outcome.results.length === 16 && outcome.results.every((result, index) => result.accepted && invoked.has(result.id) && qualification.testPassed(result, steps[index].count)), "ALL_16_CPU_HARNESSES_MUST_EXECUTE_AND_PASS");
  } catch (error) {
    failure = errorText(error);
  }
  phase = "source-postcheck";
  if (staging && qualification) {
    try {
      check();
      const after = await io.inventory();
      check();
      sourceChanged = JSON.stringify(after) !== JSON.stringify(staging.inventory);
      sourceStabilityChecked = true;
    } catch (error) {
      sourceChanged = true;
      failure ??= errorText(error);
    }
  }
  if (sourceChanged !== false || !sourceStabilityChecked)
    failure ??= "CPU_SOURCE_STABILITY_REQUIRED";
  if (io.now() >= deadline - cpuPlan.limits.workerFinalizationMs)
    failure ??= "CPU_WORKER_FINALIZATION_DEADLINE";
  return {
    version: "chess-coach.cpu39-worker.v1",
    status: failure === null ? "PASS_CPU39_TESTS_ONLY" : "FAIL_CPU39_TESTS_ONLY",
    failure,
    phase: failure === null ? "complete" : phase,
    staging,
    sourceChanged,
    sourceStabilityChecked,
    sourceManifestSha256: cpuPlan.sourceManifestSha256,
    compilationAttempts,
    artifacts,
    outcome,
    results: attempts.map((attempt) => ({ ...attempt, commandInvoked: invoked.has(attempt.id) })),
    elapsedMs: io.now() - io.startedAt,
    cpuOnly: true,
    gpuExecuted: false,
    llvmExecuted: false,
    trainingExecuted: false,
    trainingReady: false
  };
}
function acceptCpuWorker(receipt) {
  const tests = receipt.results.filter((row) => row.id.includes(":"));
  requireValue(receipt.status === "PASS_CPU39_TESTS_ONLY" && receipt.failure === null && receipt.compilationAttempts === 2 && receipt.sourceChanged === false && receipt.sourceStabilityChecked === true && receipt.sourceManifestSha256 === cpuPlan.sourceManifestSha256 && receipt.staging?.copiedFiles === 66 && receipt.artifacts.length === 19 && new Set(receipt.artifacts.map((row) => row.executable)).size === 19 && receipt.outcome?.status === "PASS_TESTS_ONLY" && receipt.outcome.results.length === 16 && receipt.outcome.results.every((row) => row.accepted) && tests.length === 16 && new Set(tests.map((row) => row.id)).size === 16 && tests.every((row) => row.commandInvoked && row.status === "PASS" && row.exitCode === 0 && row.failure === null && row.streams?.length === 2) && receipt.cpuOnly === true && receipt.gpuExecuted === false && receipt.trainingReady === false, "COMPLETE_SUCCESSFUL_CPU39_WORKER_RECEIPT_REQUIRED");
}
async function executeCpuHost(paths, uid, gid, io) {
  const normalDeadline = io.startedAt + cpuPlan.limits.normalOperationsMs, cleanupDeadline = normalDeadline + cpuPlan.limits.cleanupMs;
  const results = [], cleanupFailures = [], used = new Set;
  let failure = null, cid = null, state = null, inner = null;
  let pending = false, stateAttempted = false, stopPromise = null;
  const check = (cleanup = false) => requireValue(io.now() < (cleanup ? cleanupDeadline : normalDeadline), cleanup ? "CPU_HOST_CLEANUP_DEADLINE" : "CPU_HOST_NORMAL_DEADLINE");
  const operation = async (id, argv, max, cleanup = false) => {
    check(cleanup);
    requireValue(cleanup || failure === null, failure ?? "CPU_HOST_INTERRUPTED");
    requireValue(!used.has(id) && used.size < 7, "CLOSED_SEVEN_DOCKER_OPERATIONS_REQUIRED");
    used.add(id);
    const row = { id, argv, status: "STARTED" };
    results.push(row);
    try {
      const out = await io.run(id, argv, Math.floor(Math.min(max, (cleanup ? cleanupDeadline : normalDeadline) - io.now())));
      const { stdout, ...record } = out;
      Object.assign(row, record, { supervisorResult: record });
      check(cleanup);
      requireValue(out.status === "PASS" && out.exitCode === 0 && out.failure === null, "CPU_DOCKER_OPERATION_FAILED:" + id);
      return stdout.trim();
    } catch (error) {
      Object.assign(row, { status: "FAIL", operationFailure: errorText(error) });
      throw error;
    }
  };
  const recover = async () => {
    const value = await io.recover();
    check(true);
    if (value !== null) {
      requireValue(/^[a-f0-9]{64}$/.test(value) && (cid === null || cid === value), "OWNED_CPU_CONTAINER_ID_REQUIRED");
      cid = value;
    }
  };
  const stop = () => stopPromise ??= (async () => {
    if (!cid || state?.Running === false)
      return;
    try {
      await operation("worker-stop", docker("stop", "--time=10", cid), 20000, true);
    } catch (error) {
      cleanupFailures.push(errorText(error));
      try {
        await operation("worker-kill", docker("kill", "--signal=KILL", cid), 15000, true);
      } catch (killError) {
        cleanupFailures.push(errorText(killError));
      }
    }
  })();
  const inspect = async (cleanup) => {
    stateAttempted = true;
    state = JSON.parse(await operation("worker-state", docker("container", "inspect", "--format", "{{json .State}}", cid), 1e4, cleanup));
    requireValue(state?.Running === false && state.ExitCode === 0 && state.OOMKilled === false, "SUCCESSFUL_TERMINAL_CPU_CONTAINER_STATE_REQUIRED");
  };
  let unwatch = null;
  try {
    check();
    unwatch = io.watch(async (reason) => {
      failure ??= reason;
      if (cid && !pending)
        await stop();
    });
    check();
    pending = true;
    try {
      await operation("worker-create", cpuWorkerCreate(paths, uid, gid), cpuPlan.limits.dockerCommandMs);
    } finally {
      pending = false;
    }
    await recover();
    check();
    requireValue(cid, "OWNED_CPU_WORKER_CID_REQUIRED");
    pending = true;
    try {
      await operation("worker-start", docker("start", cid), cpuPlan.limits.dockerCommandMs);
    } finally {
      pending = false;
    }
    await operation("worker-logs", docker("logs", "--follow", cid), cpuPlan.limits.workerMs);
    inner = await io.workerReceipt();
    check();
    acceptCpuWorker(inner);
    await inspect(false);
    check();
    requireValue(failure === null, failure ?? "CPU_HOST_INTERRUPTED");
  } catch (error) {
    failure ??= errorText(error);
  } finally {
    try {
      await recover();
    } catch (error) {
      cleanupFailures.push(errorText(error));
    }
    if (cid) {
      if (failure !== null)
        await stop();
      if (!stateAttempted) {
        try {
          await inspect(true);
        } catch (error) {
          failure ??= errorText(error);
          await stop();
        }
      }
      if (stopPromise)
        await stopPromise;
      try {
        await operation("worker-remove", docker("rm", cid), 20000, true);
      } catch (error) {
        cleanupFailures.push(errorText(error));
      }
    }
    try {
      if (unwatch)
        await unwatch();
      check(true);
    } catch (error) {
      failure ??= errorText(error);
    }
    if (stopPromise)
      await stopPromise;
  }
  return {
    version: "chess-coach.cpu39-host.v1",
    status: failure === null && cleanupFailures.length === 0 ? "PASS_HOST_CPU39_ONLY" : "FAIL_HOST_CPU39_ONLY",
    failure,
    cleanupFailures,
    cid,
    state,
    innerReceipt: inner,
    results,
    elapsedMs: io.now() - io.startedAt,
    hostInvocationsConsumed: 1,
    remainingHostInvocations: 0,
    automaticRetryAuthorized: false,
    cpuOnly: true,
    gpuDevicesRequested: false,
    gpuExecuted: false,
    trainingExecuted: false,
    trainingReady: false,
    workspaceIsFilesystemQuota: false,
    dockerWritableLayerIncludedInWorkspaceAccounting: false,
    limitsAreTrialCapsNotFitGuarantees: true
  };
}
async function fileDigest(path, check) {
  const hasher = createHash("sha256");
  check();
  for await (const chunk of Bun.file(path).stream()) {
    check();
    hasher.update(chunk);
  }
  check();
  return hasher.digest("hex");
}
async function runCpuWorker() {
  const startedAt = performance.now(), root = "/build/native", directory = root + "/_work/gpu-owner-recovery/runs/" + cpuPlan.runId;
  requireValue(process.cwd() === root && Bun.version === "1.4.0", "CPU_CONTAINER_BUN_CONTEXT_REQUIRED");
  const hostDeadline = JSON.parse(await readFile2("/evidence/deadline.json", "utf8")).normalDeadlineEpoch;
  requireValue(Number.isSafeInteger(hostDeadline) && hostDeadline > Date.now(), "CPU_HOST_DEADLINE_REQUIRED");
  let bounded, phaseCheck = () => {};
  const environment = Object.fromEntries(Object.entries(process.env).filter((row) => row[1] !== undefined));
  const receipt = await executeCpuWorker({
    now: () => performance.now(),
    startedAt,
    deadline: performance.now() + hostDeadline - Date.now(),
    bootstrap: async (check) => {
      phaseCheck = check;
      const staging = await stageCpuSources({ check, stat: lstat2, read: readFile2, mkdir: (path) => mkdir2(path, { recursive: true }), copy: copyFile, hash: (path) => fileDigest(path, check) });
      check();
      for (const path of ["_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts", "tooling/runtime/qualification.ts"]) {
        const expected = staging.inventory.find((row) => row.path === path);
        requireValue(expected && await fileDigest(root + "/" + path, check) === expected.sha256, "HASH_CHECKED_CPU_HELPER_REQUIRED:" + path);
        check();
      }
      ({ runBounded: bounded } = await import(pathToFileURL(root + "/_work/gpu-owner-recovery/verify.ts").href));
      check();
      const qualification = await import(pathToFileURL(root + "/tooling/runtime/qualification.ts").href);
      check();
      return { qualification, staging };
    },
    inventory: async () => {
      const module = await import(pathToFileURL(root + "/tooling/runtime/qualification.ts").href);
      return module.sourceInventory(root);
    },
    execute: async (id, argv, ms) => {
      const commandDeadline = performance.now() + ms, step = directory + "/" + id;
      await mkdir2(step);
      phaseCheck();
      const remaining = Math.floor(commandDeadline - performance.now());
      requireValue(remaining > 0, "CPU_COMMAND_SETUP_DEADLINE");
      return bounded(argv, step, remaining, { cwd: root, environment });
    },
    capture: (id) => captureStreams(directory + "/" + id, phaseCheck),
    artifact: async (executable, check) => {
      const s = await lstat2(executable);
      check();
      requireValue(s.isFile() && (s.mode & 73) !== 0, "REGULAR_EXECUTABLE_CPU_ARTIFACT_REQUIRED");
      return { executable, bytes: s.size, sha256: await fileDigest(executable, check) };
    }
  });
  await writeJson(directory + "/receipt.json", receipt);
  console.log(JSON.stringify({ status: receipt.status, failure: receipt.failure, trainingReady: false }));
  process.exitCode = receipt.status === "PASS_CPU39_TESTS_ONLY" ? 0 : 1;
}
async function captureStreams(directory, check = () => {}) {
  const streams = [];
  let stdout = "";
  for (const name of ["stdout", "stderr"]) {
    check();
    const path = directory + "/command." + name, s = await lstat2(path);
    check();
    requireValue(s.isFile() && s.size <= cpuPlan.limits.supervisedStreamBytes, "BOUNDED_CAPTURE_FILE_REQUIRED");
    const bytes = await readFile2(path);
    check();
    requireValue(bytes.length <= cpuPlan.limits.supervisedStreamBytes, "CAPTURE_READ_BOUND");
    streams.push({ path, bytes: bytes.length, sha256: digest(bytes) });
    if (name === "stdout")
      stdout = bytes.toString();
  }
  return { stdout, streams };
}
async function writeJson(path, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + `
`);
  requireValue(bytes.length <= cpuPlan.limits.hostReceiptBytes, "CPU_RECEIPT_BYTE_BOUND");
  await writeFile2(path, bytes, { flag: "wx" });
}
async function runCpuHost(driver) {
  const protection = protectFinalizationSignals(), captures = [], paths = cpuPaths();
  let receipt;
  const epoch = Number(process.env.HOST_CPU39_STARTED_MS), startedAt = performance.now() - (Date.now() - epoch);
  const check = () => {
    requireValue(Number.isSafeInteger(epoch) && epoch > 0 && Date.now() >= epoch && performance.now() < startedAt + cpuPlan.limits.normalOperationsMs, "WHOLE_CPU_HOST_CLOCK_REQUIRED");
    requireValue(!protection.observed(), "CPU_HOST_INTERRUPTED");
  };
  try {
    requireValue(Bun.version === "1.4.0" && process.cwd() === cpuPlan.root && Bun.argv.at(-1) === cpuPlan.grant, "SEPARATE_HUMAN_APPROVAL_AND_PINNED_CPU_HOST_CONTEXT_REQUIRED");
    check();
    for (const helper of cpuPlan.existingHelpers) {
      requireValue(digest(await readFile2(helper.path)) === helper.sha256, "CPU_EXISTING_HELPER_HASH_REQUIRED:" + helper.path);
      check();
    }
    requireValue(digest(await readFile2("Cargo.lock")) === cpuPlan.cargoLockSha256, "CPU_HOST_CARGO_LOCK_REQUIRED");
    check();
    const space = await statfs2(dirname(paths.workspace));
    check();
    requireValue(Number(space.bavail) * Number(space.bsize) >= cpuPlan.limits.minimumFreeBytes, "CPU_INITIAL_64GIB_FREE_REQUIRED");
    for (const path of [paths.bun, paths.retainedNative + "/qualification/source-manifest.json", paths.retainedCargo + "/registry/index", paths.retainedCargo + "/registry/cache"]) {
      const s = await lstat2(path);
      check();
      requireValue(path === paths.bun ? s.isFile() && (s.mode & 73) !== 0 : path.endsWith(".json") ? s.isFile() : s.isDirectory(), "EXISTING_CPU_RETAINED_INPUT_REQUIRED:" + path);
    }
    await mkdir2(paths.workspace);
    check();
    for (const path of [paths.native, paths.cargo, paths.scratch, paths.inner]) {
      await mkdir2(path);
      check();
    }
    for (const path of [paths.cargo + "/registry/index", paths.cargo + "/registry/cache", paths.cargo + "/registry/src", paths.scratch + "/home", paths.scratch + "/tmp", paths.native + "/_work/gpu-owner-recovery/runs/" + cpuPlan.runId]) {
      await mkdir2(path, { recursive: true });
      check();
    }
    await writeFile2(paths.evidence + "/driver.mjs", driver, { flag: "wx" });
    check();
    await writeJson(paths.evidence + "/deadline.json", { normalDeadlineEpoch: epoch + cpuPlan.limits.normalOperationsMs });
    check();
    const { runBounded: bounded } = await import(pathToFileURL(resolve(cpuPlan.existingHelpers[0].path)).href);
    check();
    const environment = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: paths.scratch + "/home", TMPDIR: paths.scratch + "/tmp", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" };
    receipt = await executeCpuHost(paths, process.getuid(), process.getgid(), {
      now: () => performance.now(),
      startedAt,
      run: async (id, argv, ms) => {
        const commandDeadline = performance.now() + ms, directory = paths.evidence + "/" + id;
        await mkdir2(directory);
        const remaining = Math.floor(commandDeadline - performance.now());
        requireValue(remaining > 0, "CPU_DOCKER_COMMAND_SETUP_DEADLINE");
        const result = await bounded(argv, directory, remaining, { cwd: cpuPlan.root, environment });
        const capture = await captureStreams(directory);
        captures.push({ id, streams: capture.streams });
        return { ...result, stdout: capture.stdout };
      },
      recover: async () => {
        try {
          return (await readFile2(paths.evidence + "/worker.cid", "utf8")).trim();
        } catch (error) {
          if (error.code === "ENOENT")
            return null;
          throw error;
        }
      },
      workerReceipt: async () => {
        const s = await lstat2(paths.inner + "/receipt.json");
        requireValue(s.isFile() && s.size <= cpuPlan.limits.hostReceiptBytes, "BOUNDED_CPU_WORKER_RECEIPT_REQUIRED");
        return JSON.parse(await readFile2(paths.inner + "/receipt.json", "utf8"));
      },
      watch: (stop) => {
        const monitor = watchWorkspace({ ...plan_default, limits: { ...plan_default.limits, ...cpuPlan.limits } }, { context: paths.evidence, workspace: paths.workspace, evidence: paths.evidence, native: paths.native, cargo: paths.cargo, bun: paths.bun }, stop, {
          free: async () => {
            const s = await statfs2(paths.workspace);
            return Number(s.bavail) * Number(s.bsize);
          },
          bytes: async () => {
            const workBytes = await treeBytes(paths.workspace), evidenceBytes = await treeBytes(paths.evidence), scratchBytes = await treeBytes(paths.scratch);
            if (evidenceBytes > cpuPlan.limits.evidenceSoftBytes || scratchBytes > cpuPlan.limits.scratchSoftBytes)
              await stop("CPU_EVIDENCE_OR_SCRATCH_SOFT_BOUND");
            return workBytes + evidenceBytes;
          }
        });
        return async () => {
          await monitor.check();
          await monitor.close();
        };
      }
    });
  } catch (error) {
    receipt = { status: "FAIL_HOST_CPU39_PREFLIGHT", failure: errorText(error), hostInvocationsConsumed: 1, remainingHostInvocations: 0, automaticRetryAuthorized: false, trainingReady: false };
  }
  try {
    if (protection.observed() || performance.now() >= startedAt + cpuPlan.limits.overallMs - cpuPlan.limits.receiptReserveMs) {
      receipt.status = "FAIL_HOST_CPU39_ONLY";
      receipt.failure ??= "CPU_HOST_FINALIZATION_SIGNAL_OR_DEADLINE";
    }
    await writeJson(paths.evidence + "/receipt.json", { ...receipt, captures, plan: cpuPlan, finalizationSignalObserved: protection.observed(), receiptStatusRequiresZeroHostMarker: true });
    const passed = receipt.status === "PASS_HOST_CPU39_ONLY" && !protection.observed() && performance.now() < startedAt + cpuPlan.limits.overallMs;
    console.log(JSON.stringify({ status: passed ? receipt.status : "FAIL_HOST_CPU39_ONLY", failure: receipt.failure, receipt: cpuPlan.evidence + "/receipt.json", trainingReady: false }));
    process.exitCode = passed ? 0 : 1;
  } finally {
    protection.release();
  }
}
var quoteFish = (value) => "'" + value.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
async function buildCpuPrograms() {
  const result = await Bun.build({ entrypoints: [resolve(cpuPlan.root, "_work/gpu-owner-recovery/qualification/cpu-host.ts")], target: "bun", minify: false, sourcemap: "none" });
  requireValue(result.success && result.outputs.length === 1, "IN_MEMORY_CPU_JS_BUNDLE_REQUIRED");
  const bundle = await result.outputs[0].text();
  const driver = bundle + `
await runCpuWorker();
`, host = bundle + `
await runCpuHost(` + JSON.stringify(driver) + `);
`;
  requireValue(Buffer.byteLength(host) <= 196608, "BOUNDED_INLINE_CPU_HOST_PROGRAM_REQUIRED");
  return { bundle, driver, host };
}
function renderCpuHostCommand(host) {
  const worker = [
    "set -gx MISE_AUTO_INSTALL false",
    "set -gx MISE_EXEC_AUTO_INSTALL false",
    "set -gx MISE_TASK_RUN_AUTO_INSTALL false",
    "command mise exec core:bun@1.4.0 core:rust@1.95.0 -- bun --no-env-file --no-install --eval " + quoteFish(host) + " -- " + quoteFish(cpuPlan.grant) + " < /dev/null"
  ].join("; ");
  const bounded = "set -gx HOST_CPU39_STARTED_MS (command date +%s%3N); or exit 1; " + worker;
  const parent = [
    "test (pwd -P) = " + quoteFish(cpuPlan.root) + "; or exit 1",
    "set -l evidence " + quoteFish(cpuPlan.evidence),
    'command mkdir -- "$evidence"; or exit 1',
    "command timeout --signal=TERM --kill-after=120s 4080s fish --no-config -c " + quoteFish(bounded) + ' > "$evidence/worker.stdout" 2> "$evidence/worker.stderr"',
    "set -l code $status",
    'for stream in stdout stderr; if test (command wc -c < "$evidence/worker.$stream") -gt 65536; set code 1; end; end',
    `printf '%s\\n' $code > "$evidence/command.exit"; or exit 1`,
    'command cat -- "$evidence/worker.stdout"; command cat -- "$evidence/worker.stderr" >&2',
    'if test -f "$evidence/receipt.json"; command cat -- "$evidence/receipt.json"; end',
    "printf 'HOST_CPU39_EXIT=%s\\n' $code",
    "exit $code"
  ].join("; ");
  return "fish --no-config -c " + quoteFish(parent) + `
`;
}
function cpuApprovalRequest(bindings) {
  return {
    version: "chess-coach.cpu39-host-request.v1",
    status: "UNAPPROVED",
    plan: cpuPlan,
    bindings,
    grantIsIdentityNotAuthority: true,
    separateExplicitHumanApprovalRequired: true,
    reviewedPacketCommitPushRequiredBeforeHostCommand: true,
    requestedOperations: {
      nativeSourceCopies: 66,
      nativeSourceCopyMaximumBytes: 2097152,
      readOnlyRetainedCargoRegistryIndexAndCache: true,
      cargoArchiveUnpackOnlyIntoFreshWritableCargoHome: true,
      offlineCpuCompilations: 2,
      completeCpuHarnesses: 16,
      cpuTests: 39,
      ownedContainerLifecycle: true,
      maximumHostAttemptsIncludingPreflight: 1
    },
    hostExecutionApproved: false,
    stagingAndNativeCompilationApproved: false,
    cargoArchiveUnpackIntoFreshWritableHomeApproved: false,
    cpuRegressionExecutionApproved: false,
    gpuExecutionAuthorized: false,
    llvmExecutionAuthorized: false,
    retainedMutationAuthorized: false,
    oldGrantsReusable: false,
    trainingAuthorized: false,
    publicationAuthorized: false,
    trainingReady: false
  };
}
async function verifyCpuSource(label) {
  requireValue(label === "host-cpu-regression-source-1" && Bun.version === "1.4.0" && process.execPath === "/usr/local/bin/bun" && process.cwd() === cpuPlan.root, "CLOSED_PINNED_CPU_SOURCE_VERIFICATION_REQUIRED");
  const directory = resolve(cpuPlan.root, "_work/gpu-owner-recovery/runs", label);
  await mkdir2(directory);
  await mkdir2(directory + "/home");
  await mkdir2(directory + "/tmp");
  const sources = [
    "_work/gpu-owner-recovery/qualification/cpu-host-plan.json",
    "_work/gpu-owner-recovery/qualification/cpu-host.ts",
    "_work/gpu-owner-recovery/qualification/cpu-host.test.ts",
    ...cpuPlan.existingHelpers.map((row) => row.path),
    cpuPlan.nativeManifestMetadata,
    "tooling/runtime/qualification.ts",
    "tooling/runtime/Dockerfile.gpu-qualification",
    "_work/gpu-owner-recovery/qualification/host-build/plan.json",
    "_work/gpu-owner-recovery/qualification/tsconfig.json",
    "tsconfig.json",
    "package.json",
    "packages/runtime/tests/gpu-qualification.test.ts"
  ];
  const bindings = await Promise.all(sources.map(async (path) => ({ path, sha256: digest(await readFile2(path)) })));
  const results = [];
  let failure = null, sourceChanged = false;
  try {
    validatePlan();
    cpuManifest(await readFile2(cpuPlan.nativeManifestMetadata));
    for (const helper of cpuPlan.existingHelpers)
      requireValue(bindings.find((row) => row.path === helper.path)?.sha256 === helper.sha256, "SOURCE_HELPER_HASH_REQUIRED");
    const { driver, host } = await buildCpuPrograms();
    for (const [name, text] of [["driver.mjs", driver], ["host.mjs", host], ["canonical-host-command.fish", renderCpuHostCommand(host)]])
      await writeFile2(directory + "/" + name, text, { flag: "wx" });
    const programs = await Promise.all(["driver.mjs", "host.mjs", "canonical-host-command.fish"].map(async (name) => ({ path: relative(cpuPlan.root, directory + "/" + name), sha256: digest(await readFile2(directory + "/" + name)) })));
    await writeJson(directory + "/plan.json", cpuPlan);
    await writeJson(directory + "/bindings.json", { sources: bindings, programs });
    await writeJson(directory + "/request.json", cpuApprovalRequest({ sources: bindings, programs }));
    const { runBounded: bounded } = await import(pathToFileURL(resolve(cpuPlan.root, cpuPlan.existingHelpers[0].path)).href);
    const environment = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: directory + "/home", TMPDIR: directory + "/tmp", NO_COLOR: "1", CPU_SOURCE_PACKET: directory };
    const commands = [
      { id: "unit-and-mock-e2e", argv: ["/usr/local/bin/bun", "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/cpu-host.test.ts"] },
      { id: "frozen-cpu-contract", argv: ["/usr/local/bin/bun", "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-qualification.test.ts", "--test-name-pattern", "CPU coverage|CPU and GPU artifacts|artifact admission|only compiler artifacts|compiled policy subprocess|CPU runner|capture failure"] },
      { id: "types", argv: ["/usr/local/bin/bun", "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "_work/gpu-owner-recovery/qualification/tsconfig.json"] }
    ];
    for (const command of commands) {
      const step = directory + "/" + command.id;
      await mkdir2(step);
      const result = await bounded(command.argv, step, 120000, { cwd: cpuPlan.root, environment });
      const capture = await captureStreams(step);
      results.push({ ...command, ...result, streams: capture.streams });
      requireValue(result.status === "PASS" && result.exitCode === 0 && result.failure === null, "CPU_SOURCE_VERIFICATION_FAILED:" + command.id);
    }
    const mock = JSON.parse(await readFile2(directory + "/mock-e2e.json", "utf8"));
    requireValue(mock.status === "PASS_MOCK_CPU39_ONLY" && mock.actualHostExecuted === false && mock.tests === 39 && mock.harnesses === 16, "PERSISTED_MOCK_CPU39_E2E_REQUIRED");
  } catch (error) {
    failure = errorText(error);
  }
  try {
    sourceChanged = (await Promise.all(bindings.map(async (row) => digest(await readFile2(row.path)) !== row.sha256))).some(Boolean);
  } catch {
    sourceChanged = true;
  }
  const receipt = {
    version: "chess-coach.cpu39-source.v1",
    status: failure === null && !sourceChanged ? "PASS_SOURCE_ONLY" : "FAIL_SOURCE_ONLY",
    failure,
    sourceChanged,
    bindings,
    results,
    actualHostExecuted: false,
    cargoInvocations: 0,
    rustcInvocations: 0,
    llvmInvocations: 0,
    dockerInvocations: 0,
    gpuInvocations: 0,
    downloadsPerformed: false,
    compilationPerformed: false,
    mockExecutionOnly: true,
    hostExecutionApproved: false,
    trainingReady: false
  };
  await writeJson(directory + "/receipt.json", receipt);
  console.log(JSON.stringify({ status: receipt.status, failure, receipt: relative(cpuPlan.root, directory + "/receipt.json"), trainingReady: false }));
  process.exitCode = receipt.status === "PASS_SOURCE_ONLY" ? 0 : 1;
}
if (import.meta.main && Bun.argv[2] === "--verify-source") {
  requireValue(Bun.argv.length === 4, "CLOSED_CPU_SOURCE_ARGUMENTS_REQUIRED");
  await verifyCpuSource(Bun.argv[3]);
}
export {
  acceptCpuWorker,
  buildCpuPrograms,
  cpuApprovalRequest,
  cpuBuildCommands,
  cpuManifest,
  cpuPaths,
  cpuPlan,
  cpuWorkerCreate,
  digest,
  executeCpuHost,
  executeCpuWorker,
  renderCpuHostCommand,
  runCpuHost,
  runCpuWorker,
  stageCpuSources,
  validatePlan,
  verifyCpuSource
};

await runCpuWorker();
