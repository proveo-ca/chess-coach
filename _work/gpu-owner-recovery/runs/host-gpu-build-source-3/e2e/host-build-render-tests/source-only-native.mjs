import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const requireValue = (value, label) => {
  if (!value)
    throw Error(label);
};
export function nativeCommands() {
  return [
    { id: "rustc-version", argv: ["rustc", "--version"], version: /^rustc 1\.95\.0 / },
    { id: "cargo-version", argv: ["cargo", "--version"], version: /^cargo 1\.95\.0 / },
    { id: "llvm-version", argv: ["/opt/tracel-data/tracel/tracel-llvm-23.1.0-4/bin/llvm-config", "--version"], version: /^23\.1\.0\s*$/ },
    ...[["gpu-learning", "chess-coach-learning", "finite_difference"], ["gpu-policy", "chess-coach-policy-io", "gpu"]].map(([id, pkg, target]) => ({ id, argv: ["cargo", "test", "--release", "--target", "x86_64-unknown-linux-gnu", "--locked", "--offline", "--jobs", "2", "-p", pkg, "--features", "gpu-prepared-llvm", "--test", target, "--no-run", "--message-format=json"], version: null }))
  ];
}
export async function stageTree(source, destination, budget, p, remaining) {
  remaining();
  await mkdir(destination, { recursive: !0 });
  for (const entry of await readdir(source, { withFileTypes: !0 })) {
    remaining();
    const from = source + "/" + entry.name, to = destination + "/" + entry.name;
    if (entry.isDirectory())
      await stageTree(from, to, budget, p, remaining);
    else {
      const stat = await lstat(from);
      requireValue(stat.isFile(), "STAGING_REGULAR_FILE_REQUIRED");
      budget.bytes += stat.size;
      budget.files++;
      requireValue(budget.bytes <= p.limits.stagingBytes && budget.files <= p.limits.stagingFiles, "STAGING_BUDGET");
      await copyFile(from, to, constants.COPYFILE_EXCL);
    }
  }
}
export async function recordNativeCommand(command, attempts, io) {
  const attempt = { id: command.id, argv: command.argv, attempted: !0, status: "STARTED", streams: [], captureFailures: [], canonicalCopyFailures: [] };
  attempts.push(attempt);
  let result;
  try {
    result = await io.execute();
    Object.assign(attempt, result);
  } catch (error) {
    Object.assign(attempt, { status: "FAIL", failure: String(error) });
    throw error;
  }
  let stdout = "";
  for (const stream of ["stdout", "stderr"]) {
    let captured;
    try {
      captured = await io.capture(stream);
      const { text, ...metadata } = captured;
      attempt.streams.push(metadata);
      if (stream === "stdout")
        stdout = text;
    } catch (error) {
      attempt.captureFailures.push(stream + ":" + String(error));
      continue;
    }
    if (!command.version)
      try {
        await io.mirror(stream, captured.path);
      } catch (error) {
        attempt.canonicalCopyFailures.push(stream + ":" + String(error));
      }
  }
  requireValue(result.status === "PASS" && result.exitCode === 0 && result.failure === null, "NATIVE_COMMAND_FAILED:" + command.id);
  requireValue(attempt.captureFailures.length === 0 && attempt.canonicalCopyFailures.length === 0, "NATIVE_CAPTURE_OR_COPY_FAILED:" + command.id);
  if (command.version)
    requireValue(command.version.test(stdout), "NATIVE_VERSION_MISMATCH:" + command.id);
}
export async function recheckNativeSource(initial, read, remaining) {
  if (initial === null || read === null)
    return { sourceChanged: null, sourceStabilityChecked: !1, sourceCheckFailure: "INITIAL_INVENTORY_UNAVAILABLE" };
  try {
    remaining();
    const after = await read();
    remaining();
    return { sourceChanged: JSON.stringify(initial) !== JSON.stringify(after), sourceStabilityChecked: !0, sourceCheckFailure: null };
  } catch (error) {
    return { sourceChanged: null, sourceStabilityChecked: !1, sourceCheckFailure: String(error) };
  }
}
export async function runNativeBuild(p) {
  const root = "/build/native", directory = root + "/_work/gpu-owner-recovery/runs/" + p.runId, started = performance.now();
  let deadline = started;
  const remaining = () => {
    const ms = Math.floor(deadline - performance.now() - 30000);
    requireValue(ms > 0, "NATIVE_BUILD_DEADLINE");
    return ms;
  }, budget = { bytes: 0, files: 0 }, results = [];
  let stage = "startup", failure = null, compilationAttempts = 0, inventory = null, inventoryReader = null;
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  await mkdir(directory, { recursive: !0 });
  try {
    const hostDeadline = JSON.parse(await readFile("/evidence/deadline.json", "utf8")).normalDeadlineEpoch;
    requireValue(Number.isSafeInteger(hostDeadline) && hostDeadline > Date.now(), "NATIVE_HOST_DEADLINE_REQUIRED");
    deadline = Math.min(started + p.limits.nativeWorkMs, performance.now() + hostDeadline - Date.now());
    requireValue(process.cwd() === root && Bun.version === "1.4.0", "NATIVE_BUN_CONTEXT_REQUIRED");
    stage = "staging";
    for (const [source, target] of [["/received/current-native", root], ["/received/qualification-tools", root], ["/received/cargo-home", "/capture/cargo-home"]])
      await stageTree(source, target, budget, p, remaining);
    for (const path of ["home", "tmp"])
      await mkdir(root + "/_work/gpu-owner-recovery/scratch/" + path, { recursive: !0 });
    const { runBounded } = await import(pathToFileURL(root + "/_work/gpu-owner-recovery/verify.ts").href), { sourceInventory } = await import(pathToFileURL(root + "/tooling/runtime/qualification.ts").href);
    inventoryReader = () => sourceInventory(root);
    const sourceBytes = await readFile(root + "/qualification/source-manifest.json");
    inventory = await sourceInventory(root);
    requireValue(hash(sourceBytes) === p.sourceManifestSha256 && JSON.stringify(JSON.parse(sourceBytes.toString())) === JSON.stringify(inventory), "NATIVE_SOURCE_GENERATION_REQUIRED");
    const environment = Object.fromEntries(Object.entries(process.env).filter((row) => row[1] !== void 0));
    for (const command of nativeCommands()) {
      stage = command.version ? "version-guard" : "compilation";
      const step = directory + "/" + command.id;
      await mkdir(step);
      const ms = Math.min(remaining(), command.version ? 1e4 : p.limits.nativeWorkMs);
      if (!command.version)
        compilationAttempts++;
      await recordNativeCommand(command, results, {
        execute: () => runBounded(command.argv, step, ms, { cwd: root, environment }),
        capture: async (stream) => {
          const path = step + "/command." + stream, bytes = await readFile(path);
          return { path, bytes: bytes.length, sha256: hash(bytes), text: stream === "stdout" ? bytes.toString() : "" };
        },
        mirror: (stream, source) => copyFile(source, root + "/qualification/" + command.id + "." + stream, constants.COPYFILE_EXCL)
      });
    }
    remaining();
  } catch (error) {
    failure = error instanceof Error ? error.message : "NATIVE_BUILD_FAILED";
  }
  const sourceCheck = await recheckNativeSource(inventory, inventoryReader, remaining);
  if (sourceCheck.sourceChanged !== !1 || !sourceCheck.sourceStabilityChecked)
    failure ??= sourceCheck.sourceChanged ? "NATIVE_SOURCE_CHANGED" : "NATIVE_SOURCE_STABILITY_UNCHECKED";
  if (failure === null)
    stage = "complete";
  const receipt = {
    status: failure === null ? "PASS_NATIVE_COMPILATION_ONLY" : "FAIL_NATIVE_COMPILATION_ONLY",
    failure,
    stage,
    bunVersion: Bun.version,
    staging: budget,
    compilationAttempts,
    results,
    ...sourceCheck,
    sourceManifestSha256: p.sourceManifestSha256,
    elapsedMs: performance.now() - started,
    qualificationImageBuilt: !1,
    testsExecuted: !1,
    gpuExecuted: !1,
    trainingReady: !1
  };
  await writeFile(directory + "/receipt.json", JSON.stringify(receipt, null, 2) + `
`, { flag: "wx" });
  console.log(JSON.stringify({ status: receipt.status, failure, stage, receipt: directory + "/receipt.json", trainingReady: !1 }));
  process.exitCode = failure === null ? 0 : 1;
}

