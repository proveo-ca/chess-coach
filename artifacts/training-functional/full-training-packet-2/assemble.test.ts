// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { repositoryScratch } from "../../../packages/runtime/tests/repository-scratch";
import { campaignPlan, SELECTED_CAMPAIGN_BUDGET } from "../campaign-plan";
import { decodeCampaignRequest } from "../campaign-operator";
import { assembleCampaignPacket2, bytesFrom, checkSourceVerification, jsonFrom, ORIGINAL, pinFrom, RETAINED_INPUTS,
  VERIFICATION_STATUS, verificationPaths } from "./assemble";
import type { AssemblyIO } from "./assemble";
import { packetMetadata } from "./prepare-metadata";
import { checkTestHarnessAdjustment, createPacketDirectory, PACKET1, PACKET2, REPOSITORY, readBytes, writeNew } from "./preserve";
import { verifyCampaignPacket2 } from "./verify";
import { SOURCE_COMMANDS, sourceVerificationArguments, validateSourceReceipt } from "./verify-source";
import type { Receipt, Result } from "./verify-source";

const encode = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
function fixture() {
  const files = new Map<string, Uint8Array>(), writes: string[] = [];
  const io: AssemblyIO = { read: path => files.get(path) ?? readBytes(path), writeNew: (path, bytes) => {
    if (files.has(path)) throw new Error("EEXIST"); files.set(path, bytes.slice()); writes.push(path);
  } };
  const metadata = packetMetadata();
  for (const [name, value] of [["plan.json", metadata.recipe], ["runtime-configuration.json", metadata.runtime], ["storage-assessment.json", metadata.storage]] as const) files.set(`${PACKET2}/${name}`, encode(value));
  const seal = () => { const pins = verificationPaths(io).map(path => pinFrom(io, path));
    files.set(`${PACKET2}/verification.json`, encode({ status: VERIFICATION_STATUS, sourcePinsBefore: pins, sourcePinsAfter: pins, sourcePinsMatch: true })); };
  const change = (path: string, edit: (value: any) => void) => { const value = jsonFrom<any>(io, path); edit(value); files.set(path, encode(value)); };
  seal(); return { io, files, writes, seal, change };
}
function receiptFixture() {
  const files = new Map<string, Uint8Array>(), io = { read: (path: string) => {
    const bytes = files.get(path); if (!bytes) throw new Error(`MISSING_MOCK_RECEIPT:${path}`); return bytes;
  } };
  const results: Result[] = SOURCE_COMMANDS.map(command => {
    const stdoutPath = `${PACKET2}/mock-receipts/${command.name}.stdout`, stderrPath = `${PACKET2}/mock-receipts/${command.name}.stderr`;
    files.set(stdoutPath, Buffer.alloc(0)); files.set(stderrPath, Buffer.from(command.args[0] === "test" ? " 2 pass\n 0 fail\n 10 expect() calls\nRan 2 tests across 1 file. [0.01s]\n" : ""));
    return { name: command.name, argv: [process.execPath, "--no-env-file", "--no-install", ...command.args], timeoutMs: command.timeoutMs,
      exitCode: 0, elapsedMs: 0, stdout: pinFrom(io, stdoutPath), stderr: pinFrom(io, stderrPath), tests: command.args[0] === "test" ? { pass: 2, fail: 0, assertions: 10 } : null };
  });
  const receipt: Receipt = { status: "PASS_SOURCE_ONLY_V2_TESTS_TYPES_STATIC_PRESERVATION", scope: "MOCK_UNIT_TEST_RECEIPT_NOT_EXECUTION_EVIDENCE",
    sourcePinsBefore: [], sourcePinsAfter: [], sourcePinsMatch: true, results, freshTestCount: 10, freshAssertions: 50, strictTypechecks: 3,
    staticSpecsPassed: true, freshTestCohorts: SOURCE_COMMANDS.filter(row => row.args[0] === "test").flatMap(row => row.args.slice(3)), carriedTestCount: 0,
    declaredChangesFromPacket1: [], unchangedPriorSourcePins: [], excludedPriorSpecPaths: [], bunVersion: Bun.version,
    nativePlantUmlRendered: false, nativePlantUmlSkipReason: "MOCK_UNIT_TEST", hostPreparationExecuted: false,
    nativeGpuContainerOrHostOperationsExecuted: false, trainingExecuted: false, publicationPerformed: false };
  return { files, io, receipt };
}

