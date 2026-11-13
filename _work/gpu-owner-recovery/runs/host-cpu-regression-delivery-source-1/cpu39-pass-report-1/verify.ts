// SPEC: _spec/gpu-qualification.puml
import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { runBounded } from "../../../verify";
import { hash, hostRoot, reportRoot, snapshotPaths } from "./records";

export function verificationCommands() {
  const bun = ["/usr/local/bin/bun", "--no-env-file", "--no-install"];
  return [
    { id: "records", argv: [...bun, reportRoot + "records.ts", "--receive-report"] },
    { id: "unit-and-mock-e2e", argv: [...bun, "test", "./" + reportRoot + "records.test.ts"] },
    { id: "strict-types", argv: [...bun, "node_modules/typescript/lib/_tsc.js", "--noEmit", "--strict", "--noUnusedLocals", "--noUnusedParameters", "--isolatedModules", "--verbatimModuleSyntax", "--resolveJsonModule", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", "--types", "bun", reportRoot + "records.ts", reportRoot + "records.test.ts", reportRoot + "verify.ts"] },
  ];
}
export function verificationDirectory(label: string) {
  assert.match(label, /^verification-[1-9][0-9]?$/); assert.equal(label.trim(), label);
  return resolve(hostRoot, reportRoot, label);
}

type Binding = { path: string; sha256: string };
async function frozenSourceBindings() {
  const fullPath = "_work/gpu-owner-recovery/runs/host-gpu-full-source-4/sources.json";
  const protectedPath = "_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/receipt.json";
  const nativePath = snapshotPaths[2]!;
  const full = JSON.parse(await readFile(fullPath, "utf8")) as Binding[];
  const protectedRows = JSON.parse(await readFile(protectedPath, "utf8")).sources as Binding[];
  const native = JSON.parse(await readFile(nativePath, "utf8")) as Binding[];
  assert.deepEqual([full.length, protectedRows.length, native.length], [347, 327, 65]);
  for (const row of [...full, ...protectedRows, ...native]) {
    const path = relative(hostRoot, resolve(hostRoot, row.path));
    assert.ok(!path.startsWith("../") && !path.split("/").includes("cache") && !/\.(crate|tar|zst|gz|xz|zip)$/.test(path));
    assert.equal(hash(await readFile(resolve(hostRoot, path))), row.sha256, "FROZEN_SOURCE_CHANGED:" + path);
  }
  return { rows: [...full, ...protectedRows, ...native], manifests: [fullPath, protectedPath, nativePath] };
}

export async function verify(label: string, bounded: typeof runBounded = runBounded) {
  assert.equal(process.execPath, "/usr/local/bin/bun"); assert.equal(Bun.version, "1.4.0"); assert.equal(process.cwd(), hostRoot);
  const directory = verificationDirectory(label); await mkdir(directory);
  await mkdir(directory + "/home"); await mkdir(directory + "/tmp");
  const frozen = await frozenSourceBindings();
  const paths = [...new Set([...snapshotPaths, ...frozen.manifests, ...frozen.rows.map(row => relative(hostRoot, resolve(hostRoot, row.path))),
    ...["reported-input.json", "records.ts", "records.test.ts", "verify.ts"].map(name => reportRoot + name),
    "_work/gpu-owner-recovery/qualification/cpu-host-plan.json", "_work/gpu-owner-recovery/qualification/cpu-host.ts", "_work/gpu-owner-recovery/qualification/cpu-host.test.ts",
    "_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts", "_work/gpu-owner-recovery/qualification/host-build/build.ts"])];
  const sources = await Promise.all(paths.map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
  const results = [], commands = verificationCommands();
  let failure: string | null = null;
  try {
    for (const command of commands) {
      const step = directory + "/" + command.id; await mkdir(step);
      const result = await bounded(command.argv, step, 120000, { cwd: hostRoot, environment: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: directory + "/home", TMPDIR: directory + "/tmp",
        NO_COLOR: "1", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false" } });
      const streams = await Promise.all(["stdout", "stderr"].map(async name => { const path = relative(hostRoot, step + "/command." + name), bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
      results.push({ ...command, ...result, streams });
      assert.ok(result.status === "PASS" && result.exitCode === 0 && result.failure === null, "LOCAL_REPORT_VERIFICATION_FAILED:" + command.id);
    }
  } catch (error) { failure = error instanceof Error ? error.message : String(error); }
  let sourceChanged = false;
  try { sourceChanged = (await Promise.all(sources.map(async row => hash(await readFile(row.path)) !== row.sha256))).some(Boolean); }
  catch { sourceChanged = true; }
  const passed = failure === null && !sourceChanged && results.length === commands.length;
  const receipt = { status: passed ? "PASS_OPERATOR_REPORTED_CPU39_RECORDS_SOURCE_TESTS_AND_TYPES_ONLY" : "FAIL_CPU39_PASS_REPORT_VERIFICATION", failure, sources, sourceChanged, results,
    frozenFullSourceBindingsChecked: 347, frozenProtectedSourceBindingsChecked: 327, frozenNativeSourceBindingsChecked: 65, cpuAdapterAndExistingHelpersUnchanged: !sourceChanged,
    localVerificationOnly: true, originalHostFilesReceived: false, originalCaptureOrJournalBytesRehashed: false, fullMetadataConsistency: false,
    actualHostGpuOrNativeExecutedByCoding: false, cargoInvocations: 0, rustcInvocations: 0, dockerInvocations: 0, llvmInvocations: 0, gpuInvocations: 0,
    networkOperations: 0, cacheOrArchivePayloadAccessed: false, hostGrantConsumedByLocalVerification: 0, automaticRetryAuthorized: false, trainingReady: false };
  await writeFile(directory + "/receipt.json", JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: passed ? "PASS" : "FAIL", receipt: relative(hostRoot, directory + "/receipt.json"), stages: results.length }));
  return receipt;
}

if (import.meta.main) {
  assert.equal(Bun.argv.length, 3, "ONE_FRESH_VERIFICATION_LABEL_REQUIRED");
  const receipt = await verify(Bun.argv[2]!); process.exitCode = receipt.status.startsWith("PASS_") ? 0 : 1;
}
