// SPEC: _spec/runtime-protocol.puml
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { AUTHORITY_FILES, PINS, ROOT, SOURCE, R, OP, RAW, OUTPUT, authority, readRegular, sourceHashes, validateEligibility, fresh, exclusive, bounded, now, CAPS, sha, assertFixedCacheIgnore, killOwnedWorker, cleanupWorker, finalizeCapture, clockDomain } from "./capture.ts";
import type { WorkerHandle, Marker } from "./capture.ts";
import { assessRuntimeVerification } from "./verify.ts";
import type { VerificationProcessRun, VerificationGates } from "./verify.ts";
import { READ_ROOT, OBSERVER, HOSTROOT } from "./root-context.ts";
import type { RootContext } from "./root-context.ts";

const fixture: RootContext = Object.freeze({ readRoot: ROOT, operationRoot: join(ROOT, SOURCE, "fullverification-999/fixtures"), observerRoot: join(ROOT, SOURCE, "fullverification-999/fixtures/observer") });
const read = (path: string, cap: number): Buffer => readRegular(join(fixture.readRoot, path), cap);
for (const [path, pin] of Object.entries(AUTHORITY_FILES)) {
  test(`genuine authority rejects changed bytes ${path}`, () => {
    assert.match(pin, /^[a-f0-9]{64}$/);
    assert.throws(() => authority((relative, cap) => relative === path ? Buffer.concat([read(relative, cap), Buffer.from(" ")]) : read(relative, cap)), /pinned-/);
  });
}
test("full runtime authority uses real composite grant and keeps issuance snapshots historical", () => {
  const auth = authority(read);
  assert.equal(auth.choiceSha256, PINS.approval);
  const approval = JSON.parse(read(`${R}/approval2.json`, 65536).toString());
  assert.equal(approval.assistantMayExecuteActualHandoffOrAcquisition, false);
  assert.equal(JSON.parse(read(`${R}/request.json`, 65536).toString()).newAcquisitionGrantIssued, false);
  assert.equal(auth.plan.archiveRoot, RAW); assert.equal(auth.plan.selectedSourcesRoot, `${OUTPUT}/files`);
});
test("fixture eligibility stays fail-closed while execution binding is pending", () => {
  const missingBinding = (path: string, cap: number): Buffer => { if (path === `${SOURCE}/execution-binding2.json`) throw new Error("fixture-binding-pending"); return read(path, cap); };
  assert.throws(() => validateEligibility(missingBinding), /fixture-binding-pending/);
  assert.throws(() => validateEligibility(), /fixed-snapshot-root-required/);
  assert.ok(Object.keys(sourceHashes(read)).length >= 12);
});
test("runtime source pins postclaim ordering and fixed host roots", () => {
  const text = readFileSync(new URL("./capture.ts", import.meta.url), "utf8");
  const entry = text.slice(text.indexOf("export async function superviseCapture"));
  assert.ok(entry.indexOf("claimAttempt(operation") < entry.indexOf("post-claim-eligibility-drift"));
  assert.ok(entry.indexOf("post-claim-eligibility-drift") < entry.indexOf("await preparePaths"));
  const preparation = text.slice(text.indexOf("async function preparePaths"), text.indexOf("function validateSelectedAt"));
  assert.ok(preparation.indexOf("assertFixedCacheIgnore(") >= 0);
  assert.ok(preparation.indexOf("assertFixedCacheIgnore(") < preparation.indexOf("prepareClaimedCacheParent"));
  assert.ok(preparation.indexOf("await prepareClaimedCacheParent") < preparation.indexOf("fresh(join(ROOT, RAW))"));
  assert.ok(preparation.includes("active(clock, marker.workDeadline)"));
  assert.equal(ROOT, HOSTROOT); assert.notEqual(ROOT, READ_ROOT);
  assert.equal(OP, `${R}/acquisition-execution-1`); assert.ok(OBSERVER.startsWith(R));
});
const ignoreRule = "/_work/gpu-owner-recovery/cache/";
for (const text of [ignoreRule, `${ignoreRule}\n`, `${ignoreRule}\r\n`, `# policy\n${ignoreRule}\n`, `${ignoreRule}\n# !comment\n`, `!unrelated\n${ignoreRule}\n`]) {
  test(`fixed exclusion accepts exact literal policy ${JSON.stringify(text)}`, () => assert.doesNotThrow(() => assertFixedCacheIgnore(text)));
}
for (const text of ["", ` ${ignoreRule}\n`, `\t${ignoreRule}\n`, `#${ignoreRule}\n`, `!${ignoreRule}\n`, `${ignoreRule} \n`, `${ignoreRule}\t\n`, `${ignoreRule}\\ \n`, `\\${ignoreRule}\n`, `${ignoreRule} # inline\n`, `${ignoreRule}\n!${ignoreRule}\n`, `${ignoreRule}\n !${ignoreRule}\n`, `${ignoreRule}\n\t!${ignoreRule}\n`]) {
  test(`fixed exclusion rejects nonliteral or negated policy ${JSON.stringify(text)}`, () => assert.throws(() => assertFixedCacheIgnore(text), /cache-ignore/));
}
test("production signal wrapper accepts only confirmed delivery and rejects known exit", () => {
  let calls = 0;
  const child = { exitCode: null as number | null, signalCode: null as NodeJS.Signals | null, kill: (_signal: NodeJS.Signals): boolean => { calls++; return true; } };
  assert.doesNotThrow(() => killOwnedWorker(child, "SIGTERM")); assert.equal(calls, 1);
  child.kill = () => false; assert.throws(() => killOwnedWorker(child, "SIGKILL"), /worker-signal-not-delivered/);
  child.kill = () => { throw new Error("signal-syscall-fault"); }; assert.throws(() => killOwnedWorker(child, "SIGTERM"), /signal-syscall-fault/);
  child.kill = () => { calls++; return true; }; child.exitCode = 0;
  assert.throws(() => killOwnedWorker(child, "SIGTERM"), /worker-already-exited/); assert.equal(calls, 1);
  child.exitCode = null; child.signalCode = "SIGTERM";
  assert.throws(() => killOwnedWorker(child, "SIGKILL"), /worker-already-exited/); assert.equal(calls, 1);
});
for (const delivery of ["false", "throw", "true"] as const) test(`production signal wrapper preserves cleanup facts after ${delivery} and genuine fixture exit zero`, async () => {
  const stdin = new PassThrough(), stdout = new PassThrough(), stderr = new PassThrough();
  let finish: (code: number) => void = () => {}, calls = 0;
  const exited = new Promise<number>(resolveExit => { finish = resolveExit; });
  const child = { exitCode: null as number | null, signalCode: null as NodeJS.Signals | null, kill: (_signal: NodeJS.Signals): boolean => {
    calls++; child.exitCode = 0; finish(0);
    if (delivery === "throw") throw new Error("signal-syscall-fault");
    return delivery === "true";
  } };
  const worker: WorkerHandle = { pid: 999999, stdin, stdout, stderr, exited, kill: signal => killOwnedWorker(child, signal), destroy: () => { stdin.destroy(); stdout.destroy(); stderr.destroy(); } };
  const facts = await cleanupWorker(worker, now() + 5000);
  assert.equal(calls, 1); assert.equal(facts["termAttempted"], true); assert.equal(facts["termSent"], delivery === "true"); assert.equal(facts["killSent"], false);
  assert.equal(facts["workerReaped"], true); assert.equal(facts["workerExitCode"], 0); assert.equal(facts["pipesDestroyed"], true); assert.equal(facts["cleanupFailure"], delivery !== "true");
  if (delivery !== "true") {
    assert.doesNotThrow(() => killOwnedWorker({ exitCode: null, signalCode: null, kill: () => true }, "SIGKILL"));
    assert.equal(facts["cleanupFailure"], true);
    const origin = now(), marker: Marker = { attemptId: "signal-fault", supervisorPid: process.pid, supervisorDomain: clockDomain("signal-fault", "supervisor", process.pid), origin, workDeadline: origin + CAPS.workMs, operationDeadline: origin + CAPS.operationMs };
    const forbidden = (): never => { throw new Error("must-not-finalize-tainted-cleanup"); };
    await assert.rejects(finalizeCapture({ terminalState: "PROVISIONAL_PASS", ...facts }, marker, { journalCandidate: forbidden, closeJournal: forbidden, persistReceipt: forbidden, writeCompletion: async () => forbidden() }), /cleanup-taint-disqualifies-candidate/);
  }
});
test("already reaped fixture exit requires no signal delivery", async () => {
  const stdin = new PassThrough(), stdout = new PassThrough(), stderr = new PassThrough(); let signals = 0;
  const facts = await cleanupWorker({ pid: 999999, stdin, stdout, stderr, exited: Promise.resolve(0), kill: () => { signals++; }, destroy: () => {} }, now() + 5000);
  assert.equal(signals, 0); assert.equal(facts["termSent"], false); assert.equal(facts["killSent"], false); assert.equal(facts["cleanupFailure"], false); assert.equal(facts["pipesDestroyed"], true);
});
function processRun(text = "1 pass\n0 fail\n"): VerificationProcessRun {
  return { args: [], exitCode: 0, signal: null, reaped: true, pipesCompleted: true, failure: null, stdoutBytes: 0, stderrBytes: 0, stdoutSha256: "a".repeat(64), stderrSha256: "b".repeat(64), text };
}
const verificationGates: VerificationGates = { readchecksMatch: true, productionAbsent: true, clockProofValid: true, parentIntegrationProofValid: true, captureProofMatchesSource: true };
for (const kind of ["capture", "caller"] as const) {
  test(`actual ${kind} receipt decision accepts one safe positive pass and zero fail summary`, () => {
    assert.deepEqual(assessRuntimeVerification(kind, processRun(), processRun(""), verificationGates), { status: "PASS_OFFLINE_ONLY", testsPassed: 1, testsFailed: 0 });
  });
  for (const text of ["1 pass\n1 pass\n0 fail\n", "1 pass\n0 fail\n0 fail\n", "9007199254740992 pass\n0 fail\n", "1 pass\n9007199254740992 fail\n", "NaN pass\n0 fail\n", "1 pass\nNaN pass\n0 fail\n", "Infinity pass\n0 fail\n", "-1 pass\n0 fail\n", "1.5 pass\n0 fail\n", "one pass\n0 fail\n", "1 pass garbage\n0 fail\n", "1 pass\n", "0 fail\n", "0 pass\n0 fail\n", "1 pass\n1 fail\n", "1\npass\n0 fail\n", "1 pass\n0\nfail\n"]) {
    test(`actual ${kind} receipt decision rejects malformed or duplicated summaries ${JSON.stringify(text)}`, () => assert.equal(assessRuntimeVerification(kind, processRun(text), processRun(""), verificationGates).status, "FAIL_OFFLINE_ONLY"));
  }
  for (const field of ["exitCode", "signal", "reaped", "pipesCompleted", "failure", "stdoutBytes", "stderrBytes", "stdoutSha256"] as const) {
    test(`actual ${kind} receipt decision retains process gate ${field}`, () => {
      const run = processRun();
      if (field === "exitCode") run.exitCode = 1;
      else if (field === "signal") run.signal = "SIGTERM";
      else if (field === "reaped" || field === "pipesCompleted") run[field] = false;
      else if (field === "failure") run.failure = "verification-timeout";
      else if (field === "stdoutSha256") run.stdoutSha256 = "invalid";
      else run[field] = 262145;
      assert.equal(assessRuntimeVerification(kind, run, processRun(""), verificationGates).status, "FAIL_OFFLINE_ONLY");
      assert.equal(assessRuntimeVerification(kind, processRun(), run, verificationGates).status, "FAIL_OFFLINE_ONLY");
    });
  }
  for (const gate of ["readchecksMatch", "productionAbsent", ...(kind === "capture" ? ["clockProofValid", "parentIntegrationProofValid"] : ["captureProofMatchesSource"])] as const) {
    test(`actual ${kind} receipt decision retains proof gate ${gate}`, () => assert.equal(assessRuntimeVerification(kind, processRun(), processRun(""), { ...verificationGates, [gate]: false }).status, "FAIL_OFFLINE_ONLY"));
  }
}
test("both actual verifier entry paths share the tested receipt assessment", () => {
  const source = readFileSync(new URL("./verify.ts", import.meta.url), "utf8"), caller = readFileSync(new URL("../package-acquisition-proposal-2/invoke-approved-bun-verify.ts", import.meta.url), "utf8");
  assert.ok(source.includes("const { status, testsPassed, testsFailed } = assessRuntimeVerification(kind, tests, typecheck,"));
  assert.ok(source.includes("return assessVerification(normalize(tests), normalize(typecheck),"));
  assert.equal(source.includes("tests.text.match("), false);
  assert.ok(caller.includes('return verify("caller")'));
  assert.ok(caller.includes('export { assessVerification } from "../package-acquisition-bun-source2/verify.ts"'));
  const capture = readFileSync(new URL("./capture.ts", import.meta.url), "utf8");
  assert.ok(capture.includes("kill: signal => killOwnedWorker(child, signal)"));
});
test("caller descendants use snapshot source and current checked executable", () => {
  const caller = readFileSync(new URL("../package-acquisition-proposal-2/invoke-approved-bun.ts", import.meta.url), "utf8");
  assert.ok(caller.includes("productionRootContext().observerRoot"));
  assert.ok(caller.includes("test ? BUN : validateBunRuntime()"));
  assert.ok(caller.includes("cwd: test ? ROOT : READ_ROOT"));
  assert.equal(caller.includes("/usr/local/bin"), false);
});
test("protected synthetic subprocess integrates fresh claim, fixed-parent adapter, duration protocol and completion", async () => {
  const fixtures = process.env["CAPTURE_TEST_ROOT"];
  assert.ok(fixtures && /^fullverification-[1-9][0-9]*\/fixtures$/.test(relative(join(ROOT, SOURCE), resolve(fixtures))));
  const base = join(fixtures, "integrated_parent_child"); fresh(base);
  const script = join(base, "fixture-entry.ts");
  const source = `import { PassThrough, Writable } from "node:stream";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { superviseCapture, authority, sourceHashes, PINS, readRegular, encoded, WorkerTiming, fresh, exclusive, ROOT, active, now } from ${JSON.stringify(join(ROOT, SOURCE, "capture.ts"))};
import { fixtureCacheParentIO } from ${JSON.stringify(join(ROOT, SOURCE, "cache-parent-adapter.ts"))};
import { prepareFixedCacheParent, FIXED_ANCESTORS, FIXED_CACHE_PARENT } from ${JSON.stringify(join(ROOT, SOURCE, "cache-parent.ts"))};
const base = dirname(fileURLToPath(import.meta.url)), operationPath = join(base, "operation");
const read = (path, cap) => readRegular(join(ROOT, path), cap);
const identity = { ...authority(read), sourceHashes: sourceHashes(read), bindings: PINS, executionBindingSha256: "d".repeat(64) };
const trace = [], handles = new Map(), nodes = new Map(FIXED_ANCESTORS.map((path, i) => [path, { kind: "directory", dev: 1n, ino: BigInt(i + 1) }])); let next = 100;
let activeMarker;
const deadline = { assertActive() { if (!activeMarker) throw Error("claim-first"); active(now, activeMarker.workDeadline); } };
const io = fixtureCacheParentIO({ readRoot: ROOT, operationRoot: base, observerRoot: join(base, "observer") }, {
  lstat(path) { trace.push("lstat"); const value = nodes.get(path); if (!value) throw Object.assign(Error("missing"), { code: "ENOENT" }); return value; },
  mkdirCacheParent(path, options) { if (path !== FIXED_CACHE_PARENT || options.recursive !== false || options.mode !== 448) throw Error("fixed-leaf"); trace.push("parent"); nodes.set(path, { kind: "directory", dev: 1n, ino: 1000n }); },
  openDirectory(path) { const fd = ++next; handles.set(fd, nodes.get(path)); return fd; }, fstat(fd) { return handles.get(fd); }, fsync() {}, close(fd) { handles.delete(fd); }
}, deadline, () => { if (!existsSync(join(operationPath, "attempt.json"))) throw Error("claim-first"); });
const stdout = new PassThrough(), stderr = new PassThrough(); let exit, timing;
const exited = new Promise(resolve => { exit = resolve; });
function emit(frame) { const bytes = encoded(frame), head = Buffer.alloc(4); head.writeUInt32BE(bytes.length); stdout.write(Buffer.concat([head, bytes])); }
const stdin = new Writable({ write(data, _, done) { try {
  const frame = JSON.parse(data.subarray(4).toString());
  if (frame.type === "CONFIG") { timing.acceptConfig(frame); queueMicrotask(() => emit(timing.startRequest(0))); }
  else if (frame.type === "ACK") { timing.acceptAck(frame); queueMicrotask(() => {
    const ordinal = frame.ordinal; emit(timing.frame("GET_INVOKED", { ordinal })); emit(timing.frame("RESPONSE_COMPLETED", { ordinal, bytes: 3, sha256: "a".repeat(64), sha512: "b".repeat(128) })); emit(timing.frame("URL_DONE", { ordinal }));
    if (ordinal === 0) emit(timing.startRequest(1)); else { emit(timing.frame("DONE", { manifestSha256: "c".repeat(64) })); stdout.end(); stderr.end(); exit(0); }
  }); }
  done(); } catch (error) { done(error); }
} });
const receipt = await superviseCapture({ scope: "OFFLINE_SYNTHETIC", operationPath, eligibility: () => identity,
  async preflight(marker) { activeMarker = marker; if (marker.origin + 120000 !== marker.operationDeadline) throw Error("deadline-reset"); trace.push("claim"); await prepareFixedCacheParent(io, deadline); if (handles.size) throw Error("unclosed");
    fresh(join(base, "synthetic-raw")); fresh(join(base, "synthetic-selected")); fresh(join(base, "synthetic-selected", "files")); trace.push("roots"); },
  spawn(marker) { trace.push("spawn"); timing = new WorkerTiming(marker.attemptId, marker.supervisorPid, 999999, () => 10); queueMicrotask(() => emit(timing.ready()));
    return { pid: 999999, stdin, stdout, stderr, exited, kill() { exit(1); }, destroy() { stdin.destroy(); stdout.destroy(); stderr.destroy(); } }; },
  async validate() { trace.push("validate"); }, recheck() {}, async writeCompletion(line) { process.stdout.write(line); }
});
if (!(trace.indexOf("claim") < trace.indexOf("parent") && trace.indexOf("parent") < trace.indexOf("roots") && trace.indexOf("roots") < trace.indexOf("spawn"))) throw Error("phase-order");
exclusive(join(base, "synthetic-trace.json"), encoded({ trace, actualGetRequests: 0, productionAdapterInstantiated: false, originalDeadlineUnchanged: true }));
process.exitCode = receipt.terminalState === "PROVISIONAL_PASS" && receipt.offlineSynthetic === true && receipt.pipesDestroyed === true ? 0 : 1;
`;
  exclusive(script, Buffer.from(source));
  const child = spawn(process.execPath, ["--no-env-file", "--no-install", script], { cwd: ROOT, env: { LANG: "C", LC_ALL: "C" }, stdio: ["ignore", "pipe", "pipe"], shell: false });
  const out: Buffer[] = [], err: Buffer[] = []; let outBytes = 0, errBytes = 0, reaped = false, stdoutEof = false, stderrEof = false, code: number | null = null;
  child.stdout.on("data", (bytes: Buffer) => { outBytes += bytes.length; if (outBytes <= CAPS.frame) out.push(bytes); else child.kill("SIGKILL"); });
  child.stderr.on("data", (bytes: Buffer) => { errBytes += bytes.length; if (errBytes <= CAPS.stderr) err.push(bytes); else child.kill("SIGKILL"); });
  child.stdout.once("end", () => { stdoutEof = true; }); child.stderr.once("end", () => { stderrEof = true; });
  child.once("exit", value => { reaped = true; code = value; });
  const closed = new Promise<void>((resolveClose, reject) => { child.once("close", () => resolveClose()); child.once("error", reject); }); void closed.catch(() => {});
  try { await bounded(closed, now() + 5000); }
  finally { if (!reaped) { child.kill("SIGKILL"); await bounded(closed, now() + 1000); } child.stdout.destroy(); child.stderr.destroy(); }
  const stdout = Buffer.concat(out), stderr = Buffer.concat(err);
  exclusive(join(base, "child.stdout"), stdout); exclusive(join(base, "child.stderr"), stderr);
  assert.equal(code, 0, stderr.toString()); assert.equal(reaped, true); assert.equal(stdoutEof, true); assert.equal(stderrEof, true); assert.equal(errBytes, 0);
  const receipt = readRegular(join(base, "operation/consumption-receipt.json"), CAPS.receipt), completion = JSON.parse(stdout.toString());
  assert.equal(completion.consumptionReceiptSha256, sha(receipt)); assert.equal(JSON.parse(receipt.toString()).offlineSynthetic, true);
  const evidence = { status: "PASS_OFFLINE_SYNTHETIC_INTEGRATED_PARENT_CHILD", reaped, code, stdoutEof, stderrEof, stdoutSha256: sha(stdout), stderrSha256: sha(stderr), consumptionReceiptSha256: sha(receipt), actualGetRequests: 0, productionEntryInvoked: false, productionWorkerInvoked: false, productionAdapterInstantiated: false };
  exclusive(join(fixtures, "parent-integration-proof.json"), Buffer.from(JSON.stringify(evidence)));
});
