// SPEC: _spec/gpu-host-build.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { repository, work } from "../../provision";
import { runBounded } from "../../verify";
import { sourceInventory } from "../../../../tooling/runtime/qualification";
import { assertNativeGenerationDelta, assertRecordSliceCorrection, baselineCommit, nativePath } from "./correction";

const [label] = Bun.argv.slice(2);
if (Bun.argv.length !== 3 || !/^host-gpu-policy-record-correction-source-[1-9][0-9]*$/.test(label ?? "") || resolve(process.cwd()) !== resolve(repository)) throw Error("POLICY_RECORD_SOURCE_CONTEXT_REQUIRED");
const directory = resolve(work, "runs", label!), hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: unknown, reason: string) => { if (!value) throw Error(reason); };
await mkdir(directory); for (const path of ["home", "tmp", "e2e"]) await mkdir(resolve(directory, path));
const diagnosticRoot = "_work/gpu-owner-recovery/runs/host-gpu-policy-record-diagnostic-1/";
const preparedPath = "_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json";
const proofPath = "_work/gpu-owner-recovery/runs/host-gpu-build-source-5/receipt.json";
const historical = JSON.parse(await readFile(proofPath, "utf8"));
const paths = new Set<string>(historical.sources.map((row: { path: string }) => row.path));
for (const path of [preparedPath, proofPath, diagnosticRoot + "observation.json", diagnosticRoot + "operator-diagnostic.txt", diagnosticRoot + "red-regression.json", "packages/runtime/tests/gpu-policy-record.test.ts"]) paths.add(path);
for await (const path of new Bun.Glob("_work/gpu-owner-recovery/qualification/policy-record-fix/*.{ts,json}").scan({ cwd: repository, onlyFiles: true })) paths.add(path);
const sources = await Promise.all([...paths].sort().map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
const results = []; let failure: string | null = null, sourceChanged = false;
let generation: { path: string; sha256: string; nativeInputs: number; changedPaths: string[]; previousManifestSha256: string } | null = null;
const commands = [
  { name: "baseline-source", argv: ["/usr/bin/git", "show", baselineCommit + ":" + nativePath] },
  { name: "record-and-qualification-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-policy-record.test.ts", "./packages/runtime/tests/gpu-recipe.test.ts", "./packages/runtime/tests/gpu-qualification.test.ts", "./_work/gpu-owner-recovery/prepared-llvm/verify.test.ts"] },
  { name: "build-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/host-build/build.test.ts", "./_work/gpu-owner-recovery/qualification/host-build/render.test.ts"] },
  ...["tsconfig.json", "tsconfig.tests.json", "_work/gpu-owner-recovery/qualification/tsconfig.json", "_work/gpu-owner-recovery/qualification/host-build/tsconfig.json", "_work/gpu-owner-recovery/qualification/policy-record-fix/tsconfig.json"].map((project, index) => ({ name: "types-" + index, argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", project] })),
];
try {
  const prepared = JSON.parse(await readFile(preparedPath, "utf8")), native = await sourceInventory(repository);
  const changedPaths = assertNativeGenerationDelta(prepared.nativeSourceInventory, native);
  const priorChanges = historical.sources.filter((row: { path: string; sha256: string }) => sources.find(source => source.path === row.path)?.sha256 !== row.sha256).map((row: { path: string }) => row.path);
  check(JSON.stringify(priorChanges) === JSON.stringify([nativePath]), "ONLY_POLICY_GPU_SOURCE_DIFFERS_FROM_PRIOR_283_INPUTS");
  const observation = JSON.parse(await readFile(diagnosticRoot + "observation.json", "utf8"));
  check(observation.reportedCompilerErrorCode === "E0277" && observation.reportedErrorRecords === 1 && observation.policyDiagnosticReadExitMarkerProvided === false && observation.originalHostStdoutReceived === false && observation.remainingHostBuildInvocations === 0, "ATTRIBUTED_DIAGNOSTIC_AND_CONSUMED_GRANT_REQUIRED");
  const red = JSON.parse(await readFile(diagnosticRoot + "red-regression.json", "utf8"));
  check(red.status === "PASS_EXPECTED_RED_STATIC_RECORD_REGRESSION", "PERSISTED_PRE_FIX_RED_REGRESSION_REQUIRED");
  for (const stream of red.streams) { const bytes = await readFile(stream.path); check(bytes.length === stream.bytes && hash(bytes) === stream.sha256, "RED_CAPTURE_CHANGED"); }
  for (const command of commands) {
    const step = resolve(directory, command.name); await mkdir(step);
    const result = await runBounded(command.argv, step, 120000, { cwd: repository, environment: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"), GIT_NO_LAZY_FETCH: "1", NO_COLOR: "1", MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false", HOST_BUILD_TEST_EVIDENCE: resolve(directory, "e2e") } });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => { const path = resolve(step, "command." + stream), bytes = await readFile(path); return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) }; }));
    results.push({ ...command, ...result, streams });
    check(result.status === "PASS" && result.exitCode === 0, "SOURCE_CHECK_FAILED:" + command.name);
    if (command.name === "baseline-source") {
      const before = await readFile(resolve(step, "command.stdout"), "utf8"), after = await readFile(nativePath, "utf8");
      check(hash(Buffer.from(before)) === prepared.nativeSourceInventory.find((row: { path: string }) => row.path === nativePath)?.sha256, "BASELINE_SOURCE_MATCHES_PREPARED_GENERATION");
      assertRecordSliceCorrection(before, after);
      const bytes = Buffer.from(JSON.stringify(native, null, 2) + "\n"), path = relative(repository, resolve(directory, "native-source-manifest.json"));
      const previousManifestSha256 = hash(Buffer.from(JSON.stringify(prepared.nativeSourceInventory, null, 2) + "\n"));
      check(previousManifestSha256 === "9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863", "ORIGINAL_MANIFEST_ENCODING_REQUIRED");
      await writeFile(path, bytes, { flag: "wx" }); generation = { path, sha256: hash(bytes), nativeInputs: native.length, changedPaths, previousManifestSha256 };
    }
  }
  sourceChanged = (await Promise.all(sources.map(async source => hash(await readFile(source.path)) !== source.sha256))).some(Boolean);
  check(JSON.stringify(await sourceInventory(repository)) === JSON.stringify(native), "NATIVE_SOURCE_CHANGED_DURING_VERIFICATION");
  check(generation !== null && hash(await readFile(generation.path)) === generation.sha256 && !sourceChanged, "VERIFIED_GENERATION_UNCHANGED");
} catch (error) { failure = error instanceof Error ? error.message : String(error); }
const status = failure === null && results.length === commands.length && !sourceChanged ? "PASS_POLICY_RECORD_SOURCE_CORRECTION_ONLY" : "FAIL_POLICY_RECORD_SOURCE_CORRECTION_ONLY";
await writeFile(resolve(directory, "receipt.json"), JSON.stringify({ status, failure, baselineCommit, sources, results, sourceChanged, generation,
  previousSourceProof: proofPath, historicalSourceProofInputs: 283, changedHistoricalSourceProofInputs: [nativePath],
  verificationScope: "BUN_STATIC_ASSERTIONS_MOCKED_LIFECYCLE_AND_TYPES_NOT_NATIVE_COMPILATION",
  originalHostLogDigestsIndependentlyVerified: false, policyDiagnosticReadExitMarkerProvided: false, hostExecutionAuthorized: false, copyingOrStagingAuthorized: false,
  publicationAuthorized: false, nativeCompilationPerformed: false, gpuExecuted: false, trainingAuthorized: false, trainingReady: false,
  nextHostPreparationStrategyDecisionRequired: true }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status, failure, generation, receipt: relative(repository, resolve(directory, "receipt.json")) }));
process.exitCode = status === "PASS_POLICY_RECORD_SOURCE_CORRECTION_ONLY" ? 0 : 1;
