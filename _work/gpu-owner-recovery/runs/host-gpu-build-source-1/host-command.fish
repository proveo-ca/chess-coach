fish --no-config -c 'set -l evidence \'_work/gpu-owner-recovery/runs/host-gpu-native-build-1\'; command mkdir -- "$evidence"; or exit 1; command timeout --signal=TERM --kill-after=120s 4080s fish --no-config -c \'set -l program \\\'set -gx MISE_AUTO_INSTALL false; set -gx MISE_EXEC_AUTO_INSTALL false; set -gx MISE_TASK_RUN_AUTO_INSTALL false; command mise exec core:bun@1.4.0 core:rust@1.95.0 -- bun --no-env-file --no-install --eval \\\\\\\'import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, statfs, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const requireValue = (value, label) => {
  if (!value)
    throw Error(label);
};
export const docker = (p, ...argv) => ["docker", "--host=" + p.engine, ...argv];
const mount = (source, target, readonly = !1) => {
  requireValue(source.startsWith("/") && !source.includes(","), "ABSOLUTE_COMMA_FREE_MOUNT_SOURCE_REQUIRED");
  return `type=bind,source=${source},target=${target}${readonly ? ",readonly" : ""}`;
};
export function workerCreate(p, paths, uid, gid) {
  requireValue(Number.isSafeInteger(uid) && uid >= 0 && Number.isSafeInteger(gid) && gid >= 0, "NUMERIC_OPERATOR_UID_GID_REQUIRED");
  const environment = {
    CARGO_HOME: "/capture/cargo-home",
    CARGO_TARGET_DIR: "/build/native/target-gpu",
    CARGO_BUILD_JOBS: "2",
    RAYON_NUM_THREADS: "2",
    XDG_DATA_HOME: "/opt/tracel-data",
    CUDARC_CUDA_VERSION: p.cudaBindingTrial,
    CARGO_NET_OFFLINE: "true",
    CARGO_NET_RETRY: "0",
    RUSTUP_AUTO_INSTALL: "0",
    HOME: "/build/native/_work/gpu-owner-recovery/scratch/home",
    TMPDIR: "/build/native/_work/gpu-owner-recovery/scratch/tmp"
  };
  return docker(p, "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=" + uid + ":" + gid, "--cidfile=" + paths.evidence + "/worker.cid", "--label=chess-coach.native-build=" + p.runId, "--workdir=/build/native", "--entrypoint=/usr/local/bin/bun", ...[
    [paths.context, "/received", !0],
    [paths.native, "/build/native", !1],
    [paths.cargo, "/capture/cargo-home", !1],
    [paths.context + "/gpu-build/llvm", "/opt/tracel-data/tracel/tracel-llvm-23.1.0-4", !0],
    [paths.bun, "/usr/local/bin/bun", !0],
    [paths.evidence, "/evidence", !0],
    [paths.evidence + "/native", "/build/native/_work/gpu-owner-recovery/runs/" + p.runId, !1]
  ].flatMap(([source, target, ro]) => ["--mount", mount(source, target, ro)]), ...Object.entries(environment).flatMap(([key, value]) => ["--env", key + "=" + value]), p.rustImage, "--no-env-file", "--no-install", "/evidence/build-driver.mjs");
}
export async function executeBuild(p, paths, uid, gid, io) {
  const started = io.now(), normalDeadline = started + p.limits.normalOperationsMs, cleanupDeadline = started + p.limits.overallMs - p.limits.receiptReserveMs, results = [], cleanupFailures = [], ids = { donor: null, worker: null };
  let failure = null, native = null, state = null, artifacts = [], stopPromise = null;
  const used = new Set, operation = async (id, argv, maximumMs, cleanup = !1) => {
    requireValue(cleanup || failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
    requireValue(!used.has(id) && used.size < p.maximums.dockerOperations, "CLOSED_DOCKER_OPERATION_BUDGET");
    const ms = Math.floor(Math.min(maximumMs, (cleanup ? cleanupDeadline : normalDeadline) - io.now()));
    requireValue(ms > 0, "HOST_BUILD_DEADLINE");
    used.add(id);
    const entry = { id, argv, status: "STARTED" };
    results.push(entry);
    try {
      const out = await io.run(id, argv, ms);
      Object.assign(entry, out);
      requireValue(out.status === "PASS" && out.exitCode === 0 && out.failure === null, "DOCKER_OPERATION_FAILED:" + id);
      return out.stdout.trim();
    } catch (error) {
      Object.assign(entry, { status: "FAIL", failure: error instanceof Error ? error.message : "DOCKER_OPERATION_FAILED" });
      throw error;
    }
  }, recover = async () => {
    const errors = [];
    for (const kind of ["donor", "worker"])
      try {
        const value = await io.recover(kind);
        if (value !== null) {
          requireValue(/^[a-f0-9]{64}$/.test(value) && (ids[kind] === null || ids[kind] === value), "OWNED_CONTAINER_ID_REQUIRED");
          ids[kind] = value;
        }
      } catch (error) {
        errors.push(error);
      }
    if (errors.length)
      throw Error("OWNED_CONTAINER_ID_RECOVERY_FAILED");
  }, stopWorker = () => stopPromise ??= (async () => {
    if (!ids.worker)
      return;
    try {
      await operation("worker-stop", docker(p, "stop", "--time=10", ids.worker), 20000, !0);
    } catch (error) {
      cleanupFailures.push(String(error));
      try {
        await operation("worker-kill", docker(p, "kill", "--signal=KILL", ids.worker), 15000, !0);
      } catch (killError) {
        cleanupFailures.push(String(killError));
      }
    }
  })(), unwatch = io.watch(async (reason) => {
    failure ??= reason;
    if (ids.worker)
      await stopWorker();
  });
  try {
    await operation("donor-create", docker(p, "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cidfile=" + paths.evidence + "/donor.cid", "--label=chess-coach.native-build=" + p.runId, p.bunImage), p.limits.dockerCommandMs);
    await recover();
    requireValue(ids.donor, "OWNED_DONOR_ID_REQUIRED");
    await operation("bun-copy", docker(p, "cp", "-L", ids.donor + ":/usr/local/bin/bun", paths.bun), p.limits.dockerCommandMs);
    await io.validateBun();
    requireValue(failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
    await operation("worker-create", workerCreate(p, paths, uid, gid), p.limits.dockerCommandMs);
    await recover();
    requireValue(ids.worker, "OWNED_WORKER_ID_REQUIRED");
    requireValue(failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
    await operation("worker-attach", docker(p, "start", "--attach", ids.worker), p.limits.nativeWorkMs);
    native = await io.nativeReceipt();
    requireValue(native?.status === "PASS_NATIVE_COMPILATION_ONLY" && native.compilationAttempts === 2 && native.sourceChanged === !1, "SUCCESSFUL_NATIVE_COMPILATION_RECEIPT_REQUIRED");
    requireValue(failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
  } catch (error) {
    failure ??= error instanceof Error ? error.message : "HOST_BUILD_FAILED";
  } finally {
    try {
      await recover();
    } catch (error) {
      cleanupFailures.push(String(error));
    }
    if (ids.worker) {
      if (failure !== null)
        await stopWorker();
      try {
        state = JSON.parse(await operation("worker-state", docker(p, "container", "inspect", "--format", "{{json .State}}", ids.worker), 1e4, !0));
        requireValue(state.Running === !1 && state.ExitCode === 0 && state.OOMKilled === !1, "SUCCESSFUL_TERMINAL_CONTAINER_STATE_REQUIRED");
        if (failure === null) {
          artifacts = await io.artifacts();
          requireValue(artifacts.length === 5 && io.now() < cleanupDeadline, "COMPLETE_ARTIFACTS_WITHIN_DEADLINE_REQUIRED");
        }
      } catch (error) {
        failure ??= error instanceof Error ? error.message : "TERMINAL_BUILD_VALIDATION_FAILED";
        await stopWorker();
      }
    }
    native ??= await io.nativeReceipt().catch(() => null);
    for (const kind of ["worker", "donor"])
      if (ids[kind])
        try {
          await operation(kind + "-remove", docker(p, "rm", ids[kind]), 20000, !0);
        } catch (error) {
          cleanupFailures.push(String(error));
        }
    unwatch();
  }
  return {
    version: "chess-coach.owned-container-native-build.v1",
    status: failure === null && cleanupFailures.length === 0 ? "PASS_HOST_GPU_NATIVE_BUILD_ONLY" : "FAIL_HOST_GPU_NATIVE_BUILD_ONLY",
    failure,
    cleanupFailures,
    method: p.method,
    requestedResources: p.resources,
    limits: p.limits,
    ids,
    state,
    nativeReceipt: native,
    artifacts,
    results,
    elapsedMs: io.now() - started,
    hostInvocationsConsumed: 1,
    remainingHostInvocations: 0,
    automaticRetryAuthorized: !1,
    qualificationImageBuilt: !1,
    testsExecuted: !1,
    gpuDevicesRequested: !1,
    gpuExecuted: !1,
    trainingReady: !1
  };
}
export async function treeBytes(path) {
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: !0 })) {
    const child = path + "/" + entry.name;
    total += entry.isDirectory() ? await treeBytes(child) : (await lstat(child)).size;
  }
  return total;
}
export async function runHostBuild(p, driver) {
  requireValue(Bun.version === "1.4.0" && Bun.argv.at(-1) === p.grant, "FRESH_PINNED_HOST_BUILD_CONTEXT_REQUIRED");
  const root = resolve(process.cwd()), evidence = resolve(p.evidence), workspace = resolve(p.workspace), context = resolve(p.context), paths = { context, evidence, workspace, native: workspace + "/native", cargo: workspace + "/cargo-home", bun: workspace + "/bun" }, hash = (bytes) => createHash("sha256").update(bytes).digest("hex"), captures = [];
  let receipt;
  try {
    for (const helper of p.existingHelpers)
      requireValue(hash(await readFile(helper.path)) === helper.sha256, "EXISTING_HOST_HELPER_MISMATCH:" + helper.path);
    requireValue(hash(await readFile("Cargo.lock")) === "77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955", "HOST_REPOSITORY_CONTEXT_REQUIRED");
    const free = await statfs(dirname(workspace));
    requireValue(Number(free.bavail) * Number(free.bsize) >= p.limits.minimumFreeBytes, "INITIAL_FREE_DISK_REQUIRED");
    await mkdir(workspace);
    await mkdir(paths.native);
    await mkdir(paths.cargo);
    await mkdir(evidence + "/native");
    await mkdir(paths.native + "/_work/gpu-owner-recovery/runs/" + p.runId, { recursive: !0 });
    await writeFile(evidence + "/build-driver.mjs", driver, { flag: "wx" });
    const { runBounded } = await import(pathToFileURL(resolve(p.existingHelpers[0].path)).href), environment = Object.fromEntries(Object.entries(process.env).filter((row) => row[1] !== void 0));
    delete environment.DOCKER_CONTEXT;
    receipt = await executeBuild(p, paths, process.getuid(), process.getgid(), {
      now: () => performance.now(),
      run: async (id, argv, ms) => {
        const step = evidence + "/" + id;
        await mkdir(step);
        const result = await runBounded(argv, step, ms, { cwd: root, environment }), streams = [];
        for (const stream of ["stdout", "stderr"]) {
          const path = step + "/command." + stream, bytes = await readFile(path);
          streams.push({ path, bytes: bytes.length, sha256: hash(bytes) });
        }
        captures.push({ id, streams });
        return { ...result, stdout: await readFile(step + "/command.stdout", "utf8") };
      },
      recover: async (kind) => {
        try {
          return (await readFile(evidence + "/" + kind + ".cid", "utf8")).trim();
        } catch (error) {
          if (error.code === "ENOENT")
            return null;
          throw error;
        }
      },
      validateBun: async () => {
        const s = await lstat(paths.bun);
        requireValue(s.isFile() && s.size > 0 && s.size <= p.limits.bunPostCopyBytes && (s.mode & 73) !== 0, "COPIED_BUN_FILE_ADMISSION_FAILED");
      },
      nativeReceipt: async () => JSON.parse(await readFile(evidence + "/native/receipt.json", "utf8")),
      artifacts: async () => {
        const { readArtifacts } = await import(pathToFileURL(context + "/qualification-tools/tooling/runtime/qualification.ts").href), logs = { learning: await readFile(paths.native + "/qualification/gpu-learning.stdout", "utf8"), "policy-io": await readFile(paths.native + "/qualification/gpu-policy.stdout", "utf8") }, chosen = readArtifacts(logs, "gpu"), artifacts = [];
        for (const executable of new Set([...Array.from(chosen.artifacts.values()).map((row) => row.executable), ...chosen.binaries.values()])) {
          const path = paths.native + executable.slice(13), s = await lstat(path);
          requireValue(s.isFile() && (s.mode & 73) !== 0, "BUILT_EXECUTABLE_FILE_REQUIRED");
          const digest = createHash("sha256"), file = Bun.file(path);
          for await (const chunk of file.stream())
            digest.update(chunk);
          artifacts.push({ executable, path, bytes: s.size, sha256: digest.digest("hex") });
        }
        return artifacts;
      },
      watch: (stop) => {
        let pending = !1;
        const interrupt = () => {
          stop("HOST_BUILD_INTERRUPTED");
        };
        process.on("SIGTERM", interrupt);
        process.on("SIGINT", interrupt);
        const timer = setInterval(() => {
          if (pending)
            return;
          pending = !0;
          (async () => {
            const space = await statfs(workspace);
            if (Number(space.bavail) * Number(space.bsize) < p.limits.minimumRunningFreeBytes || await treeBytes(workspace) + await treeBytes(evidence) > p.limits.workspaceSoftBytes)
              await stop("WORKSPACE_SOFT_LIMIT_OR_FREE_SPACE");
          })().catch(() => stop("WORKSPACE_MONITOR_FAILED")).finally(() => {
            pending = !1;
          });
        }, 5000);
        return () => {
          clearInterval(timer);
          process.off("SIGTERM", interrupt);
          process.off("SIGINT", interrupt);
        };
      }
    });
  } catch (error) {
    receipt = { status: "FAIL_HOST_BUILD_PREFLIGHT", failure: error instanceof Error ? error.message : "HOST_BUILD_FAILED", hostInvocationsConsumed: 1, remainingHostInvocations: 0, automaticRetryAuthorized: !1, qualificationImageBuilt: !1, gpuExecuted: !1, testsExecuted: !1, trainingReady: !1 };
  }
  const bytes = Buffer.from(JSON.stringify({
    ...receipt,
    captures,
    workspace: p.workspace,
    evidence: p.evidence,
    workspaceIsFilesystemQuota: !1,
    dockerWritableLayerIncludedInWorkspaceAccounting: !1,
    bunCopyHasOnlyPostCopySizeCheck: !0,
    parentDiagnosticsHaveOnlyPostExitSoftSizeCheck: !0
  }, null, 2) + `
`);
  requireValue(bytes.length <= p.limits.hostReceiptBytes, "HOST_BUILD_RECEIPT_SIZE_LIMIT");
  await writeFile(evidence + "/receipt.json", bytes, { flag: "wx" });
  console.log(JSON.stringify({ status: receipt.status, failure: receipt.failure, receipt: p.evidence + "/receipt.json", trainingReady: !1 }));
  process.exitCode = receipt.status === "PASS_HOST_GPU_NATIVE_BUILD_ONLY" ? 0 : 1;
}

await runHostBuild({"version":"chess-coach.owned-container-native-build-proposal.v1","status":"SOURCE_ONLY_AWAITING_EXPLICIT_BUILD_METHOD_AND_HOST_APPROVAL","method":"OWNED_DOCKER_CONTAINER_NATIVE_BUILD_ONLY_NOT_QUALIFICATION_IMAGE_BUILD","runId":"host-gpu-native-build-1","grant":"--approved-host-gpu-native-build-1","context":"_work/gpu-owner-recovery/cache/host-receive-2/context","workspace":"_work/gpu-owner-recovery/cache/host-gpu-native-build-1","evidence":"_work/gpu-owner-recovery/runs/host-gpu-native-build-1","engine":"unix:///var/run/docker.sock","rustImage":"docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb","bunImage":"docker.io/oven/bun@sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038","sourceManifestSha256":"9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863","existingHelpers":[{"path":"_work/gpu-owner-recovery/verify.ts","sha256":"9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58"},{"path":"_work/gpu-owner-recovery/command-supervisor.ts","sha256":"88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6"}],"cudaBindingTrial":"13000","resources":{"cpus":2,"memoryBytes":8589934592,"memoryPlusSwapBytes":8589934592,"cargoJobs":2,"rayonThreads":2,"uidGid":"CURRENT_OPERATOR_NUMERIC_UID_GID"},"limits":{"overallMs":4200000,"normalOperationsMs":4020000,"nativeWorkMs":3600000,"cleanupMs":120000,"receiptReserveMs":60000,"dockerCommandMs":120000,"minimumFreeBytes":68719476736,"minimumRunningFreeBytes":17179869184,"workspaceSoftBytes":34359738368,"stagingBytes":536870912,"stagingFiles":3800,"bunPostCopyBytes":134217728,"supervisedStreamBytes":4194304,"hostDockerStreamsBytes":75497472,"nativeStreamsBytes":41943040,"canonicalLogCopiesBytes":16777216,"hostReceiptBytes":2097152},"maximums":{"donorCreates":1,"donorStarts":0,"bunCopies":1,"workerCreates":1,"workerStarts":1,"terminalInspections":1,"workerStops":1,"workerKills":1,"containerRemovals":2,"dockerOperations":9,"cargoCompilations":2},"hostExecutionApproved":false,"stagingAndNativeCompilationApproved":false,"qualificationImageBuildAuthorized":false,"sharedBuilderModificationAuthorized":false,"imagePullOrDependencyFetchAuthorized":false,"gpuExecutionAuthorized":false,"trainingAuthorized":false,"automaticRetryAuthorized":false,"sourcePublicationRequired":false,"helperDownloads":0,"trainingReady":false},"import { constants } from \\\\\\\\\\\\\\\\"node:fs\\\\\\\\\\\\\\\\";\\\\\\\\\\\\\\\\nimport { copyFile, lstat, mkdir, readFile, readdir, writeFile } from \\\\\\\\\\\\\\\\"node:fs/promises\\\\\\\\\\\\\\\\";\\\\\\\\\\\\\\\\nimport { createHash } from \\\\\\\\\\\\\\\\"node:crypto\\\\\\\\\\\\\\\\";\\\\\\\\\\\\\\\\nimport { pathToFileURL } from \\\\\\\\\\\\\\\\"node:url\\\\\\\\\\\\\\\\";\\\\\\\\\\\\\\\\nconst requireValue = (value, label) => {\\\\\\\\\\\\\\\\n  if (!value)\\\\\\\\\\\\\\\\n    throw Error(label);\\\\\\\\\\\\\\\\n};\\\\\\\\\\\\\\\\nexport function nativeCommands() {\\\\\\\\\\\\\\\\n  return [\\\\\\\\\\\\\\\\n    { id: \\\\\\\\\\\\\\\\"rustc-version\\\\\\\\\\\\\\\\", argv: [\\\\\\\\\\\\\\\\"rustc\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"--version\\\\\\\\\\\\\\\\"], version: /^rustc 1\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\.95\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\.0 / },\\\\\\\\\\\\\\\\n    { id: \\\\\\\\\\\\\\\\"cargo-version\\\\\\\\\\\\\\\\", argv: [\\\\\\\\\\\\\\\\"cargo\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"--version\\\\\\\\\\\\\\\\"], version: /^cargo 1\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\.95\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\.0 / },\\\\\\\\\\\\\\\\n    { id: \\\\\\\\\\\\\\\\"llvm-version\\\\\\\\\\\\\\\\", argv: [\\\\\\\\\\\\\\\\"/opt/tracel-data/tracel/tracel-llvm-23.1.0-4/bin/llvm-config\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"--version\\\\\\\\\\\\\\\\"], version: /^23\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\.1\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\.0\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\s*$/ },\\\\\\\\\\\\\\\\n    ...[[\\\\\\\\\\\\\\\\"gpu-learning\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"chess-coach-learning\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"finite_difference\\\\\\\\\\\\\\\\"], [\\\\\\\\\\\\\\\\"gpu-policy\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"chess-coach-policy-io\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"gpu\\\\\\\\\\\\\\\\"]].map(([id, pkg, target]) => ({ id, argv: [\\\\\\\\\\\\\\\\"cargo\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"test\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"--release\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"--target\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"x86_64-unknown-linux-gnu\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"--locked\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"--offline\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"--jobs\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"2\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"-p\\\\\\\\\\\\\\\\", pkg, \\\\\\\\\\\\\\\\"--features\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"gpu-prepared-llvm\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"--test\\\\\\\\\\\\\\\\", target, \\\\\\\\\\\\\\\\"--no-run\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"--message-format=json\\\\\\\\\\\\\\\\"], version: null }))\\\\\\\\\\\\\\\\n  ];\\\\\\\\\\\\\\\\n}\\\\\\\\\\\\\\\\nexport async function stageTree(source, destination, budget, p, remaining) {\\\\\\\\\\\\\\\\n  remaining();\\\\\\\\\\\\\\\\n  await mkdir(destination, { recursive: !0 });\\\\\\\\\\\\\\\\n  for (const entry of await readdir(source, { withFileTypes: !0 })) {\\\\\\\\\\\\\\\\n    remaining();\\\\\\\\\\\\\\\\n    const from = source + \\\\\\\\\\\\\\\\"/\\\\\\\\\\\\\\\\" + entry.name, to = destination + \\\\\\\\\\\\\\\\"/\\\\\\\\\\\\\\\\" + entry.name;\\\\\\\\\\\\\\\\n    if (entry.isDirectory())\\\\\\\\\\\\\\\\n      await stageTree(from, to, budget, p, remaining);\\\\\\\\\\\\\\\\n    else {\\\\\\\\\\\\\\\\n      const stat = await lstat(from);\\\\\\\\\\\\\\\\n      requireValue(stat.isFile(), \\\\\\\\\\\\\\\\"STAGING_REGULAR_FILE_REQUIRED\\\\\\\\\\\\\\\\");\\\\\\\\\\\\\\\\n      budget.bytes += stat.size;\\\\\\\\\\\\\\\\n      budget.files++;\\\\\\\\\\\\\\\\n      requireValue(budget.bytes <= p.limits.stagingBytes && budget.files <= p.limits.stagingFiles, \\\\\\\\\\\\\\\\"STAGING_BUDGET\\\\\\\\\\\\\\\\");\\\\\\\\\\\\\\\\n      await copyFile(from, to, constants.COPYFILE_EXCL);\\\\\\\\\\\\\\\\n    }\\\\\\\\\\\\\\\\n  }\\\\\\\\\\\\\\\\n}\\\\\\\\\\\\\\\\nexport async function runNativeBuild(p) {\\\\\\\\\\\\\\\\n  const root = \\\\\\\\\\\\\\\\"/build/native\\\\\\\\\\\\\\\\", directory = root + \\\\\\\\\\\\\\\\"/_work/gpu-owner-recovery/runs/\\\\\\\\\\\\\\\\" + p.runId, started = performance.now(), deadline = started + p.limits.nativeWorkMs, remaining = () => {\\\\\\\\\\\\\\\\n    const ms = Math.floor(deadline - performance.now() - 30000);\\\\\\\\\\\\\\\\n    requireValue(ms > 0, \\\\\\\\\\\\\\\\"NATIVE_BUILD_DEADLINE\\\\\\\\\\\\\\\\");\\\\\\\\\\\\\\\\n    return ms;\\\\\\\\\\\\\\\\n  }, budget = { bytes: 0, files: 0 }, results = [];\\\\\\\\\\\\\\\\n  let stage = \\\\\\\\\\\\\\\\"startup\\\\\\\\\\\\\\\\", failure = null, sourceChanged = !1, compilationAttempts = 0, inventory = null;\\\\\\\\\\\\\\\\n  const hash = (bytes) => createHash(\\\\\\\\\\\\\\\\"sha256\\\\\\\\\\\\\\\\").update(bytes).digest(\\\\\\\\\\\\\\\\"hex\\\\\\\\\\\\\\\\");\\\\\\\\\\\\\\\\n  await mkdir(directory, { recursive: !0 });\\\\\\\\\\\\\\\\n  try {\\\\\\\\\\\\\\\\n    requireValue(process.cwd() === root && Bun.version === \\\\\\\\\\\\\\\\"1.4.0\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"NATIVE_BUN_CONTEXT_REQUIRED\\\\\\\\\\\\\\\\");\\\\\\\\\\\\\\\\n    stage = \\\\\\\\\\\\\\\\"staging\\\\\\\\\\\\\\\\";\\\\\\\\\\\\\\\\n    for (const [source, target] of [[\\\\\\\\\\\\\\\\"/received/current-native\\\\\\\\\\\\\\\\", root], [\\\\\\\\\\\\\\\\"/received/qualification-tools\\\\\\\\\\\\\\\\", root], [\\\\\\\\\\\\\\\\"/received/cargo-home\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"/capture/cargo-home\\\\\\\\\\\\\\\\"]])\\\\\\\\\\\\\\\\n      await stageTree(source, target, budget, p, remaining);\\\\\\\\\\\\\\\\n    for (const path of [\\\\\\\\\\\\\\\\"home\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"tmp\\\\\\\\\\\\\\\\"])\\\\\\\\\\\\\\\\n      await mkdir(root + \\\\\\\\\\\\\\\\"/_work/gpu-owner-recovery/scratch/\\\\\\\\\\\\\\\\" + path, { recursive: !0 });\\\\\\\\\\\\\\\\n    const { runBounded } = await import(pathToFileURL(root + \\\\\\\\\\\\\\\\"/_work/gpu-owner-recovery/verify.ts\\\\\\\\\\\\\\\\").href), { sourceInventory } = await import(pathToFileURL(root + \\\\\\\\\\\\\\\\"/tooling/runtime/qualification.ts\\\\\\\\\\\\\\\\").href), sourceBytes = await readFile(root + \\\\\\\\\\\\\\\\"/qualification/source-manifest.json\\\\\\\\\\\\\\\\");\\\\\\\\\\\\\\\\n    inventory = await sourceInventory(root);\\\\\\\\\\\\\\\\n    requireValue(hash(sourceBytes) === p.sourceManifestSha256 && JSON.stringify(JSON.parse(sourceBytes.toString())) === JSON.stringify(inventory), \\\\\\\\\\\\\\\\"NATIVE_SOURCE_GENERATION_REQUIRED\\\\\\\\\\\\\\\\");\\\\\\\\\\\\\\\\n    const environment = Object.fromEntries(Object.entries(process.env).filter((row) => row[1] !== void 0));\\\\\\\\\\\\\\\\n    for (const command of nativeCommands()) {\\\\\\\\\\\\\\\\n      stage = command.version ? \\\\\\\\\\\\\\\\"version-guard\\\\\\\\\\\\\\\\" : \\\\\\\\\\\\\\\\"compilation\\\\\\\\\\\\\\\\";\\\\\\\\\\\\\\\\n      const step = directory + \\\\\\\\\\\\\\\\"/\\\\\\\\\\\\\\\\" + command.id;\\\\\\\\\\\\\\\\n      await mkdir(step);\\\\\\\\\\\\\\\\n      const ms = Math.min(remaining(), command.version ? 1e4 : p.limits.nativeWorkMs);\\\\\\\\\\\\\\\\n      if (!command.version)\\\\\\\\\\\\\\\\n        compilationAttempts++;\\\\\\\\\\\\\\\\n      const result = await runBounded(command.argv, step, ms, { cwd: root, environment }), streams = [];\\\\\\\\\\\\\\\\n      for (const stream of [\\\\\\\\\\\\\\\\"stdout\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"stderr\\\\\\\\\\\\\\\\"]) {\\\\\\\\\\\\\\\\n        const path = step + \\\\\\\\\\\\\\\\"/command.\\\\\\\\\\\\\\\\" + stream, bytes = await readFile(path);\\\\\\\\\\\\\\\\n        streams.push({ path, bytes: bytes.length, sha256: hash(bytes) });\\\\\\\\\\\\\\\\n        if (!command.version)\\\\\\\\\\\\\\\\n          await copyFile(path, root + \\\\\\\\\\\\\\\\"/qualification/\\\\\\\\\\\\\\\\" + command.id + \\\\\\\\\\\\\\\\".\\\\\\\\\\\\\\\\" + stream, constants.COPYFILE_EXCL);\\\\\\\\\\\\\\\\n      }\\\\\\\\\\\\\\\\n      results.push({ id: command.id, argv: command.argv, ...result, streams });\\\\\\\\\\\\\\\\n      requireValue(result.status === \\\\\\\\\\\\\\\\"PASS\\\\\\\\\\\\\\\\" && result.exitCode === 0, \\\\\\\\\\\\\\\\"NATIVE_COMMAND_FAILED:\\\\\\\\\\\\\\\\" + command.id);\\\\\\\\\\\\\\\\n      if (command.version)\\\\\\\\\\\\\\\\n        requireValue(command.version.test(await readFile(step + \\\\\\\\\\\\\\\\"/command.stdout\\\\\\\\\\\\\\\\", \\\\\\\\\\\\\\\\"utf8\\\\\\\\\\\\\\\\")), \\\\\\\\\\\\\\\\"NATIVE_VERSION_MISMATCH:\\\\\\\\\\\\\\\\" + command.id);\\\\\\\\\\\\\\\\n    }\\\\\\\\\\\\\\\\n    sourceChanged = JSON.stringify(await sourceInventory(root)) !== JSON.stringify(inventory);\\\\\\\\\\\\\\\\n    requireValue(!sourceChanged, \\\\\\\\\\\\\\\\"NATIVE_SOURCE_CHANGED\\\\\\\\\\\\\\\\");\\\\\\\\\\\\\\\\n    remaining();\\\\\\\\\\\\\\\\n    stage = \\\\\\\\\\\\\\\\"complete\\\\\\\\\\\\\\\\";\\\\\\\\\\\\\\\\n  } catch (error) {\\\\\\\\\\\\\\\\n    failure = error instanceof Error ? error.message : \\\\\\\\\\\\\\\\"NATIVE_BUILD_FAILED\\\\\\\\\\\\\\\\";\\\\\\\\\\\\\\\\n  }\\\\\\\\\\\\\\\\n  const receipt = {\\\\\\\\\\\\\\\\n    status: failure === null ? \\\\\\\\\\\\\\\\"PASS_NATIVE_COMPILATION_ONLY\\\\\\\\\\\\\\\\" : \\\\\\\\\\\\\\\\"FAIL_NATIVE_COMPILATION_ONLY\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\n    failure,\\\\\\\\\\\\\\\\n    stage,\\\\\\\\\\\\\\\\n    bunVersion: Bun.version,\\\\\\\\\\\\\\\\n    staging: budget,\\\\\\\\\\\\\\\\n    compilationAttempts,\\\\\\\\\\\\\\\\n    results,\\\\\\\\\\\\\\\\n    sourceChanged,\\\\\\\\\\\\\\\\n    sourceManifestSha256: p.sourceManifestSha256,\\\\\\\\\\\\\\\\n    elapsedMs: performance.now() - started,\\\\\\\\\\\\\\\\n    qualificationImageBuilt: !1,\\\\\\\\\\\\\\\\n    testsExecuted: !1,\\\\\\\\\\\\\\\\n    gpuExecuted: !1,\\\\\\\\\\\\\\\\n    trainingReady: !1\\\\\\\\\\\\\\\\n  };\\\\\\\\\\\\\\\\n  await writeFile(directory + \\\\\\\\\\\\\\\\"/receipt.json\\\\\\\\\\\\\\\\", JSON.stringify(receipt, null, 2) + `\\\\\\\\\\\\\\\\n`, { flag: \\\\\\\\\\\\\\\\"wx\\\\\\\\\\\\\\\\" });\\\\\\\\\\\\\\\\n  console.log(JSON.stringify({ status: receipt.status, failure, stage, receipt: directory + \\\\\\\\\\\\\\\\"/receipt.json\\\\\\\\\\\\\\\\", trainingReady: !1 }));\\\\\\\\\\\\\\\\n  process.exitCode = failure === null ? 0 : 1;\\\\\\\\\\\\\\\\n}\\\\\\\\\\\\\\\\n\\\\\\\\\\\\\\\\nawait runNativeBuild({\\\\\\\\\\\\\\\\"version\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"chess-coach.owned-container-native-build-proposal.v1\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"status\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"SOURCE_ONLY_AWAITING_EXPLICIT_BUILD_METHOD_AND_HOST_APPROVAL\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"method\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"OWNED_DOCKER_CONTAINER_NATIVE_BUILD_ONLY_NOT_QUALIFICATION_IMAGE_BUILD\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"runId\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"host-gpu-native-build-1\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"grant\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"--approved-host-gpu-native-build-1\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"context\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"_work/gpu-owner-recovery/cache/host-receive-2/context\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"workspace\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"_work/gpu-owner-recovery/cache/host-gpu-native-build-1\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"evidence\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"_work/gpu-owner-recovery/runs/host-gpu-native-build-1\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"engine\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"unix:///var/run/docker.sock\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"rustImage\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"bunImage\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"docker.io/oven/bun@sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"sourceManifestSha256\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"existingHelpers\\\\\\\\\\\\\\\\":[{\\\\\\\\\\\\\\\\"path\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"_work/gpu-owner-recovery/verify.ts\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"sha256\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58\\\\\\\\\\\\\\\\"},{\\\\\\\\\\\\\\\\"path\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"_work/gpu-owner-recovery/command-supervisor.ts\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"sha256\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6\\\\\\\\\\\\\\\\"}],\\\\\\\\\\\\\\\\"cudaBindingTrial\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"13000\\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\\"resources\\\\\\\\\\\\\\\\":{\\\\\\\\\\\\\\\\"cpus\\\\\\\\\\\\\\\\":2,\\\\\\\\\\\\\\\\"memoryBytes\\\\\\\\\\\\\\\\":8589934592,\\\\\\\\\\\\\\\\"memoryPlusSwapBytes\\\\\\\\\\\\\\\\":8589934592,\\\\\\\\\\\\\\\\"cargoJobs\\\\\\\\\\\\\\\\":2,\\\\\\\\\\\\\\\\"rayonThreads\\\\\\\\\\\\\\\\":2,\\\\\\\\\\\\\\\\"uidGid\\\\\\\\\\\\\\\\":\\\\\\\\\\\\\\\\"CURRENT_OPERATOR_NUMERIC_UID_GID\\\\\\\\\\\\\\\\"},\\\\\\\\\\\\\\\\"limits\\\\\\\\\\\\\\\\":{\\\\\\\\\\\\\\\\"overallMs\\\\\\\\\\\\\\\\":4200000,\\\\\\\\\\\\\\\\"normalOperationsMs\\\\\\\\\\\\\\\\":4020000,\\\\\\\\\\\\\\\\"nativeWorkMs\\\\\\\\\\\\\\\\":3600000,\\\\\\\\\\\\\\\\"cleanupMs\\\\\\\\\\\\\\\\":120000,\\\\\\\\\\\\\\\\"receiptReserveMs\\\\\\\\\\\\\\\\":60000,\\\\\\\\\\\\\\\\"dockerCommandMs\\\\\\\\\\\\\\\\":120000,\\\\\\\\\\\\\\\\"minimumFreeBytes\\\\\\\\\\\\\\\\":68719476736,\\\\\\\\\\\\\\\\"minimumRunningFreeBytes\\\\\\\\\\\\\\\\":17179869184,\\\\\\\\\\\\\\\\"workspaceSoftBytes\\\\\\\\\\\\\\\\":34359738368,\\\\\\\\\\\\\\\\"stagingBytes\\\\\\\\\\\\\\\\":536870912,\\\\\\\\\\\\\\\\"stagingFiles\\\\\\\\\\\\\\\\":3800,\\\\\\\\\\\\\\\\"bunPostCopyBytes\\\\\\\\\\\\\\\\":134217728,\\\\\\\\\\\\\\\\"supervisedStreamBytes\\\\\\\\\\\\\\\\":4194304,\\\\\\\\\\\\\\\\"hostDockerStreamsBytes\\\\\\\\\\\\\\\\":75497472,\\\\\\\\\\\\\\\\"nativeStreamsBytes\\\\\\\\\\\\\\\\":41943040,\\\\\\\\\\\\\\\\"canonicalLogCopiesBytes\\\\\\\\\\\\\\\\":16777216,\\\\\\\\\\\\\\\\"hostReceiptBytes\\\\\\\\\\\\\\\\":2097152},\\\\\\\\\\\\\\\\"maximums\\\\\\\\\\\\\\\\":{\\\\\\\\\\\\\\\\"donorCreates\\\\\\\\\\\\\\\\":1,\\\\\\\\\\\\\\\\"donorStarts\\\\\\\\\\\\\\\\":0,\\\\\\\\\\\\\\\\"bunCopies\\\\\\\\\\\\\\\\":1,\\\\\\\\\\\\\\\\"workerCreates\\\\\\\\\\\\\\\\":1,\\\\\\\\\\\\\\\\"workerStarts\\\\\\\\\\\\\\\\":1,\\\\\\\\\\\\\\\\"terminalInspections\\\\\\\\\\\\\\\\":1,\\\\\\\\\\\\\\\\"workerStops\\\\\\\\\\\\\\\\":1,\\\\\\\\\\\\\\\\"workerKills\\\\\\\\\\\\\\\\":1,\\\\\\\\\\\\\\\\"containerRemovals\\\\\\\\\\\\\\\\":2,\\\\\\\\\\\\\\\\"dockerOperations\\\\\\\\\\\\\\\\":9,\\\\\\\\\\\\\\\\"cargoCompilations\\\\\\\\\\\\\\\\":2},\\\\\\\\\\\\\\\\"hostExecutionApproved\\\\\\\\\\\\\\\\":false,\\\\\\\\\\\\\\\\"stagingAndNativeCompilationApproved\\\\\\\\\\\\\\\\":false,\\\\\\\\\\\\\\\\"qualificationImageBuildAuthorized\\\\\\\\\\\\\\\\":false,\\\\\\\\\\\\\\\\"sharedBuilderModificationAuthorized\\\\\\\\\\\\\\\\":false,\\\\\\\\\\\\\\\\"imagePullOrDependencyFetchAuthorized\\\\\\\\\\\\\\\\":false,\\\\\\\\\\\\\\\\"gpuExecutionAuthorized\\\\\\\\\\\\\\\\":false,\\\\\\\\\\\\\\\\"trainingAuthorized\\\\\\\\\\\\\\\\":false,\\\\\\\\\\\\\\\\"automaticRetryAuthorized\\\\\\\\\\\\\\\\":false,\\\\\\\\\\\\\\\\"sourcePublicationRequired\\\\\\\\\\\\\\\\":false,\\\\\\\\\\\\\\\\"helperDownloads\\\\\\\\\\\\\\\\":0,\\\\\\\\\\\\\\\\"trainingReady\\\\\\\\\\\\\\\\":false});");\\\\\\\' -- \\\\\\\'--approved-host-gpu-native-build-1\\\\\\\' < /dev/null\\\'; fish --no-config -n -c "$program" > \\\'_work/gpu-owner-recovery/runs/host-gpu-native-build-1/syntax.stdout\\\' 2> \\\'_work/gpu-owner-recovery/runs/host-gpu-native-build-1/syntax.stderr\\\'; or exit $status; fish --no-config -c "$program"\' > "$evidence/worker.stdout" 2> "$evidence/worker.stderr"; set -l code $status; for stream in stdout stderr; if test (command wc -c < "$evidence/worker.$stream") -gt 65536; set code 1; end; end; printf \'%s\\n\' $code > "$evidence/command.exit"; or exit 1; command cat -- "$evidence/worker.stdout"; command cat -- "$evidence/worker.stderr" >&2; if test -f "$evidence/receipt.json"; command cat -- "$evidence/receipt.json"; end; printf \'HOST_NATIVE_BUILD_EXIT=%s\\n\' $code; exit $code'
