// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBounded } from "../../../../verify.ts";
import type { CommandResult } from "../../../../verify.ts";
import { ROOT, R, SOURCE, SOURCE_FILES, OP, RAW, OUTPUT, BUN, CAPS, PINS, authority, readRegular, sha, encoded, exclusive, fresh, requireThat, equal } from "../package-acquisition-bun-source1/capture.ts";
import { CALLER_FILES, INVOCATION, READY, ENVIRONMENT, CLOCK_CONTRACT, invocationHashes } from "./invoke-approved-bun.ts";

const TEXT_CAP = 4 * 1024 * 1024;
const PRESERVED = ["request.json", "plan.json", "approval1.json", "implementation-choice1.json", "bun-design1.json", "bun-design2.json", "bun-design3.json", "bun-clock-selection1.json", "bun-invocation-design1.json", "review-1.json",
  ...[1, 2, 3].flatMap(index => ["receipt.json", "source-manifest.json", "readchecks-before.json", "readchecks-after.json", "tests/command.stdout", "tests/command.stderr", "typecheck/command.stdout", "typecheck/command.stderr"].map(name => `invocation-verification-${index}/${name}`)),
  ...["backend", "devops", "security", "adversarial"].map(role => `caller-review-1/${role}.json`)];
const CAPTURE_PROOF = `${SOURCE}/verification-10/receipt.json`;
const PRODUCTION = [OP, RAW, OUTPUT, INVOCATION];
const BINDING_DATA = [READY, `${SOURCE}/execution-binding1.json`];
function state(path: string): unknown {
  try {
    const s = fs.lstatSync(join(ROOT, path), { bigint: true });
    return { exists: true, regular: s.isFile(), directory: s.isDirectory(), symlink: s.isSymbolicLink(), nlink: String(s.nlink), dev: String(s.dev), ino: String(s.ino), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) };
  } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return { exists: false }; throw e; }
}
export function bindingDataState(path: string): unknown {
  const before = state(path);
  if (equal(before, { exists: false })) return before;
  const bytes = readRegular(join(ROOT, path), CAPS.receipt);
  requireThat(equal(before, state(path)), "verification-binding-read-drift");
  return { exists: true, metadata: before, bytes: bytes.length, sha256: sha(bytes) };
}
function checks() {
  const auth = authority(), hashes = invocationHashes(), bytes = readRegular(join(ROOT, CAPTURE_PROOF), CAPS.receipt);
  const receipt = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  const manifest = readRegular(join(ROOT, dirname(CAPTURE_PROOF), "source-manifest.json"), CAPS.receipt);
  const sourceHashes = Object.fromEntries(SOURCE_FILES.map(name => [name, hashes.source[`${SOURCE}/${name}`]]));
  const captureProofMatchesSource = receipt["status"] === "PASS_OFFLINE_ONLY" && equal(receipt["sourceHashes"], sourceHashes) && equal(receipt["bindings"], PINS) && receipt["choiceSha256"] === auth.choiceSha256 &&
    receipt["actualGetRequests"] === 0 && receipt["productionEntryInvoked"] === false && receipt["productionRootsTouched"] === false && typeof receipt["testsPassed"] === "number" && receipt["testsPassed"] > 0 && receipt["testsFailed"] === 0 && receipt["typecheckExitCode"] === 0 &&
    sha(manifest) === receipt["sourceManifestSha256"] && equal(JSON.parse(manifest.toString("utf8")), { sourceHashes, bindings: PINS, choiceSha256: auth.choiceSha256 });
  return { hashes, authority: auth, captureProof: { path: CAPTURE_PROOF, sha256: sha(bytes) }, captureProofMatchesSource,
    preservedHashes: Object.fromEntries(PRESERVED.map(name => [`${R}/${name}`, sha(readRegular(join(ROOT, R, name), CAPS.receipt))])),
    productionPaths: Object.fromEntries(PRODUCTION.map(path => [path, state(path)])),
    bindingData: Object.fromEntries(BINDING_DATA.map(path => [path, bindingDataState(path)])) };
}
export function productionAbsent(readState: (path: string) => unknown = state): boolean { return PRODUCTION.every(path => equal(readState(path), { exists: false })); }
export interface VerificationRun { result: CommandResult | null; thrown: string | null; stdoutBytes: number; stderrBytes: number; stdoutSha256: string | null; stderrSha256: string | null; text: string; readFailure: string | null }
async function run(argv: string[], directory: string, environment: Record<string, string>): Promise<VerificationRun> {
  fresh(directory);
  let result: CommandResult | null = null, thrown: string | null = null, readFailure: string | null = null;
  try { result = await runBounded(argv, directory, 60000, { cwd: ROOT, environment }); }
  catch (e) { thrown = e instanceof Error ? e.message.slice(0, 192) : "verification-runner-threw"; }
  let stdout: Buffer | undefined, stderr: Buffer | undefined;
  try { stdout = readRegular(join(directory, "command.stdout"), TEXT_CAP); stderr = readRegular(join(directory, "command.stderr"), TEXT_CAP); }
  catch (e) { readFailure = e instanceof Error ? e.message.slice(0, 192) : "verification-output-read-failed"; }
  return { result, thrown, stdoutBytes: stdout?.length ?? 0, stderrBytes: stderr?.length ?? 0, stdoutSha256: stdout ? sha(stdout) : null, stderrSha256: stderr ? sha(stderr) : null,
    text: `${stdout?.toString("utf8") ?? ""}\n${stderr?.toString("utf8") ?? ""}`, readFailure };
}
function summary({ text: _text, ...facts }: VerificationRun): Omit<VerificationRun, "text"> { return facts; }
function passed(run: VerificationRun): boolean {
  return run.result?.status === "PASS" && run.result.exitCode === 0 && run.result.failure === null && !run.thrown && !run.readFailure &&
    Number.isSafeInteger(run.stdoutBytes) && run.stdoutBytes >= 0 && Number.isSafeInteger(run.stderrBytes) && run.stderrBytes >= 0 &&
    typeof run.stdoutSha256 === "string" && /^[a-f0-9]{64}$/.test(run.stdoutSha256) && typeof run.stderrSha256 === "string" && /^[a-f0-9]{64}$/.test(run.stderrSha256) &&
    run.result.stdoutBytes === run.stdoutBytes && run.result.stderrBytes === run.stderrBytes;
}
export function assessVerification(tests: VerificationRun, typecheck: VerificationRun, readchecksMatch: boolean, productionAbsent: boolean, captureProofMatchesSource: boolean) {
  const count = (label: "pass" | "fail"): number | null => {
    const matches = [...tests.text.matchAll(new RegExp(`^\\s*(\\d+) ${label}\\s*$`, "gm"))];
    const value = matches.length === 1 ? Number(matches[0]![1]) : NaN;
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  const testsPassed = count("pass"), testsFailed = count("fail");
  const status = passed(tests) && passed(typecheck) && readchecksMatch && productionAbsent && captureProofMatchesSource && testsPassed !== null && testsPassed > 0 && testsFailed === 0 ? "PASS_OFFLINE_ONLY" : "FAIL_OFFLINE_ONLY";
  return { testsPassed, testsFailed, status };
}
export async function verifyInvocation(): Promise<string> {
  requireThat(fileURLToPath(import.meta.url) === join(ROOT, R, "invoke-approved-bun-verify.ts") && resolve(process.cwd()) === ROOT && process.execPath === BUN && process.versions["bun"] === "1.4.0" &&
    process.execArgv.includes("--no-env-file") && process.execArgv.includes("--no-install"), "invocation-verification-pinned-runtime");
  const typescriptPackage = fs.realpathSync(join(ROOT, "node_modules/typescript/package.json"));
  requireThat(JSON.parse(readRegular(typescriptPackage, CAPS.receipt).toString("utf8")).version === "5.9.3", "invocation-verification-pinned-typescript");
  let evidence = "";
  for (let index = 2; index <= 999; index++) {
    const candidate = join(ROOT, R, `invocation-verification-${index}`);
    try { fresh(candidate); evidence = candidate; break; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
  }
  requireThat(evidence !== "", "invocation-verification-labels-exhausted");
  fresh(join(evidence, "fixtures"));
  let before: ReturnType<typeof checks>;
  try { before = checks(); }
  catch (e) {
    const failure = e instanceof Error ? e.message.slice(0, 192) : "verification-initial-snapshot-failed";
    exclusive(join(evidence, "readchecks-before.json"), encoded({ snapshot: null, failure }));
    exclusive(join(evidence, "readchecks-after.json"), encoded({ snapshot: null, failure: "verification-not-started" }));
    exclusive(join(evidence, "receipt.json"), encoded({ version: "chess-coach.bun-invocation-verification.v1", status: "FAIL_OFFLINE_ONLY", clockContract: CLOCK_CONTRACT,
      failure, testsPassed: null, testsFailed: null, typecheckExitCode: null, readchecksMatch: false, sourceChanged: null, actualGetRequests: 0,
      productionEntryInvoked: false, productionWorkerInvoked: false, productionRootsTouched: false, acquisitionGrantConsumed: false, executionReadinessClaimed: false, trainingReady: false }));
    process.stdout.write(`FAIL_OFFLINE_ONLY ${evidence}/receipt.json\n`); process.exitCode = 1; return evidence;
  }
  const absentBefore = productionAbsent(), manifest = encoded(before.hashes);
  exclusive(join(evidence, "source-manifest.json"), manifest);
  exclusive(join(evidence, "readchecks-before.json"), encoded(before));
  const testsArgv = [BUN, "--no-env-file", "--no-install", "test", join(ROOT, R, "invoke-approved-bun.test.ts"), "--timeout", "10000"];
  const typecheckArgv = [BUN, "--no-env-file", "--no-install", join(ROOT, "node_modules/typescript/bin/tsc"), "-p", join(ROOT, R, "invoke-approved-bun.tsconfig.json")];
  const tests = await run(testsArgv, join(evidence, "tests"), { ...ENVIRONMENT, INVOCATION_TEST_ROOT: join(evidence, "fixtures") });
  const typecheck = await run(typecheckArgv, join(evidence, "typecheck"), { ...ENVIRONMENT });
  let after: ReturnType<typeof checks> | null = null, afterFailure: string | null = null, absentAfter = false;
  try { after = checks(); absentAfter = productionAbsent(); } catch (e) { afterFailure = e instanceof Error ? e.message.slice(0, 192) : "verification-snapshot-failed"; }
  exclusive(join(evidence, "readchecks-after.json"), encoded({ snapshot: after, failure: afterFailure }));
  const readchecksMatch = after !== null && equal(before, after), absent = absentBefore && absentAfter;
  const bindingDataUnchanged = after !== null && equal(before.bindingData, after.bindingData);
  const captureProofMatchesSource = before.captureProofMatchesSource && after?.captureProofMatchesSource === true;
  const { status, testsPassed, testsFailed } = assessVerification(tests, typecheck, readchecksMatch, absent, captureProofMatchesSource);
  const receipt = { version: "chess-coach.bun-invocation-verification.v1", status, hashes: before.hashes, sourceManifestSha256: sha(manifest),
    runtime: { path: BUN, bun: process.versions["bun"], typescript: "5.9.3", typescriptPackageSha256: sha(readRegular(typescriptPackage, CAPS.receipt)), flags: ["--no-env-file", "--no-install"] },
    callerFiles: CALLER_FILES, clockContract: CLOCK_CONTRACT, captureProof: before.captureProof, captureProofMatchesSource, testsPassed, testsFailed, typecheckExitCode: typecheck.result?.exitCode ?? null, testsArgv, typecheckArgv, tests: summary(tests), typecheck: summary(typecheck),
    readchecksMatch, bindingData: before.bindingData, bindingDataUnchanged, sourceChanged: after === null ? null : !equal(before.hashes, after.hashes), productionAbsent: absent, afterFailure,
    actualGetRequests: 0, productionEntryInvoked: false, productionWorkerInvoked: false, productionRootsTouched: false, acquisitionGrantConsumed: false,
    realNetworkUsed: false, listenersStarted: false, nativeCompilation: false, packageExecution: false, executionReadinessClaimed: false, trainingReady: false,
    fixtureScope: "Repository-local invocation-verification-N/fixtures; injected acquisition runner and one owned offline Bun timeout child" };
  exclusive(join(evidence, "receipt.json"), encoded(receipt));
  process.stdout.write(`${status} ${evidence}/receipt.json\n`);
  process.exitCode = status === "PASS_OFFLINE_ONLY" ? 0 : 1;
  return evidence;
}
if (import.meta.main) {
  try { await verifyInvocation(); }
  catch (e) { process.stderr.write(`${e instanceof Error ? e.message : "invocation-verification-failed"}\n`); process.exitCode = 1; }
}