await runNativeBuild({"version":"chess-coach.owned-container-native-build-proposal.v1","status":"SOURCE_ONLY_AWAITING_EXPLICIT_BUILD_METHOD_AND_HOST_APPROVAL","method":"OWNED_DOCKER_CONTAINER_NATIVE_BUILD_ONLY_NOT_QUALIFICATION_IMAGE_BUILD","runId":"host-gpu-native-build-1","grant":"--approved-host-gpu-native-build-1","context":"_work/gpu-owner-recovery/cache/host-receive-2/context","workspace":"_work/gpu-owner-recovery/cache/host-gpu-native-build-1","evidence":"_work/gpu-owner-recovery/runs/host-gpu-native-build-1","engine":"unix:///var/run/docker.sock","rustImage":"docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb","bunImage":"docker.io/oven/bun@sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038","sourceManifestSha256":"9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863","existingHelpers":[{"path":"_work/gpu-owner-recovery/verify.ts","sha256":"9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58"},{"path":"_work/gpu-owner-recovery/command-supervisor.ts","sha256":"88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6"}],"cudaBindingTrial":"13000","resources":{"cpus":2,"memoryBytes":8589934592,"memoryPlusSwapBytes":8589934592,"cargoJobs":2,"rayonThreads":2,"uidGid":"CURRENT_OPERATOR_NUMERIC_UID_GID"},"limits":{"overallMs":4200000,"normalOperationsMs":4020000,"nativeWorkMs":3600000,"cleanupMs":120000,"receiptReserveMs":60000,"dockerCommandMs":120000,"artifactValidationMs":120000,"minimumFreeBytes":68719476736,"minimumRunningFreeBytes":17179869184,"workspaceSoftBytes":34359738368,"stagingBytes":536870912,"stagingFiles":3800,"bunPostCopyBytes":134217728,"supervisedStreamBytes":4194304,"hostDockerStreamsBytes":83886080,"nativeStreamsBytes":41943040,"canonicalLogCopiesBytes":16777216,"hostReceiptBytes":2097152},"maximums":{"donorCreates":1,"donorStarts":0,"bunCopies":1,"workerCreates":1,"workerStarts":1,"workerLogFollows":1,"terminalInspections":1,"workerStops":1,"workerKills":1,"containerRemovals":2,"dockerOperations":10,"cargoCompilations":2},"hostExecutionApproved":false,"stagingAndNativeCompilationApproved":false,"qualificationImageBuildAuthorized":false,"sharedBuilderModificationAuthorized":false,"imagePullOrDependencyFetchAuthorized":false,"gpuExecutionAuthorized":false,"trainingAuthorized":false,"automaticRetryAuthorized":false,"sourcePublicationRequired":false,"helperDownloads":0,"trainingReady":false});