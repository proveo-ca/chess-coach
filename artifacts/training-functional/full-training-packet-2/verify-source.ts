// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { closeSync, openSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual as same } from "node:util";
import { bytesFrom, localAssemblyIO, pinFrom, VERIFICATION_STATUS, verificationPaths } from "./assemble";
import type { AssemblyIO } from "./assemble";
import { CHANGED_CANDIDATES, checkTestHarnessAdjustment, createPacketDirectory, ensure, HARNESS_TEST, PACKET1, PACKET2, pin, readBytes, readJson, REPOSITORY, writeJson } from "./preserve";
import type { Pin } from "./preserve";

export type Result = { name: string; argv: string[]; timeoutMs: number; exitCode: number; elapsedMs: number; stdout: Pin; stderr: Pin;
  tests: { pass: number; fail: number; assertions: number } | null };
export type Receipt = { status: string; scope: string; sourcePinsBefore: Pin[]; sourcePinsAfter: Pin[]; sourcePinsMatch: boolean;
  results: Result[]; freshTestCount: number; freshAssertions: number; strictTypechecks: number; staticSpecsPassed: boolean;
  freshTestCohorts: string[]; carriedTestCount: number; declaredChangesFromPacket1: Pin[]; unchangedPriorSourcePins: Pin[];
  excludedPriorSpecPaths: string[]; bunVersion: string; nativePlantUmlRendered: false; nativePlantUmlSkipReason: string;
  hostPreparationExecuted: false; nativeGpuContainerOrHostOperationsExecuted: false; trainingExecuted: false; publicationPerformed: false };