test("source-only metadata retains the observation, explicit uncertainty and separate access boundary", () => {
  const values = packetMetadata(), plan = campaignPlan(SELECTED_CAMPAIGN_BUDGET, 2);
  if (plan.version !== "chess-coach.training-campaign-plan.v2") throw new Error("V2_PLAN");
  expect(values.recipe.plan).toEqual(plan); expect(values.recipe.hostBytesAssumedAvailableForSourcePlanningOnly).toBe(true);
  expect(values.runtime).toMatchObject({ entryPolicy: "BTRFS_DYNAMIC_ACKNOWLEDGED", root: plan.root, workerMode: "worker-v2",
    directoryUsabilityVerified: false, selinuxCompatibilityVerified: false, byteAdmissionRequiredAtBothLocations: true, trainingExecutionAuthorized: false });
  expect(values.storage.assessment).toMatchObject({ usableBytes: "386035548160", requiredUsableBytes: "283467841536", freeEntries: null,
    entriesSufficient: null, entryCapacityVerified: false, policyAcceptedUnknownEntries: true, admitted: true });
  expect(values.storage).toMatchObject({ hostBytesReserved: false, entryAllocationGuaranteed: false, retainedHostPayloadsAfterCleanupReverified: false,
    hostPreparationExecuted: false, trainingExecuted: false });
});
test("assembly extends exactly 108 execution rows and retains 840 dependency rows and nine references", () => {
  const env = fixture(), record = assembleCampaignPacket2(env.io), prepared = jsonFrom<any>(env.io, `${PACKET2}/input-manifest.json`);
  expect(record).toMatchObject({ executionFiles: 112, physicalRows: 952, retainedDependencyRows: 840, documentRoles: 14,
    retainedReferenceRows: 9, retainedHostDependencyAndReferencePayloadsRehashed: false, trainingExecutionAuthorized: false, trainingExecuted: false });
  const retained = jsonFrom<any>(env.io, RETAINED_INPUTS);
  expect(prepared.source.filter((row: any) => row.path.startsWith("node_modules/zod/"))).toEqual(retained.source.filter((row: any) => row.path.startsWith("node_modules/zod/")));
  expect(prepared.reference).toEqual(retained.reference);
  expect(env.writes).toEqual(["source-manifest.json", "binding-documents.json", "input-manifest.json", "request.json", "assembly.json"].map(name => `${PACKET2}/${name}`));
  expect(env.writes.some(path => path.startsWith(PACKET1 + "/"))).toBe(false);
});
test("assembly replaces four binding roles and preserves the other ten role payloads byte-for-byte", () => {
  const env = fixture(); assembleCampaignPacket2(env.io);
  const original = jsonFrom<any>(env.io, `${ORIGINAL}/binding-documents.json`), current = jsonFrom<any>(env.io, `${PACKET2}/binding-documents.json`);
  const changed = current.documents.filter((row: any, index: number) => JSON.stringify(row) !== JSON.stringify(original.documents[index]));
  expect(changed.map((row: any) => row.role)).toEqual(["source", "tests", "runtimeConfiguration", "recipe"]);
  expect(current.documents.filter((row: any, index: number) => JSON.stringify(row) === JSON.stringify(original.documents[index]))).toHaveLength(10);
  expect(current.documents.find((row: any) => row.role === "hostConfiguration")).toEqual(original.documents.find((row: any) => row.role === "hostConfiguration"));
});
test("assembled v2 request joins all four current byte references without granting execution", () => {
  const env = fixture(); assembleCampaignPacket2(env.io);
  const request = decodeCampaignRequest(bytesFrom(env.io, `${PACKET2}/request.json`));
  expect(request.plan).toEqual(campaignPlan(SELECTED_CAMPAIGN_BUDGET, 2)); expect(request.trainingExecutionAuthorized).toBe(false);
  expect(request.publicationAuthorized).toBe(false);
  for (const [field, name] of [["preparedInputManifest", "input-manifest.json"], ["sourceManifest", "source-manifest.json"],
    ["bindingDocuments", "binding-documents.json"], ["verification", "verification.json"]] as const) {
    const { path: _path, ...value } = pinFrom(env.io, `${PACKET2}/${name}`); expect(request[field]).toEqual(value);
  }
});
test("verification rejects missing, duplicate, reordered and extra source coverage before writes", () => {
  for (const kind of ["missing", "duplicate", "reordered", "extra"] as const) {
    const env = fixture(); env.change(`${PACKET2}/verification.json`, value => {
      const rows = value.sourcePinsAfter;
      if (kind === "missing") rows.pop();
      if (kind === "duplicate") rows.push(rows[0]);
      if (kind === "reordered") rows.reverse();
      if (kind === "extra") rows.push(pinFrom(env.io, `${PACKET1}/request.json`));
      value.sourcePinsBefore = rows;
    });
    expect(() => assembleCampaignPacket2(env.io)).toThrow("VERIFICATION_COVERAGE"); expect(env.writes).toEqual([]);
  }
});
test("verification rejects failed status, unequal before/after pins and current source drift", () => {
  for (const kind of ["status", "flag", "unequal", "drift"] as const) {
    const env = fixture();
    if (kind === "drift") env.files.set("artifacts/training-functional/campaign-plan.ts", Buffer.from("altered"));
    else env.change(`${PACKET2}/verification.json`, value => {
      if (kind === "status") value.status = "FAIL";
      if (kind === "flag") value.sourcePinsMatch = false;
      if (kind === "unequal") value.sourcePinsBefore.pop();
    });
    expect(() => assembleCampaignPacket2(env.io)).toThrow(kind === "drift" ? "ASSEMBLY_PIN" : "VERIFICATION_REQUIRED"); expect(env.writes).toEqual([]);
  }
});
test("assembly rejects mutated qualification members even under newly matching verification pins", () => {
  const env = fixture(), original = jsonFrom<any>(env.io, `${ORIGINAL}/source-manifest.json`);
  env.files.set(original.files[0].path, Buffer.from("mutated retained execution member")); env.seal();
  expect(() => assembleCampaignPacket2(env.io)).toThrow("ASSEMBLY_PIN"); expect(env.writes).toEqual([]);
});
test("assembly rejects unbound v2 recipe and runtime policy mutations", () => {
  for (const target of ["recipe", "runtime"] as const) {
    const env = fixture(); env.change(`${PACKET2}/${target === "recipe" ? "plan" : "runtime-configuration"}.json`, value => {
      if (target === "recipe") value.plan.root = "/mnt/training/training-campaign-2";
      else value.entryPolicy = "ACCEPT_ALL_UNKNOWN";
    }); env.seal();
    expect(() => assembleCampaignPacket2(env.io)).toThrow(target === "recipe" ? "V2_RECIPE" : "V2_RUNTIME_CONFIGURATION"); expect(env.writes).toEqual([]);
  }
});
test("repeat assembly uses exclusive writes and cannot overwrite an assembled generation", () => {
  const env = fixture(); assembleCampaignPacket2(env.io); const original = Buffer.from(bytesFrom(env.io, `${PACKET2}/source-manifest.json`));
  expect(() => assembleCampaignPacket2(env.io)).toThrow("EEXIST"); expect(bytesFrom(env.io, `${PACKET2}/source-manifest.json`)).toEqual(original);
});
test("the local writer enforces packet2 scope and rejects existing files without truncation", () => {
  const parent = repositoryScratch("packet2-exclusive-"), external = relative(REPOSITORY, resolve(parent, "outside.json"));
  expect(() => writeNew(external, "blocked")).toThrow("PACKET2_WRITE_ONLY");
  const directory = `${PACKET2}/scratch`, full = resolve(REPOSITORY, directory); mkdirSync(full, { recursive: true });
  const name = `${directory}/exclusive-${process.pid}-${Date.now()}.json`, target = resolve(REPOSITORY, name);
  writeFileSync(target, "retained", { flag: "wx", mode: 0o600 });
  try { expect(() => writeNew(name, "replacement")).toThrow("EEXIST"); expect(readFileSync(target, "utf8")).toBe("retained"); }
  finally { unlinkSync(target); }
});
test("packet output creation rejects symlinked ancestors before creating any outside descendant", () => {
  const outside = repositoryScratch("packet2-symlink-"), directory = `${PACKET2}/scratch`; createPacketDirectory(directory);
  const link = `${directory}/link-${process.pid}-${Date.now()}`, full = resolve(REPOSITORY, link); symlinkSync(outside, full, "dir");
  try {
    expect(() => writeNew(`${link}/new-parent/escaped.json`, "blocked")).toThrow("PHYSICAL_OUTPUT_PARENT");
    expect(() => createPacketDirectory(`${link}/new-checks`, true)).toThrow("PHYSICAL_OUTPUT_PARENT");
    expect(existsSync(resolve(outside, "new-parent"))).toBe(false); expect(existsSync(resolve(outside, "new-checks"))).toBe(false);
  } finally { unlinkSync(full); }
});
test("fresh verification permits exactly three archived synthetic timeout arguments and no assertion changes", () => {
  const record = checkTestHarnessAdjustment(); expect(record.changes.map(row => row.line)).toEqual([252, 260, 300]);
  expect(record.changes.every(row => row.before.replace(/30000\);$/, "60000);") === row.after)).toBe(true);
});
test("source coverage includes the executed static checker and all three checked diagrams", () => {
  const paths = verificationPaths();
  for (const path of ["artifacts/training-functional/check-specs.ts", "_spec/qualification-bootstrap.puml", "_spec/checkpoint-runtime.puml", "_spec/runtime-protocol.puml"])
    expect(paths).toContain(path);
  expect(new Set(paths).size).toBe(paths.length);
});
test("receipt binding derives cohort counts and totals from pinned retained stderr", () => {
  const env = receiptFixture(); expect(() => validateSourceReceipt(env.receipt, env.io)).not.toThrow();
  for (const kind of ["cohort-fail", "cohort-pass", "total", "assertions", "carried", "command"] as const) {
    const next = receiptFixture();
    if (kind === "cohort-fail") next.receipt.results[0]!.tests!.fail = 1;
    if (kind === "cohort-pass") next.receipt.results[0]!.tests!.pass = 3;
    if (kind === "total") next.receipt.freshTestCount++;
    if (kind === "assertions") next.receipt.freshAssertions++;
    if (kind === "carried") next.receipt.carriedTestCount = 90;
    if (kind === "command") next.receipt.results[0]!.exitCode = 1;
    expect(() => validateSourceReceipt(next.receipt, next.io)).toThrow();
  }
});
test("pinned failing or internally contradictory stderr cannot bind a passing cohort", () => {
  for (const footer of [" 1 pass\n 1 fail\n 10 expect() calls\nRan 2 tests across 1 file. [0.01s]\n",
    " 2 pass\n 0 fail\n 10 expect() calls\nRan 3 tests across 1 file. [0.01s]\n"]) {
    const env = receiptFixture(), row = env.receipt.results[0]!; env.files.set(row.stderr.path, Buffer.from(footer)); row.stderr = pinFrom(env.io, row.stderr.path);
    expect(() => validateSourceReceipt(env.receipt, env.io)).toThrow();
  }
});
test("source-verifier CLI rejects missing bind labels and malformed argument shapes", () => {
  expect(sourceVerificationArguments(["checks-example"])).toEqual({ bind: false, label: "checks-example" });
  expect(sourceVerificationArguments(["--bind", "checks-example"])).toEqual({ bind: true, label: "checks-example" });
  for (const args of [[], ["--bind"], ["--bind", ""], ["--bind", "../escape"], ["checks-a", "extra"], ["--bind", "checks-a", "extra"]])
    expect(() => sourceVerificationArguments(args)).toThrow();
});
test("bounded assembly IO rejects traversal, absolute paths, malformed UTF8 and oversized input", () => {
  const env = fixture();
  for (const path of ["/etc/passwd", `${PACKET2}/../request.json`, `${PACKET2}//request.json`]) expect(() => bytesFrom(env.io, path)).toThrow("ASSEMBLY_PATH");
  env.files.set(`${PACKET2}/bad.json`, Uint8Array.from([0xc0, 0xaf])); expect(() => jsonFrom(env.io, `${PACKET2}/bad.json`)).toThrow();
  env.files.set(`${PACKET2}/large.json`, new Uint8Array(4 * 1048576 + 1)); expect(() => bytesFrom(env.io, `${PACKET2}/large.json`)).toThrow("ASSEMBLY_BOUND");
  expect(() => checkSourceVerification(env.io)).not.toThrow();
});
test("assembled verification proves exactly two worker deltas and preserves packet1", () => {
  const env = fixture(); assembleCampaignPacket2(env.io); const result = verifyCampaignPacket2(env.io);
  expect(result).toMatchObject({ executionFiles: 112, physicalSourceRows: 952, retainedDependencyRows: 840, unchangedPacket1Files: 58,
    preservedWorkerSourceFiles: 112, bindingRoles: 14, replacedBindingRoles: 4, unchangedBindingRoles: 10, referenceRows: 9,
    hostPreparationExecuted: false, trainingExecuted: false, directoryUsabilityVerified: false });
  expect(result.workerDeltas.map(row => row.path).sort()).toEqual(["artifacts/training-functional/campaign-operator.ts", "artifacts/training-functional/campaign-plan.ts"]);
});
test("assembled verification rejects mutated request joins and physical row metadata", () => {
  for (const target of ["request", "input-manifest", "binding-documents"] as const) {
    const env = fixture(); assembleCampaignPacket2(env.io);
    env.change(`${PACKET2}/${target}.json`, value => {
      if (target === "request") value.preparedInputManifest.sha256 = "0".repeat(64);
      if (target === "input-manifest") value.source.pop();
      if (target === "binding-documents") value.documents[0].source.sha256 = "0".repeat(64);
    });
    expect(() => verifyCampaignPacket2(env.io)).toThrow(target === "request" ? "REQUEST_JOIN" : target === "input-manifest" ? "PHYSICAL_ROWS" : "FOUR_REPLACEMENTS_TEN_PRESERVED");
  }
});
