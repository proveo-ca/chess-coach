// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { ROOT, SOURCE, SOURCE_FILES, R, D, OP, RAW, OUTPUT, PINS, BUN, CAPS, authority,
  sourceHashes, sha, encoded, readRegular, exclusive, fresh, bounded, now, requireThat } from "./capture.ts";

const TEXT_CAP = 256 * 1024;
interface Run { args: string[]; exitCode: number | null; signal: string | null; reaped: boolean; pipesCompleted: boolean; failure: string | null; stdoutBytes: number; stderrBytes: number; stdoutSha256: string; stderrSha256: string; text: string }
function pathState(relative: string): unknown {
  try {
    const s = fs.lstatSync(join(ROOT, relative), { bigint: true });
    return { exists: true, directory: s.isDirectory(), symlink: s.isSymbolicLink(), dev: String(s.dev), ino: String(s.ino), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) };
  } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return { exists: false }; throw e; }
}
function checks(): unknown {
  const preserved = [`${R}/request.json`, `${R}/plan.json`, `${R}/approval1.json`, `${R}/implementation-choice1.json`,
    `${D}/local-inputs-1/inputs/reference/pnpm-lock.yaml`,
    ...["capture.py", "test_capture.py", "verify.py", ".gitignore"].map(name => `${D}/package-acquisition-source1/${name}`), `${R}/bun-design2.json`,
    ...["parent", "backend", "devops", "security", "adversarial"].map(role => `${SOURCE}/review-1/${role}.json`),
    ...["backend", "devops", "security", "adversarial"].map(role => `${SOURCE}/review-2/${role}.json`),
    ...["backend", "devops", "security", "adversarial"].map(role => `${SOURCE}/review-3/${role}.json`),
    ...["backend", "devops", "security", "adversarial"].map(role => `${SOURCE}/review-4/${role}.json`),
    ...["bun-design3.json", "bun-clock-selection1.json", "clock-comparison-1/receipt.json"].map(name => `${R}/${name}`),
    ...[7, 8, 9].map(index => `${SOURCE}/verification-${index}/clock-domain-proof.json`),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(index => ["receipt.json", "source-manifest.json", "readchecks-before.json", "readchecks-after.json", "tests.stdout", "tests.stderr", "typecheck.stdout", "typecheck.stderr"].map(name => `${SOURCE}/verification-${index}/${name}`))];
  return { sourceHashes: sourceHashes(), preservedHashes: Object.fromEntries(preserved.map(path => [path, sha(readRegular(join(ROOT, path), CAPS.expanded))])),
    productionPaths: Object.fromEntries([OP, RAW, OUTPUT, `${SOURCE}/execution-binding1.json`].map(path => [path, pathState(path)])) };
}
async function run(args: string[], evidence: string, label: string, env: Record<string, string>): Promise<Run> {
  const stdout: Buffer[] = [], stderr: Buffer[] = []; let out = 0, err = 0;
  let exitCode: number | null = null, signal: string | null = null, reaped = false, pipesCompleted = false, failure: string | null = null;
  const child = spawn(BUN, args, { cwd: ROOT, env: { LANG: "C", LC_ALL: "C", ...env }, stdio: ["ignore", "pipe", "pipe"], shell: false });
  const collect = (chunks: Buffer[], data: Buffer, isOut: boolean): void => {
    const total = isOut ? out : err;
    if (total >= TEXT_CAP) { failure = `${isOut ? "stdout" : "stderr"}-evidence-cap`; child.kill("SIGKILL"); return; }
    if (total + data.length > TEXT_CAP) {
      chunks.push(Buffer.from(data.subarray(0, Math.max(0, TEXT_CAP - total))));
      if (isOut) out = TEXT_CAP; else err = TEXT_CAP;
      failure = `${isOut ? "stdout" : "stderr"}-evidence-cap`; child.kill("SIGKILL");
    } else { chunks.push(Buffer.from(data)); if (isOut) out += data.length; else err += data.length; }
  };
  child.stdout.on("data", (data: Buffer) => collect(stdout, data, true)); child.stderr.on("data", (data: Buffer) => collect(stderr, data, false));
  child.on("exit", (code, sig) => { reaped = true; exitCode = code; signal = sig; });
  const closed = new Promise<void>((resolveClose, reject) => { child.once("close", () => { pipesCompleted = true; resolveClose(); }); child.once("error", reject); });
  void closed.catch(() => {});
  try { await bounded(closed, now() + 60000); }
  catch (e) {
    failure ??= e instanceof Error ? e.message : "verification-child-failed"; child.kill("SIGTERM");
    try { await bounded(closed, now() + 1000); }
    catch { child.kill("SIGKILL"); try { await bounded(closed, now() + 3000); } catch { failure = "verification-reap-or-pipes-unconfirmed"; } }
  } finally { child.stdout.destroy(); child.stderr.destroy(); }
  const outBytes = Buffer.concat(stdout), errBytes = Buffer.concat(stderr);
  exclusive(join(evidence, `${label}.stdout`), outBytes, TEXT_CAP); exclusive(join(evidence, `${label}.stderr`), errBytes, TEXT_CAP);
  return { args, exitCode, signal, reaped, pipesCompleted, failure, stdoutBytes: outBytes.length, stderrBytes: errBytes.length,
    stdoutSha256: sha(outBytes), stderrSha256: sha(errBytes), text: outBytes.toString("utf8") + "\n" + errBytes.toString("utf8") };
}
function withoutText({ text: _text, ...run }: Run): Omit<Run, "text"> { return run; }
export async function verify(): Promise<string> {
  requireThat(process.execPath === BUN && process.versions["bun"] === "1.4.0", "pinned-bun-required");
  requireThat(JSON.parse(readRegular(fs.realpathSync(join(ROOT, "node_modules/typescript/package.json")), 65536).toString("utf8")).version === "5.9.3", "pinned-typescript-required");
  const auth = authority(), before = checks(), hashes = sourceHashes();
  let evidence = "";
  for (let index = 1; index <= 999; index++) {
    const candidate = join(ROOT, SOURCE, `verification-${index}`);
    try { fresh(candidate); evidence = candidate; break; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
  }
  requireThat(evidence !== "", "verification-labels-exhausted");
  fresh(join(evidence, "fixtures"));
  const manifest = encoded({ sourceHashes: hashes, bindings: PINS, choiceSha256: auth.choiceSha256 });
  exclusive(join(evidence, "source-manifest.json"), manifest);
  exclusive(join(evidence, "readchecks-before.json"), encoded(before));
  const tests = await run(["--no-env-file", "--no-install", "test", join(ROOT, SOURCE, "capture.test.ts"), "--timeout", "10000"], evidence, "tests", { CAPTURE_TEST_ROOT: join(evidence, "fixtures") });
  const types = await run(["--no-env-file", "--no-install", join(ROOT, "node_modules/typescript/bin/tsc"), "-p", join(ROOT, SOURCE, "tsconfig.json")], evidence, "typecheck", {});
  const after = checks(), readchecksMatch = JSON.stringify(before) === JSON.stringify(after);
  exclusive(join(evidence, "readchecks-after.json"), encoded(after));
  let clockProofSha256: string | null = null, clockProofValid = false;
  try {
    const proofBytes = readRegular(join(evidence, "fixtures", "clock-domain-proof.json"), CAPS.receipt), proof = JSON.parse(proofBytes.toString("utf8"));
    clockProofValid = proof.status === "PASS_SYNTHETIC_PROCESS_LOCAL_DOMAINS" && proof.captureSourceSha256 === hashes["capture.ts"] && proof.actualGetRequests === 0 && proof.productionWorkerInvoked === false;
    exclusive(join(evidence, "clock-domain-proof.json"), proofBytes); clockProofSha256 = sha(proofBytes);
  } catch {}
  const passed = tests.text.match(/^\s*(\d+) pass\s*$/m), failed = tests.text.match(/^\s*(\d+) fail\s*$/m);
  const testsPassed = passed ? Number(passed[1]) : null, testsFailed = failed ? Number(failed[1]) : null;
  const status = tests.exitCode === 0 && types.exitCode === 0 && tests.reaped && types.reaped && tests.pipesCompleted && types.pipesCompleted && !tests.failure && !types.failure && readchecksMatch && clockProofValid && testsPassed !== null && testsPassed > 0 && testsFailed === 0 ? "PASS_OFFLINE_ONLY" : "FAIL_OFFLINE_ONLY";
  const receipt = { version: "chess-coach.bun-offline-verification.v1", status, scope: "Synthetic archives, injected HTTP/worker mocks, and fixed synthetic CLI; no production entry invocation",
    runtime: { path: BUN, bun: process.versions["bun"], typescript: "5.9.3", flags: ["--no-env-file", "--no-install"] },
    sourceFiles: SOURCE_FILES, sourceHashes: hashes, bindings: PINS, choiceSha256: auth.choiceSha256, sourceManifestSha256: sha(manifest),
    testsPassed, testsFailed, typecheckExitCode: types.exitCode, tests: withoutText(tests), typecheck: withoutText(types), readchecksMatch,
    clockProtocol: "PROCESS_LOCAL_DOMAINS_WITH_CONSERVATIVE_DURATION_HANDSHAKES", clockProofSha256, clockProofValid,
    historicalSharedEpochProof: { path: `${R}/clock-comparison-1/receipt.json`, status: "FAIL_PINNED_BUN_CROSS_PROCESS_CLOCK_COMPARISON", remainsHistorical: true, rerunDemandedSharedEpoch: false },
    actualGetRequests: 0, productionEntryInvoked: false, productionWorkerInvoked: false, productionRootsTouched: false,
    acquisitionGrantConsumed: false, realNetworkUsed: false, listenersStarted: false, nativeCompilation: false, packageExecution: false,
    fixtureScope: "Ignored verification-local synthetic files only", executionReadinessClaimed: false, trainingReady: false };
  exclusive(join(evidence, "receipt.json"), encoded(receipt));
  process.stdout.write(`${status} ${evidence}/receipt.json\n`);
  process.exitCode = status === "PASS_OFFLINE_ONLY" ? 0 : 1;
  return evidence;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await verify(); } catch (e) { process.stderr.write(`${e instanceof Error ? e.message : "verification-failed"}\n`); process.exitCode = 1; }
}