export const SOURCE_COMMANDS = [
  { name: "policy-tests", args: ["test", "--timeout", "30000", "artifacts/training-functional/campaign-plan.test.ts", "artifacts/training-functional/campaign-operator.e2e.test.ts"], timeoutMs: 90000 },
  { name: "assembly-tests", args: ["test", "--timeout", "30000", `${PACKET2}/assemble.test.ts`], timeoutMs: 90000 },
  { name: "storage-tests", args: ["test", "--timeout", "30000", "packages/runtime/tests/storage-bounds.test.ts"], timeoutMs: 60000 },
  { name: "evidence-tests", args: ["test", "--timeout", "30000", "artifacts/training-functional/campaign-evidence.test.ts"], timeoutMs: 600000 },
  { name: "campaign-tests", args: ["test", "--timeout", "30000", "packages/runtime/tests/training-campaign.test.ts"], timeoutMs: 90000 },
  { name: "root-types", args: ["node_modules/typescript/bin/tsc", "--noEmit", "--skipLibCheck", "false", "-p", "tsconfig.json"], timeoutMs: 90000 },
  { name: "artifact-types", args: ["node_modules/typescript/bin/tsc", "--noEmit", "--skipLibCheck", "false", "-p", "artifacts/training-functional/tsconfig.json"], timeoutMs: 90000 },
  { name: "packet-types", args: ["node_modules/typescript/bin/tsc", "--noEmit", "--skipLibCheck", "false", "-p", `${PACKET2}/tsconfig.json`], timeoutMs: 90000 },
  { name: "specs", args: ["artifacts/training-functional/check-specs.ts"], timeoutMs: 60000 },
  { name: "preservation", args: [`${PACKET2}/preserve.ts`, "--check"], timeoutMs: 60000 },
] as const;
const EXCLUDED_SPECS = ["_spec/.spec-index.json", "_spec/checkpoint-runtime.puml", "_spec/readiness.md", "_spec/runtime-protocol.puml"];
function outputPath(label: string): string {
  ensure(typeof label === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(label), "VERIFICATION_LABEL"); return `${PACKET2}/${label}`;
}
function previousPins() {
  checkTestHarnessAdjustment();
  const prior = readJson<{ sourcePinsAfter: Pin[] }>(`${PACKET1}/verification.json`), excluded = [...CHANGED_CANDIDATES, HARNESS_TEST, ...EXCLUDED_SPECS];
  const unchanged = prior.sourcePinsAfter.filter(row => !excluded.includes(row.path));
  ensure(prior.sourcePinsAfter.length === 139 && unchanged.length === 130, "PRIOR_SOURCE_COHORT");
  for (const row of unchanged) ensure(same(row, pin(row.path)), `PRIOR_SOURCE_DRIFT:${row.path}`);
  return unchanged;
}
function counts(bytes: Uint8Array) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const one = (pattern: RegExp) => { const matches = [...text.matchAll(pattern)]; ensure(matches.length === 1, "TEST_SUMMARY"); return Number(matches[0]![1]); };
  const pass = one(/^\s*(\d+) pass\s*$/gm), fail = one(/^\s*(\d+) fail\s*$/gm), assertions = one(/^\s*(\d+) expect\(\) calls\s*$/gm), total = one(/^Ran (\d+) tests across [0-9]+ files?\./gm);
  ensure([pass, fail, assertions, total].every(Number.isSafeInteger) && pass + fail === total, "TEST_SUMMARY_TOTAL"); return { pass, fail, assertions };
}
export function validateSourceReceipt(receipt: Receipt, io: Pick<AssemblyIO, "read"> = localAssemblyIO): void {
  ensure(receipt.status === "PASS_SOURCE_ONLY_V2_TESTS_TYPES_STATIC_PRESERVATION" && receipt.sourcePinsMatch && same(receipt.sourcePinsBefore, receipt.sourcePinsAfter), "PASSING_SOURCE_RECEIPT");
  ensure(receipt.results.length === SOURCE_COMMANDS.length, "COMMAND_RECEIPT"); let tests = 0, assertions = 0;
  for (const [index, row] of receipt.results.entries()) {
    const expected = SOURCE_COMMANDS[index]!;
    ensure(row.name === expected.name && row.exitCode === 0 && row.timeoutMs === expected.timeoutMs &&
      same(row.argv, [process.execPath, "--no-env-file", "--no-install", ...expected.args]) &&
      same(row.stdout, pinFrom(io, row.stdout.path)) && same(row.stderr, pinFrom(io, row.stderr.path)), "COMMAND_RECEIPT");
    if (expected.args[0] === "test") {
      const actual = counts(bytesFrom(io, row.stderr.path)); ensure(actual.pass > 0 && actual.fail === 0 && same(actual, row.tests), "COHORT_RESULT");
      tests += actual.pass; assertions += actual.assertions;
    } else ensure(row.tests === null, "NON_TEST_RESULT");
  }
  ensure(receipt.freshTestCount === tests && receipt.freshAssertions === assertions && receipt.carriedTestCount === 0 &&
    receipt.strictTypechecks === 3 && receipt.staticSpecsPassed && receipt.bunVersion === Bun.version &&
    same(receipt.freshTestCohorts, SOURCE_COMMANDS.filter(row => row.args[0] === "test").flatMap(row => row.args.slice(3))), "VERIFICATION_TOTALS");
}
export function sourceVerificationArguments(args: readonly string[]) {
  const bind = args.length === 2 && args[0] === "--bind";
  ensure(bind || args.length === 1 && args[0] !== "--bind", "VERIFY_SOURCE_LABEL_OR_BIND_LABEL");
  const label = args[bind ? 1 : 0]!; outputPath(label); return { bind, label };
}
export function runSourceVerification(label: string): Receipt {
  const output = outputPath(label); createPacketDirectory(output, true);
  const sourcePinsBefore = verificationPaths().map(pin), unchangedPriorSourcePins = previousPins(), results: Result[] = [];
  for (const command of SOURCE_COMMANDS) {
    const stdoutPath = `${output}/${command.name}.stdout`, stderrPath = `${output}/${command.name}.stderr`;
    const stdout = openSync(resolve(REPOSITORY, stdoutPath), "wx", 0o600), stderr = openSync(resolve(REPOSITORY, stderrPath), "wx", 0o600);
    const argv = [process.execPath, "--no-env-file", "--no-install", ...command.args], started = performance.now(); let exitCode = -1;
    try {
      const child = Bun.spawnSync(argv, { cwd: REPOSITORY, stdin: "ignore", stdout, stderr, timeout: command.timeoutMs,
        env: { PATH: "/usr/local/bin:/usr/bin:/bin", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", CI: "true", TERM: "dumb", npm_config_offline: "true" } });
      exitCode = child.exitCode;
    } finally { closeSync(stdout); closeSync(stderr); }
    results.push({ name: command.name, argv, timeoutMs: command.timeoutMs, exitCode, elapsedMs: performance.now() - started,
      stdout: pin(stdoutPath), stderr: pin(stderrPath), tests: command.args[0] === "test" && exitCode === 0 ? counts(readBytes(stderrPath)) : null });
  }
  const sourcePinsAfter = verificationPaths().map(pin), sourcePinsMatch = same(sourcePinsBefore, sourcePinsAfter);
  const good = results.every(row => row.exitCode === 0 && (row.tests === null || row.tests.pass > 0 && row.tests.fail === 0)) && sourcePinsMatch;
  previousPins();
  const record: Receipt = { status: good ? "PASS_SOURCE_ONLY_V2_TESTS_TYPES_STATIC_PRESERVATION" : "FAIL_SOURCE_ONLY_V2_TESTS_TYPES_STATIC_PRESERVATION",
    scope: "LOCAL_BUN_MOCKS_SYNTHETIC_RETAINED_RESULTS_TYPES_STATIC_AND_LOCAL_GIT_PRESERVATION_NOT_NATIVE_TRAINING",
    sourcePinsBefore, sourcePinsAfter, sourcePinsMatch, results,
    freshTestCount: results.reduce((n, row) => n + (row.tests?.pass ?? 0), 0), freshAssertions: results.reduce((n, row) => n + (row.tests?.assertions ?? 0), 0),
    strictTypechecks: results.filter(row => row.name.endsWith("-types") && row.exitCode === 0).length,
    staticSpecsPassed: results.find(row => row.name === "specs")?.exitCode === 0, freshTestCohorts: SOURCE_COMMANDS.filter(row => row.args[0] === "test").flatMap(row => row.args.slice(3)),
    carriedTestCount: 0, declaredChangesFromPacket1: [...CHANGED_CANDIDATES, HARNESS_TEST].map(pin), unchangedPriorSourcePins, excludedPriorSpecPaths: EXCLUDED_SPECS,
    bunVersion: Bun.version, nativePlantUmlRendered: false, nativePlantUmlSkipReason: "Java and remote-theme access remain outside Bun/TypeScript-or-Rust scope",
    hostPreparationExecuted: false, nativeGpuContainerOrHostOperationsExecuted: false, trainingExecuted: false, publicationPerformed: false };
  writeJson(`${output}/receipt.json`, record); return record;
}
export function bindSourceVerification(label: string) {
  const receiptPath = `${outputPath(label)}/receipt.json`, receipt = readJson<Receipt>(receiptPath);
  validateSourceReceipt(receipt);
  ensure(same(receipt.sourcePinsAfter, verificationPaths().map(pin)), "VERIFIED_SOURCE_DRIFT");
  previousPins();
  const tests = receipt.results.filter(row => row.tests !== null).map(row => ({ paths: row.argv.slice(6), count: row.tests!.pass,
    assertions: row.tests!.assertions, generation: label, fresh: true, stderr: row.stderr }));
  const record = { status: VERIFICATION_STATUS, scope: receipt.scope, sourcePinsBefore: receipt.sourcePinsBefore, sourcePinsAfter: receipt.sourcePinsAfter,
    sourcePinsMatch: true, sourceReceipt: pin(receiptPath), tests, testCount: receipt.freshTestCount, assertions: receipt.freshAssertions,
    strictTypechecks: 3, staticSpecsPassed: true, carriedTestCount: 0, historicalTestsDoubleCounted: false,
    historicalHelperPinGapResolvedByFreshTests: true, declaredChangesFromPacket1: receipt.declaredChangesFromPacket1,
    unchangedPriorSourcePins: receipt.unchangedPriorSourcePins, excludedPriorSpecPaths: receipt.excludedPriorSpecPaths, bunVersion: receipt.bunVersion,
    nativePlantUmlRendered: false, nativePlantUmlSkipReason: receipt.nativePlantUmlSkipReason,
    hostPreparationExecuted: false, nativeGpuContainerOrHostOperationsExecuted: false, trainingExecuted: false, trainingExecutionAuthorized: false,
    publicationPerformed: false, publicationAuthorized: false };
  writeJson(`${PACKET2}/verification.json`, record); return record;
}
if (import.meta.main) {
  try {
    const { bind, label } = sourceVerificationArguments(Bun.argv.slice(2)), record = bind ? bindSourceVerification(label) : runSourceVerification(label);
    console.log("Executor: " + JSON.stringify({ status: record.status, receipt: bind ? `${PACKET2}/verification.json` : `${outputPath(label)}/receipt.json`, sourcePinsMatch: record.sourcePinsMatch }));
    if (!record.status.startsWith("PASS_")) process.exitCode = 1;
  } catch (error) { console.error("Executor: " + String(error)); process.exitCode = 1; }
}
