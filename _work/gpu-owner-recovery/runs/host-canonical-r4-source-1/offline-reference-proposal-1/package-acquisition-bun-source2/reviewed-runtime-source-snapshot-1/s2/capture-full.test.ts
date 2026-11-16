// SPEC: _spec/runtime-protocol.puml
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { AUTHORITY_FILES, PINS, ROOT, SOURCE, R, OP, RAW, OUTPUT, authority, readRegular, sourceHashes, validateEligibility, fresh, exclusive, bounded, now, CAPS, sha } from "./capture.ts";
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
  assert.ok(preparation.indexOf("cache-ignore") < preparation.indexOf("prepareClaimedCacheParent"));
  assert.ok(preparation.indexOf("await prepareClaimedCacheParent") < preparation.indexOf("fresh(join(ROOT, RAW))"));
  assert.ok(preparation.includes("active(clock, marker.workDeadline)"));
  assert.equal(ROOT, HOSTROOT); assert.notEqual(ROOT, READ_ROOT);
  assert.equal(OP, `${R}/acquisition-execution-1`); assert.ok(OBSERVER.startsWith(R));
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
