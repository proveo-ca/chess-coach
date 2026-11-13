// SPEC: _spec/runtime-protocol.puml
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { PassThrough, Writable } from "node:stream";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { ROOT, SOURCE, SOURCE_FILES, OP, R, D, GRANT, BUN, OUTPUT, RAW, CAPS, PINS, URLS, authority, sourceHashes, equal, validateReviewGate, validateEligibility,
  readRegular, exclusive, fresh, sha, encoded, now, bounded, claimAttempt, Journal, Frames, Protocol as CaptureProtocol, WorkerTiming, guardClock, clockDomain,
  sendFrame, cleanupWorker, superviseWorker, superviseCapture, inspectVerifiedArchive, downloadArchive, selectedManifest, validateSyntheticSelected, finalizeCapture, assessCapture } from "./capture.ts";
import type { ArchiveSpec, Frame, HttpResponse, Inspection, Marker, SyntheticContext, Transport, WorkerHandle, Identity, EligibilityReader, FinalizationDeps, OuterWitness } from "./capture.ts";

const fixtureRoot = process.env["CAPTURE_TEST_ROOT"];
assert.ok(fixtureRoot && /^verification-[1-9][0-9]*\/fixtures$/.test(relative(join(ROOT, SOURCE), resolve(fixtureRoot))));
const fixtures = fixtureRoot;
const specs = authority().plan.archives;
const spec = specs[0]!;
let serial = 0;
function fixture(): string { const path = join(fixtures, `case_${++serial}`); fresh(path); return path; }
function sri(data: Buffer): string { return `sha512-${createHash("sha512").update(data).digest("base64")}`; }
function withIntegrity(raw: Buffer, original = spec): ArchiveSpec { return { ...original, integrity: sri(raw) }; }
interface Entry { name: string; data?: Buffer; type?: string; prefix?: string; size?: number }
function header(entry: Entry): Buffer {
  const data = entry.data ?? Buffer.alloc(0), h = Buffer.alloc(512);
  h.write(entry.name, 0, 100, "utf8");
  const number = (n: number, start: number, length: number): void => { h.write(n.toString(8).padStart(length - 1, "0") + "\0", start, length, "ascii"); };
  number(0o644, 100, 8); number(0, 108, 8); number(0, 116, 8); number(entry.size ?? data.length, 124, 12); number(0, 136, 12);
  h.fill(32, 148, 156); h[156] = (entry.type ?? "0").charCodeAt(0);
  h.write("ustar\0" + "00", 257, 8, "binary"); if (entry.prefix) h.write(entry.prefix, 345, 155);
  const sum = h.reduce((a, b) => a + b, 0); h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  return h;
}
function tar(entries: Entry[]): Buffer {
  return Buffer.concat([...entries.flatMap(e => { const data = e.data ?? Buffer.alloc(0); return [header(e), data, Buffer.alloc((512 - data.length % 512) % 512)]; }), Buffer.alloc(1024)]);
}
function archive(entries: Entry[], original = spec): { raw: Buffer; bound: ArchiveSpec } {
  const raw = gzipSync(tar(entries)); return { raw, bound: withIntegrity(raw, original) };
}
function required(original = spec): Entry[] {
  return original.requiredMembers.map((m, i) => ({ name: m.member, data: i === 0 ? Buffer.from(JSON.stringify({ name: original.name, version: original.version })) : Buffer.from("export const offlineSynthetic = true;\n") }));
}
function inspect(entries: Entry[], original = spec): Inspection { const a = archive(entries, original); return inspectVerifiedArchive(a.raw, a.bound); }
function paxRecord(key: string, value: string): Buffer {
  const content = ` ${key}=${value}\n`; let n = Buffer.byteLength(content) + 1;
  while (String(n).length + Buffer.byteLength(content) !== n) n = String(n).length + Buffer.byteLength(content);
  return Buffer.from(`${n}${content}`);
}
function marker(ms = 1000): Marker { const origin = now(); return { attemptId: "synthetic", supervisorPid: process.pid, supervisorDomain: clockDomain("synthetic", "supervisor", process.pid), origin, workDeadline: origin + ms, operationDeadline: origin + ms + 100 }; }
class Protocol extends CaptureProtocol {
  constructor(m: Marker, persist: (frame: Frame) => void, clock = now) {
    let initialized = false; super(m, frame => { if (initialized) persist(frame); }, clock);
    const timing = new WorkerTiming(m.attemptId, m.supervisorPid, 999999, () => 0);
    this.ready(timing.ready(), 999999); this.configure("synthetic"); initialized = true;
  }
  override accept(frame: Frame): Frame | undefined {
    return super.accept({ supervisorDomain: this.marker.supervisorDomain, workerDomain: this.workerDomain,
      ...(frame["type"] === "URL_START" ? { requestStartMonoMs: 0 } : {}), ...frame });
  }
}
function packet(frame: Frame): Buffer { const payload = encoded(frame), h = Buffer.alloc(4); h.writeUInt32BE(payload.length); return Buffer.concat([h, payload]); }
function responseFacts(ordinal: number, id = "synthetic"): Frame { return { type: "RESPONSE_COMPLETED", attemptId: id, ordinal, bytes: 3, sha256: "a".repeat(64), sha512: "b".repeat(128) }; }
function completeProtocol(p: Protocol): void {
  for (const ordinal of [0, 1]) {
    p.accept({ type: "URL_START", attemptId: p.marker.attemptId, ordinal });
    p.accept({ type: "GET_INVOKED", attemptId: p.marker.attemptId, ordinal });
    p.accept(responseFacts(ordinal, p.marker.attemptId));
    p.accept({ type: "URL_DONE", attemptId: p.marker.attemptId, ordinal });
  }
  p.accept({ type: "DONE", attemptId: p.marker.attemptId, manifestSha256: "c".repeat(64) });
}
type Mode = "complete" | "doneOnly" | "ackDeath" | "noDone" | "nonzero" | "stderr" | "stderrCap" | "malformed" | "overcap" | "truncated" | "extra" | "hang" | "afterInvokeDeath" | "wrongReady" | "duplicateReady";
function fakeWorker(mode: Mode = "complete", observe?: (frame: Frame) => void, m = marker()): WorkerHandle {
  const stdout = new PassThrough(), stderr = new PassThrough();
  const timing = new WorkerTiming(m.attemptId, m.supervisorPid, 999999, () => 10);
  let config: Frame | undefined, exit: (code: number | null) => void = () => {}, stopped = false;
  const exited = new Promise<number | null>(r => { exit = r; });
  const finish = (code = 0): void => { if (stopped) return; stopped = true; stdout.end(); stderr.end(); exit(code); };
  const emit = (frame: Frame): void => { stdout.write(packet(frame)); };
  const stdin = new Writable({ write(data: Buffer, _encoding, callback) {
    try {
      const frame = JSON.parse(data.subarray(4).toString("utf8")) as Frame; observe?.(frame);
      if (frame["type"] === "CONFIG") {
        config = frame; timing.acceptConfig(frame);
        queueMicrotask(() => {
          if (mode === "hang") return;
          if (mode === "doneOnly") { emit(timing.frame("DONE", { manifestSha256: "c".repeat(64) })); finish(); return; }
          if (mode === "malformed") { stdout.write(Buffer.from([0, 0, 0, 1, 123])); finish(); return; }
          if (mode === "overcap") { const h = Buffer.alloc(4); h.writeUInt32BE(CAPS.frame + 1); stdout.write(h); finish(); return; }
          if (mode === "truncated") { stdout.write(Buffer.from([0, 0, 0])); finish(); return; }
          if (mode === "stderrCap") { stderr.write(Buffer.alloc(CAPS.stderr + 1)); return; }
          emit(timing.startRequest(0));
        });
      } else if (frame["type"] === "ACK") {
        const id = config!["attemptId"]!, ordinal = frame["ordinal"] as number;
        timing.acceptAck(frame);
        queueMicrotask(() => {
          if (mode === "ackDeath") { finish(1); return; }
          emit(timing.frame("GET_INVOKED", { ordinal }));
          if (mode === "afterInvokeDeath") { finish(1); return; }
          emit(timing.frame("RESPONSE_COMPLETED", { ...responseFacts(ordinal, id as string) })); emit(timing.frame("URL_DONE", { ordinal }));
          if (ordinal === 0) emit(timing.startRequest(1));
          else {
            if (mode !== "noDone") emit(timing.frame("DONE", { manifestSha256: "c".repeat(64) }));
            if (mode === "extra") emit(timing.frame("DONE", { manifestSha256: "c".repeat(64) }));
            if (mode === "stderr") stderr.write("synthetic stderr");
            finish(mode === "nonzero" ? 9 : 0);
          }
        });
      }
      callback();
    } catch (e) { callback(e as Error); }
  } });
  queueMicrotask(() => {
    if (mode === "hang") return;
    const ready = timing.ready(); emit(mode === "wrongReady" ? { ...ready, workerPid: 123 } : ready);
    if (mode === "duplicateReady") emit(ready);
  });
  return { pid: 999999, stdin, stdout, stderr, exited, kill: () => finish(143), destroy: () => { stdin.destroy(); stdout.destroy(); stderr.destroy(); } };
}
function syntheticContext(path: string, mode: Mode = "complete"): SyntheticContext {
  const identity = syntheticIdentity();
  return { scope: "OFFLINE_SYNTHETIC", operationPath: join(path, "operation"), preflight: () => {},
    eligibility: () => JSON.parse(encoded(identity).toString("utf8")) as Identity,
    spawn: m => fakeWorker(mode, undefined, m), validate: async () => {}, recheck: () => {}, writeCompletion: async () => {} };
}
function syntheticIdentity(): Identity { return { ...authority(), sourceHashes: sourceHashes(), bindings: PINS, executionBindingSha256: "d".repeat(64) }; }
const proofPath = `${SOURCE}/verification-999/receipt.json`;
const eligibilityPaths = [`${R}/request.json`, `${R}/plan.json`, `${R}/approval1.json`, `${R}/implementation-choice1.json`,
  `${D}/local-inputs-1/inputs/reference/pnpm-lock.yaml`, ...SOURCE_FILES.map(name => `${SOURCE}/${name}`),
  `${SOURCE}/execution-binding1.json`, proofPath, `${SOURCE}/verification-999/source-manifest.json`];
function eligibilityFixture(): { files: Map<string, Buffer>; read: EligibilityReader } {
  const files = new Map<string, Buffer>();
  for (const path of eligibilityPaths.slice(0, 5 + SOURCE_FILES.length)) files.set(path, readRegular(join(ROOT, path), CAPS.expanded));
  const read: EligibilityReader = (path, cap) => { const bytes = files.get(path); assert.ok(bytes, `missing-artifact:${path}`); assert.ok(bytes.length <= cap); return bytes; };
  const auth = authority(read), hashes = sourceHashes(read);
  const manifest = encoded({ sourceHashes: hashes, bindings: PINS, choiceSha256: auth.choiceSha256 });
  const receipt = encoded({ status: "PASS_OFFLINE_ONLY", sourceHashes: hashes, bindings: PINS, choiceSha256: auth.choiceSha256,
    actualGetRequests: 0, productionEntryInvoked: false, productionRootsTouched: false, testsPassed: 1, typecheckExitCode: 0, sourceManifestSha256: sha(manifest) });
  files.set(`${SOURCE}/verification-999/source-manifest.json`, manifest); files.set(proofPath, receipt);
  files.set(`${SOURCE}/execution-binding1.json`, encoded({ version: "chess-coach.bun-execution-binding.v1", grantId: GRANT, nonAuthorizing: true,
    sourceHashes: hashes, bindings: PINS, choiceSha256: auth.choiceSha256, verificationReceipt: { path: proofPath, sha256: sha(receipt) },
    reviews: { backend: "READY", devops: "READY", adversarial: "READY", security: "READY" } }));
  return { files, read };
}
function provisionalFixture(): { receipt: Frame; marker: Marker; identity: Identity; outer: OuterWitness } {
  const identity = syntheticIdentity(), origin = 1000;
  const m: Marker = { attemptId: "synthetic-finalization", supervisorPid: process.pid, supervisorDomain: clockDomain("synthetic-finalization", "supervisor", process.pid), origin, workDeadline: origin + CAPS.workMs, operationDeadline: origin + CAPS.operationMs };
  const receipt: Frame = { version: "chess-coach.bun-acquisition-receipt.v1", grantId: GRANT, ...m, terminalState: "PROVISIONAL_PASS", failure: null,
    identity: identity as unknown as Frame, combinedAttemptsConsumed: 1, remainingCombinedAttempts: 0, urlStartsConsumed: 2, actualGetRequests: 2,
    confirmedGetInvocations: 2, responsesCompleted: 2, urlsCompleted: 2, workerReaped: true, workerExitCode: 0, clockFailure: false, cleanupFailure: false, pipesDestroyed: true,
    workerStdoutEof: true, workerStderrEof: true, doneEvidenceReceived: true, eligibilityRevalidated: true, selectedHashesAndMembershipVerified: true,
    bindingRechecked: true, selectedManifestSha256: "c".repeat(64), offlineSynthetic: false, interrupted: false,
    workerPid: 999999, workerDomain: clockDomain(m.attemptId, "worker", 999999), workerTiming: { clockDomain: clockDomain(m.attemptId, "worker", 999999), workerStartMonoMs: 10, requestStartsMonoMs: [11, 12] },
    deadlineSnapshot: { clockDomain: m.supervisorDomain, observedMonoMs: origin, operationDeadlineMonoMs: m.operationDeadline, observedExceeded: false } };
  return { receipt, marker: m, identity, outer: { clockDomain: clockDomain("synthetic-outer", "outer", process.pid), exitCode: 0, stdoutEof: true, stderrEof: true, stderrBytes: 0, startedMonoMs: 900, completionObservedMonoMs: 1100, timedOut: false } };
}
function completionLine(receipt: Frame): Buffer {
  return Buffer.concat([encoded({ type: "COMPLETION_CANDIDATE", attemptId: receipt["attemptId"], consumptionReceiptSha256: sha(encoded(receipt)),
    supervisorDomain: receipt["supervisorDomain"], originMonoMs: receipt["origin"], operationDeadlineMonoMs: receipt["operationDeadline"], candidatePreparationMonoMs: receipt["origin"] }), Buffer.from("\n")]);
}
function transport(data: Buffer, statusCode = 200, headers: HttpResponse["headers"] = {}): Transport {
  return async () => ({ statusCode, headers, body: (async function* () { yield data; })() });
}
function selectedFixture(): { base: string; bound: ArchiveSpec[]; protocol: Protocol; marker: Marker } {
  const base = fixture(), m = marker(), p = new Protocol(m, () => {});
  fresh(join(base, "synthetic-raw")); fresh(join(base, "synthetic-selected")); fresh(join(base, "synthetic-selected", "files"));
  const archives = specs.map(s => archive(required(s), s)), bound = archives.map(a => a.bound);
  const inspections = archives.map(a => inspectVerifiedArchive(a.raw, a.bound));
  for (const [ordinal, a] of archives.entries()) {
    exclusive(join(base, "synthetic-raw", a.bound.archiveFile), a.raw, CAPS.archive);
    p.accept({ type: "URL_START", attemptId: m.attemptId, ordinal }); p.accept({ type: "GET_INVOKED", attemptId: m.attemptId, ordinal });
    p.accept({ type: "RESPONSE_COMPLETED", attemptId: m.attemptId, ordinal, bytes: a.raw.length, sha256: sha(a.raw), sha512: createHash("sha512").update(a.raw).digest("hex") });
    p.accept({ type: "URL_DONE", attemptId: m.attemptId, ordinal });
  }
  const manifest = encoded(selectedManifest(inspections, bound, m.attemptId));
  exclusive(join(base, "synthetic-selected", "selected-input-manifest.json"), manifest);
  for (const f of inspections.flatMap(i => i.files)) exclusive(join(base, "synthetic-selected", "files", f.retainedFile), f.data, CAPS.selected);
  p.accept({ type: "DONE", attemptId: m.attemptId, manifestSha256: sha(manifest) });
  return { base, bound, protocol: p, marker: m };
}

test("immutable authority hashes and exact production paths remain bound", () => {
  const auth = authority(); assert.equal(auth.plan.archives.length, 2); assert.deepEqual(auth.plan.archives.map(a => a.url), [...URLS]);
  assert.equal(OP, `${R}/acquisition-execution-1`); assert.equal(auth.plan.selectedSourcesRoot, `${OUTPUT}/files`); assert.equal(auth.plan.archiveRoot, RAW);
  assert.equal(Object.keys(PINS).length, 4); assert.equal(Object.keys(sourceHashes()).length, 5);
});
test("pure review gate requires backend devops adversarial security exactly", () => {
  assert.doesNotThrow(() => validateReviewGate({ backend: "READY", devops: "READY", adversarial: "READY", security: "READY" }));
  assert.throws(() => validateReviewGate({ spec: "READY", devops: "READY", adversarial: "READY", security: "READY" }), /review-gate/);
  assert.throws(() => validateReviewGate({ backend: "READY", devops: "READY", adversarial: "READY", security: "READY", spec: "READY" }), /review-gate/);
});
for (const role of ["backend", "devops", "adversarial", "security"]) test(`pure review gate rejects missing or unready ${role}`, () => {
  const roles: Record<string, string> = { backend: "READY", devops: "READY", adversarial: "READY", security: "READY" };
  roles[role] = "NOT_READY"; assert.throws(() => validateReviewGate(roles), /review-gate/);
  delete roles[role]; assert.throws(() => validateReviewGate(roles), /review-gate/);
});
test("pure equality requires matching own keys rather than inherited fallbacks", () => {
  const inherited = Object.assign(Object.create({ backend: "READY" }) as object, { spec: "READY" });
  assert.equal(equal({ backend: "READY" }, inherited), false); assert.equal(equal(inherited, { backend: "READY" }), false);
  assert.equal(equal({ nested: { backend: "READY" } }, { nested: inherited }), false);
});
test("pure equality rejects __proto__ key substitution and preserves legitimate own JSON keys", () => {
  const a: unknown = JSON.parse('{"__proto__":{"ready":true}}');
  assert.equal(equal(a, { other: { ready: true } }), false);
  assert.equal(equal(JSON.parse('{"__proto__":{}}') as unknown, { other: {} }), false);
  assert.equal(equal(a, JSON.parse('{"__proto__":{"ready":true}}') as unknown), true);
  const inherited = Object.assign(Object.create({ required: "READY" }) as object, { replacement: "READY" });
  assert.equal(equal({ required: "READY" }, inherited), false);
});
test("eligibility reads an entirely synthetic binding and proof without creating real binding files", () => {
  const f = eligibilityFixture(), identity = validateEligibility(f.read); assert.equal(identity.executionBindingSha256, sha(f.files.get(`${SOURCE}/execution-binding1.json`)!));
});
for (const missing of eligibilityPaths) test(`missing offline eligibility artifact consumes no attempt: ${missing.split("/").slice(-2).join("/")}`, async () => {
  const f = eligibilityFixture(), ctx = syntheticContext(fixture()); f.files.delete(missing); let preflight = false;
  ctx.eligibility = () => validateEligibility(f.read); ctx.preflight = () => { preflight = true; };
  await assert.rejects(superviseCapture(ctx), /missing-artifact/);
  assert.equal(fs.existsSync(ctx.operationPath), false); assert.equal(preflight, false);
});
test("eligibility completes before claim and runtime preflight follows claim", async () => {
  const ctx = syntheticContext(fixture()), original = ctx.eligibility; let checks = 0;
  ctx.eligibility = () => { checks++; assert.equal(fs.existsSync(ctx.operationPath), checks !== 1); return original(); };
  ctx.preflight = () => { assert.equal(checks, 2); assert.ok(fs.existsSync(join(ctx.operationPath, "attempt.json"))); };
  assert.equal((await superviseCapture(ctx))["terminalState"], "PROVISIONAL_PASS"); assert.equal(checks, 2);
});
test("post-claim eligibility drift consumes the attempt without spawning a worker", async () => {
  const ctx = syntheticContext(fixture()), original = ctx.eligibility; let calls = 0, spawned = false;
  ctx.eligibility = () => { const identity = original(); if (++calls === 2) identity.executionBindingSha256 = "f".repeat(64); return identity; };
  ctx.spawn = m => { spawned = true; return fakeWorker("complete", undefined, m); };
  const receipt = await superviseCapture(ctx); assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["combinedAttemptsConsumed"], 1); assert.equal(spawned, false); assert.equal(receipt["failure"], "post-claim-eligibility-drift");
});
test("post-claim eligibility read failure consumes the attempt before runtime preflight", async () => {
  const ctx = syntheticContext(fixture()), original = ctx.eligibility; let calls = 0, runtime = false;
  ctx.eligibility = () => { if (++calls === 2) throw new Error("post-claim-proof-missing"); return original(); };
  ctx.preflight = () => { runtime = true; };
  const receipt = await superviseCapture(ctx); assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["combinedAttemptsConsumed"], 1); assert.equal(runtime, false);
});
test("time spent checking eligibility never resets the original budget", async () => {
  let time = 100; const ctx = syntheticContext(fixture()), original = ctx.eligibility; ctx.clock = () => time;
  ctx.eligibility = () => { const identity = original(); if (!fs.existsSync(ctx.operationPath)) time += 700; return identity; };
  const receipt = await superviseCapture(ctx); assert.equal(receipt["origin"], 100); assert.equal(receipt["operationDeadline"], 100 + CAPS.operationMs);
});
test("eligibility exhausting original work budget rejects before claim", async () => {
  let time = 0; const ctx = syntheticContext(fixture()), original = ctx.eligibility; ctx.clock = () => time;
  ctx.eligibility = () => { time = CAPS.workMs; return original(); };
  await assert.rejects(superviseCapture(ctx), /absolute-deadline/); assert.equal(fs.existsSync(ctx.operationPath), false);
});
test("exclusive concurrent claim permits exactly one winner", async () => {
  const operation = join(fixture(), "operation");
  const results = await Promise.allSettled([Promise.resolve().then(() => claimAttempt(operation)), Promise.resolve().then(() => claimAttempt(operation))]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(results.filter(r => r.status === "rejected").length, 1);
});
for (const interrupted of [false, true]) test(`existing ${interrupted ? "empty interrupted" : "claimed"} marker blocks replay`, () => {
  const path = join(fixture(), "operation"); if (interrupted) fresh(path); else claimAttempt(path);
  assert.throws(() => claimAttempt(path), /EEXIST/);
});
test("attempt consumption precedes failing operational preflight", async () => {
  const ctx = syntheticContext(fixture()); let spawned = false;
  ctx.preflight = () => { assert.ok(fs.existsSync(join(ctx.operationPath, "attempt.json"))); throw new Error("preflight-fail"); };
  ctx.spawn = m => { spawned = true; return fakeWorker("complete", undefined, m); };
  const receipt = await superviseCapture(ctx); assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["combinedAttemptsConsumed"], 1); assert.equal(spawned, false);
});
test("durable URL_START journal precedes ACK", async () => {
  const path = fixture(), ctx = syntheticContext(path); let acks = 0;
  ctx.spawn = m => fakeWorker("complete", f => {
    if (f["type"] === "ACK") { const journal = fs.readFileSync(join(ctx.operationPath, "events.jsonl"), "utf8"); assert.match(journal, new RegExp(`"ordinal":${f["ordinal"]}`)); acks++; }
  }, m);
  assert.equal((await superviseCapture(ctx))["terminalState"], "PROVISIONAL_PASS"); assert.equal(acks, 2);
});
test("journal write failure prevents ACK and request invocation", () => {
  const p = new Protocol(marker(), () => { throw new Error("journal-write-failed"); });
  assert.throws(() => p.accept({ type: "URL_START", attemptId: "synthetic", ordinal: 0 }), /journal-write-failed/);
  assert.equal(p.invoked.size, 0); assert.equal(p.starts, 0);
});
test("journal reserves terminal capacity", () => {
  const j = new Journal(join(fixture(), "events.jsonl"));
  try {
    assert.throws(() => { for (let i = 0; i < 1000; i++) j.append({ type: "SYNTHETIC", data: "x".repeat(256) }); }, /journal-cap/);
    assert.doesNotThrow(() => j.append({ type: "TERMINAL", terminalState: "FAIL" }, true));
  } finally { j.close(); }
});
test("START and ACK alone leave GET issuance unknown", () => {
  const p = new Protocol(marker(), () => {}); const ack = p.accept({ type: "URL_START", attemptId: "synthetic", ordinal: 0 });
  assert.equal(ack?.["type"], "ACK"); assert.equal(p.facts()["actualGetRequests"], null); assert.equal(p.facts()["confirmedGetInvocations"], 0);
});
test("GET invocation and response completion remain separate facts", () => {
  const p = new Protocol(marker(), () => {}); p.accept({ type: "URL_START", attemptId: "synthetic", ordinal: 0 });
  p.accept({ type: "GET_INVOKED", attemptId: "synthetic", ordinal: 0 });
  assert.equal(p.facts()["actualGetRequests"], 1); assert.equal(p.facts()["responsesCompleted"], 0);
});
test("serial URL slots reject second URL before first URL_DONE", () => {
  const p = new Protocol(marker(), () => {}); p.accept({ type: "URL_START", attemptId: "synthetic", ordinal: 0 });
  assert.throws(() => p.accept({ type: "URL_START", attemptId: "synthetic", ordinal: 1 }), /start-order/);
});
test("third GET and duplicate GET invocation are rejected", () => {
  const p = new Protocol(marker(), () => {}); completeProtocol(p);
  assert.throws(() => p.accept({ type: "URL_START", attemptId: "synthetic", ordinal: 2 }), /after-done/);
  const q = new Protocol(marker(), () => {}); q.accept({ type: "URL_START", attemptId: "synthetic", ordinal: 0 }); q.accept({ type: "GET_INVOKED", attemptId: "synthetic", ordinal: 0 });
  assert.throws(() => q.accept({ type: "GET_INVOKED", attemptId: "synthetic", ordinal: 0 }), /duplicate-invocation/);
});
test("GET deadline starts at durable START and never extends with progress", () => {
  let clock = 100; const m = { ...marker(), origin: 100, workDeadline: 100000, operationDeadline: 120100 };
  const p = new Protocol(m, () => { clock += 10; }, () => clock);
  const ack = p.accept({ type: "URL_START", attemptId: "synthetic", ordinal: 0 }); assert.equal(ack?.["remainingGetMs"], 29990);
  clock = 30100; assert.throws(() => p.accept({ type: "GET_INVOKED", attemptId: "synthetic", ordinal: 0 }), /absolute-deadline/);
});
test("deadline elapsed while persisting START prevents ACK", () => {
  let clock = 0; const p = new Protocol({ ...marker(), workDeadline: 10 }, () => { clock = 10; }, () => clock);
  assert.throws(() => p.accept({ type: "URL_START", attemptId: "synthetic", ordinal: 0 }), /duration-invalid-or-exhausted/); assert.equal(p.facts()["actualGetRequests"], null);
});
for (const mode of ["doneOnly", "ackDeath", "noDone", "nonzero", "stderr", "stderrCap", "malformed", "overcap", "truncated", "extra", "afterInvokeDeath"] as const) {
  test(`supervisor rejects ${mode} and uses bounded cleanup`, async () => {
    const ctx = syntheticContext(fixture(), mode), receipt = await superviseCapture(ctx);
    assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["workerReaped"], true);
    if (mode === "ackDeath") assert.equal(receipt["actualGetRequests"], null);
    if (mode === "afterInvokeDeath") { assert.equal(receipt["actualGetRequests"], 1); assert.equal(receipt["responsesCompleted"], 0); }
  });
}
test("spawn failure retains claimed attempt and terminal evidence", async () => {
  const ctx = syntheticContext(fixture()); ctx.spawn = () => { throw new Error("synthetic-spawn-failure"); };
  const receipt = await superviseCapture(ctx); assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["combinedAttemptsConsumed"], 1);
  assert.ok(fs.existsSync(join(ctx.operationPath, "consumption-receipt.json")));
});
test("worker hang and pipe waits have a bounded kill path", async () => {
  const worker = fakeWorker("hang"), p = new CaptureProtocol(marker(12), () => {}), started = now();
  await assert.rejects(superviseWorker(worker, p, { type: "CONFIG", attemptId: "synthetic" }, async () => {}, () => {}), /absolute-deadline/);
  const cleanup = await cleanupWorker(worker, now() + 50); assert.equal(cleanup["workerReaped"], true); assert.equal(cleanup["termSent"], true); assert.ok(now() - started < 500);
});
test("unconfirmed reap remains unresolved without an unbounded wait", async () => {
  const worker = fakeWorker("hang"); worker.kill = () => {}; worker.exited = new Promise(() => {});
  const started = now(), cleanup = await cleanupWorker(worker, now() + 8);
  assert.equal(cleanup["workerReaped"], false); assert.equal(cleanup["reapingUnresolved"], true); assert.ok(now() - started < 500);
});
test("expired cleanup still attempts owned SIGKILL before destroying pipes", async () => {
  const worker = fakeWorker("hang"), events: string[] = [], destroy = worker.destroy;
  worker.exited = new Promise(() => {}); worker.kill = signal => { events.push(signal); };
  worker.destroy = () => { events.push("destroy"); destroy(); };
  const cleanup = await cleanupWorker(worker, 10, () => 10);
  assert.deepEqual(events, ["SIGKILL", "destroy"]); assert.equal(cleanup["killSent"], true); assert.equal(cleanup["workerReaped"], false); assert.equal(cleanup["reapingUnresolved"], true);
});
test("SIGKILL follows ignored SIGTERM with bounded confirmation", async () => {
  const worker = fakeWorker("hang"), kill = worker.kill, signals: string[] = [];
  worker.kill = signal => { signals.push(signal); if (signal === "SIGKILL") kill(signal); };
  const cleanup = await cleanupWorker(worker, now() + 1500);
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]); assert.equal(cleanup["killSent"], true); assert.equal(cleanup["workerReaped"], true);
});
for (const [targetPhase, slots] of [["initial", [1, 2, 3, 4]], ["term", [1, 2]], ["kill", [1, 2, 3, 4]]] as const) {
  for (const slot of slots) for (const fault of ["throw", "regression"] as const) test(`cleanup ${targetPhase} clock boundary ${slot} ${fault} stays tainted after recovery and exit zero`, async () => {
    const worker = fakeWorker("hang"), events: string[] = [], counts = { initial: 0, term: 0, kill: 0 };
    let phase: keyof typeof counts = "initial", injected = false, armed = false, resolveExit: (code: number) => void = () => {};
    worker.exited = new Promise<number>(resolve => { resolveExit = resolve; });
    worker.kill = signal => { events.push(signal); phase = signal === "SIGTERM" ? "term" : "kill"; if (signal === "SIGKILL") resolveExit(0); };
    const destroy = worker.destroy; worker.destroy = () => { events.push("destroy"); destroy(); };
    const read = (): number => {
      if (!armed) return 100;
      if (++counts[phase] === slot && phase === targetPhase && !injected) { injected = true; if (fault === "throw") throw new Error("injected-clock-failure"); return 99; }
      return 100;
    };
    const clock = guardClock(read); clock(); armed = true;
    const cleanup = await cleanupWorker(worker, 10000, clock);
    assert.equal(injected, true); assert.equal(cleanup["clockFailure"], true); assert.equal(cleanup["cleanupFailure"], true); assert.equal(cleanup["pipesDestroyed"], true);
    assert.equal(cleanup["killAttempted"], true); assert.ok(events.includes("SIGKILL")); assert.equal(events.at(-1), "destroy");
    assert.equal(cleanup["workerReaped"], true); assert.equal(cleanup["workerExitCode"], 0); assert.equal(read(), 100);
    const f = provisionalFixture(); Object.assign(f.receipt, cleanup);
    assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), f.outer, f.identity), "FAIL");
  });
}
for (const invalid of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) test(`cleanup invalid clock ${String(invalid)} still attempts SIGKILL and destroys pipes`, async () => {
  const worker = fakeWorker("hang"), events: string[] = []; worker.exited = new Promise(() => {}); worker.kill = signal => { events.push(signal); };
  const cleanup = await cleanupWorker(worker, 1000, () => invalid);
  assert.deepEqual(events, ["SIGKILL"]); assert.equal(cleanup["clockFailure"], true); assert.equal(cleanup["cleanupFailure"], true);
  assert.equal(cleanup["workerReaped"], false); assert.equal(cleanup["reapingUnresolved"], true); assert.equal(cleanup["pipesDestroyed"], true);
});
test("cleanup kill throwing cannot bypass pipe destruction or invent termination confirmation", async () => {
  const worker = fakeWorker("hang"), events: string[] = []; worker.exited = new Promise(() => {});
  worker.kill = signal => { events.push(signal); throw new Error("kill-failed"); };
  const cleanup = await cleanupWorker(worker, 100, () => 100);
  assert.deepEqual(events, ["SIGKILL"]); assert.equal(cleanup["killAttempted"], true); assert.equal(cleanup["killSent"], false);
  assert.equal(cleanup["cleanupFailure"], true); assert.equal(cleanup["pipesDestroyed"], true); assert.equal(cleanup["workerReaped"], false);
});
test("cleanup TERM throwing still attempts KILL and closes every pipe", async () => {
  const worker = fakeWorker("hang"), events: string[] = []; worker.exited = new Promise(() => {});
  worker.kill = signal => { events.push(signal); if (signal === "SIGTERM") throw new Error("term-failed"); };
  const cleanup = await cleanupWorker(worker, now() + 30);
  assert.deepEqual(events, ["SIGTERM", "SIGKILL"]); assert.equal(cleanup["termAttempted"], true); assert.equal(cleanup["termSent"], false);
  assert.equal(cleanup["cleanupFailure"], true); assert.equal(cleanup["pipesDestroyed"], true);
});
test("cleanup destroy throwing falls back to all pipes but disqualifies an observed exit zero", async () => {
  const worker = fakeWorker("hang"); worker.exited = Promise.resolve(0); worker.destroy = () => { throw new Error("destroy-failed"); };
  const cleanup = await cleanupWorker(worker, now() + 100);
  assert.equal(cleanup["workerReaped"], true); assert.equal(cleanup["workerExitCode"], 0); assert.equal(cleanup["clockFailure"], false);
  assert.equal(cleanup["cleanupFailure"], true); assert.equal(cleanup["pipesDestroyed"], true);
  const f = provisionalFixture(); Object.assign(f.receipt, cleanup); assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), f.outer, f.identity), "FAIL");
});
test("cleanup attempts every pipe even when one pipe destroy throws", async () => {
  const worker = fakeWorker("hang"), destroyInput = worker.stdin.destroy.bind(worker.stdin); worker.exited = Promise.resolve(0);
  worker.destroy = () => { throw new Error("aggregate-destroy-failed"); };
  worker.stdin.destroy = () => { throw new Error("input-destroy-failed"); };
  try {
    const cleanup = await cleanupWorker(worker, now() + 100);
    assert.equal(cleanup["cleanupFailure"], true); assert.equal(cleanup["pipesDestroyed"], false); assert.equal(worker.stdout.destroyed, true); assert.equal(worker.stderr.destroyed, true);
  } finally { destroyInput(); }
});
test("cleanup exit observation rejection keeps reaping unresolved and attempts owned termination", async () => {
  const worker = fakeWorker("hang"), events: string[] = []; worker.exited = Promise.reject(new Error("exit-observation-failed")); worker.kill = signal => { events.push(signal); };
  const cleanup = await cleanupWorker(worker, now() + 100);
  assert.equal(cleanup["cleanupFailure"], true); assert.equal(cleanup["workerReaped"], false); assert.equal(cleanup["workerExitCode"], null);
  assert.ok(events.includes("SIGKILL")); assert.equal(cleanup["pipesDestroyed"], true);
});
for (const fault of ["throw", "regression"] as const) test(`complete synthetic capture rejects recovered cleanup ${fault} after worker exit zero`, async () => {
  const ctx = syntheticContext(fixture()), factory = ctx.spawn, lines: Buffer[] = []; let reads = 0, inject = false, injected = false;
  ctx.clock = () => { if (inject && !injected) { injected = true; if (fault === "throw") throw new Error("cleanup-clock-failed"); return 99; } return 100; };
  ctx.spawn = m => {
    const worker = factory(m), exited = worker.exited;
    Object.defineProperty(worker, "exited", { get() { if (++reads === 2) inject = true; return exited; } }); return worker;
  };
  ctx.writeCompletion = async line => { lines.push(Buffer.from(line)); };
  const receipt = await superviseCapture(ctx), cliExitCode = receipt["terminalState"] === "PROVISIONAL_PASS" ? 0 : 1;
  assert.equal(injected, true); assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["workerExitCode"], 0); assert.equal(receipt["workerReaped"], true);
  assert.equal(receipt["clockFailure"], true); assert.equal(receipt["cleanupFailure"], true); assert.equal(receipt["failure"], "cleanup-clock-failure"); assert.equal(lines.length, 0);
  assert.equal(cliExitCode, 1);
  const stored = JSON.parse(readRegular(join(ctx.operationPath, "consumption-receipt.json"), CAPS.receipt).toString("utf8")) as Frame;
  assert.equal(stored["terminalState"], "FAIL"); assert.equal(stored["clockFailure"], true);
});
test("complete synthetic capture cannot emit a candidate after destroy failure", async () => {
  const ctx = syntheticContext(fixture()), factory = ctx.spawn; let lines = 0;
  ctx.spawn = m => { const worker = factory(m); worker.destroy = () => { throw new Error("destroy-failed"); }; return worker; };
  ctx.writeCompletion = async () => { lines++; };
  const receipt = await superviseCapture(ctx); assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["cleanupFailure"], true);
  assert.equal(receipt["clockFailure"], false); assert.equal(receipt["workerExitCode"], 0); assert.equal(receipt["pipesDestroyed"], true); assert.equal(lines, 0);
});
for (const [field, value] of [["clockFailure", true], ["cleanupFailure", true], ["pipesDestroyed", false]] as const) test(`otherwise valid provisional receipt cannot qualify or emit a candidate with ${field}=${value}`, async () => {
  const f = provisionalFixture(); f.receipt[field] = value;
  assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), f.outer, f.identity), "FAIL");
  let touched = false;
  await assert.rejects(finalizeCapture(f.receipt, f.marker, { journalCandidate: () => { touched = true; }, closeJournal: () => { touched = true; }, persistReceipt: () => { touched = true; },
    writeCompletion: async () => { touched = true; } }, () => f.marker.origin), /cleanup-taint-disqualifies-candidate/);
  assert.equal(touched, false);
});
for (const field of ["clockFailure", "cleanupFailure", "pipesDestroyed"]) test(`operational assessment rejects missing cleanup evidence ${field}`, () => {
  const f = provisionalFixture(); delete f.receipt[field];
  assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), f.outer, f.identity), "FAIL");
});
test("DONE and exit zero cannot bypass incomplete stderr pipe", async () => {
  const worker = fakeWorker(), pipe = new PassThrough(); worker.stderr = pipe;
  const p = new CaptureProtocol(marker(15), () => {});
  await assert.rejects(superviseWorker(worker, p, { executionBindingSha256: "synthetic" }, async () => {}, () => {}), /absolute-deadline/);
  await cleanupWorker(worker, now() + 20); pipe.destroy();
});
test("interruption shares cleanup and never reports PASS", async () => {
  const ctx = syntheticContext(fixture()); ctx.validate = async () => { process.emit("SIGTERM"); };
  await assert.rejects(superviseCapture(ctx), /supervisor-interrupted/);
  const receipt = JSON.parse(readRegular(join(ctx.operationPath, "consumption-receipt.json"), CAPS.receipt).toString("utf8")) as Frame;
  assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["interrupted"], true); assert.equal(receipt["workerReaped"], true);
});
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) test(`late ${signal} during completion rejects and restores all signal handlers`, async () => {
  const ctx = syntheticContext(fixture()), lines: Buffer[] = []; let priorCalls = 0, mockWorkers = 0;
  const prior = (): void => { priorCalls++; };
  process.on(signal, prior);
  const signals = ["SIGTERM", "SIGINT", "SIGHUP"] as const;
  const before = signals.map(name => process.rawListeners(name));
  const factory = ctx.spawn; ctx.spawn = m => { mockWorkers++; return factory(m); };
  ctx.writeCompletion = async line => { lines.push(Buffer.from(line)); process.emit(signal); };
  try {
    await assert.rejects(superviseCapture(ctx), /supervisor-interrupted/);
    assert.equal(priorCalls, 1); assert.equal(mockWorkers, 1); assert.equal(lines.length, 1);
    for (const [index, name] of signals.entries()) assert.deepEqual(process.rawListeners(name), before[index]);
    const stored = readRegular(join(ctx.operationPath, "consumption-receipt.json"), CAPS.receipt), receipt = JSON.parse(stored.toString("utf8")) as Frame;
    assert.equal(receipt["terminalState"], "PROVISIONAL_PASS"); assert.equal(receipt["offlineSynthetic"], true);
    assert.equal((JSON.parse(lines[0]!.toString("utf8")) as Frame)["consumptionReceiptSha256"], sha(stored));
    const f = provisionalFixture(); assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), { ...f.outer, exitCode: 1 }, f.identity), "FAIL");
  } finally { process.off(signal, prior); }
});
for (const fault of ["late-signal", "cleanup-clock"] as const) test(`synthetic fake-worker CLI exits nonzero on ${fault}`, async () => {
  const base = fixture(), script = join(base, "late-signal-cli.ts");
  const source = `import { PassThrough, Writable } from "node:stream";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { superviseCapture, authority, sourceHashes, PINS, encoded, WorkerTiming } from ${JSON.stringify(join(ROOT, SOURCE, "capture.ts"))};
const stdout = new PassThrough(), stderr = new PassThrough();
let resolveExit;
const exited = new Promise(resolve => { resolveExit = resolve; });
function emit(frame) { const body = encoded(frame), head = Buffer.alloc(4); head.writeUInt32BE(body.length); stdout.write(Buffer.concat([head, body])); }
let timing;
const stdin = new Writable({ write(data, _encoding, callback) {
  const frame = JSON.parse(data.subarray(4).toString("utf8"));
  if (frame.type === "CONFIG") { timing.acceptConfig(frame); queueMicrotask(() => emit(timing.startRequest(0))); }
  if (frame.type === "ACK") queueMicrotask(() => {
    const ordinal = frame.ordinal;
    timing.acceptAck(frame);
    emit(timing.frame("GET_INVOKED", { ordinal }));
    emit(timing.frame("RESPONSE_COMPLETED", { ordinal, bytes: 3, sha256: "a".repeat(64), sha512: "b".repeat(128) }));
    emit(timing.frame("URL_DONE", { ordinal }));
    if (ordinal === 0) emit(timing.startRequest(1));
    else { emit(timing.frame("DONE", { manifestSha256: "c".repeat(64) })); stdout.end(); stderr.end(); resolveExit(0); }
  });
  callback();
} });
const worker = { pid: 999999, stdin, stdout, stderr, exited, kill() {}, destroy() { stdin.destroy(); stdout.destroy(); stderr.destroy(); } };
const fault = ${JSON.stringify(fault)}; let exitReads = 0, injectClock = false, clockInjected = false;
Object.defineProperty(worker, "exited", { get() { if (++exitReads === 2 && fault === "cleanup-clock") injectClock = true; return exited; } });
const identity = { ...authority(), sourceHashes: sourceHashes(), bindings: PINS, executionBindingSha256: "d".repeat(64) };
try {
  const receipt = await superviseCapture({ scope: "OFFLINE_SYNTHETIC", operationPath: join(dirname(fileURLToPath(import.meta.url)), "operation"),
    clock: () => { if (injectClock && !clockInjected) { clockInjected = true; return 999; } return 1000; }, eligibility: () => identity, preflight() {}, spawn: marker => { timing = new WorkerTiming(marker.attemptId, marker.supervisorPid, worker.pid, () => 10); queueMicrotask(() => emit(timing.ready())); return worker; }, validate: async () => {}, recheck() {},
    writeCompletion: async line => { await new Promise((resolve, reject) => process.stdout.write(line, error => error ? reject(error) : resolve())); process.emit("SIGTERM"); } });
  process.exitCode = receipt.terminalState === "PROVISIONAL_PASS" ? 0 : 1;
} catch (error) { process.stderr.write(error.message + "\\n"); process.exitCode = 1; }
`;
  exclusive(script, Buffer.from(source));
  const startedMonoMs = now(), child = spawn(BUN, ["--no-env-file", "--no-install", script], {
    cwd: ROOT, env: { LANG: "C", LC_ALL: "C" }, stdio: ["ignore", "pipe", "pipe"], shell: false,
  });
  const out: Buffer[] = [], err: Buffer[] = []; let stdoutBytes = 0, stderrBytes = 0, stdoutEof = false, stderrEof = false;
  let exitCode: number | null = null, signal: string | null = null;
  child.stdout.on("data", (data: Buffer) => { stdoutBytes += data.length; if (stdoutBytes <= CAPS.frame) out.push(Buffer.from(data)); else child.kill("SIGKILL"); });
  child.stderr.on("data", (data: Buffer) => { stderrBytes += data.length; if (stderrBytes <= CAPS.stderr) err.push(Buffer.from(data)); else child.kill("SIGKILL"); });
  child.stdout.once("end", () => { stdoutEof = true; }); child.stderr.once("end", () => { stderrEof = true; });
  child.once("exit", (code, sig) => { exitCode = code; signal = sig; });
  const closed = new Promise<void>((resolveClose, reject) => { child.once("close", () => resolveClose()); child.once("error", reject); });
  void closed.catch(() => {});
  try { await bounded(closed, now() + 3000); }
  finally {
    if (exitCode === null) { child.kill("SIGKILL"); await bounded(closed, now() + 1000); }
    child.stdout.destroy(); child.stderr.destroy();
  }
  const completionObservedMonoMs = now(), output = Buffer.concat(out), errors = Buffer.concat(err);
  assert.ok(completionObservedMonoMs - startedMonoMs < 4000);
  assert.equal(exitCode, 1); assert.equal(signal, null); assert.equal(stdoutEof, true); assert.equal(stderrEof, true);
  assert.ok(stdoutBytes <= CAPS.frame && stderrBytes <= CAPS.stderr);
  const stored = readRegular(join(base, "operation", "consumption-receipt.json"), CAPS.receipt), receipt = JSON.parse(stored.toString("utf8")) as Frame;
  if (fault === "cleanup-clock") {
    assert.equal(output.length, 0); assert.equal(errors.length, 0); assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["clockFailure"], true);
    assert.equal(receipt["cleanupFailure"], true); assert.equal(receipt["workerExitCode"], 0); assert.equal(receipt["workerReaped"], true); return;
  }
  assert.match(errors.toString("utf8"), /supervisor-interrupted/);
  const candidate = JSON.parse(output.toString("utf8")) as Frame;
  assert.equal(receipt["terminalState"], "PROVISIONAL_PASS"); assert.equal(receipt["offlineSynthetic"], true); assert.equal(candidate["consumptionReceiptSha256"], sha(stored));
  const analogue: Frame = { ...receipt, offlineSynthetic: false }, bytes = encoded(analogue);
  const matchingLine = Buffer.concat([encoded({ ...candidate, consumptionReceiptSha256: sha(bytes) }), Buffer.from("\n")]);
  const witness: OuterWitness = { clockDomain: clockDomain("synthetic-cli-observer", "outer", process.pid), exitCode, stdoutEof, stderrEof, stderrBytes, startedMonoMs, completionObservedMonoMs, timedOut: false };
  const identity = receipt["identity"] as unknown as Identity;
  assert.equal(assessCapture(stored, output, witness, identity), "FAIL");
  const analogueWitness = { ...witness, stderrBytes: 0 };
  assert.equal(assessCapture(bytes, matchingLine, { ...analogueWitness, exitCode: 0 }, identity), "PASS");
  assert.equal(assessCapture(bytes, matchingLine, analogueWitness, identity), "FAIL");
});
test("source drift after DONE prevents PASS", async () => {
  const ctx = syntheticContext(fixture()); ctx.recheck = () => { throw new Error("completion-source-drift"); };
  assert.equal((await superviseCapture(ctx))["terminalState"], "FAIL");
});
test("selected verification failure after DONE prevents PASS", async () => {
  const ctx = syntheticContext(fixture()); ctx.validate = async () => { throw new Error("selected-file-hash"); };
  assert.equal((await superviseCapture(ctx))["terminalState"], "FAIL");
});
test("whole-operation deadline starts before preflight and includes finalization reserve", async () => {
  let time = 0; const ctx = syntheticContext(fixture()); ctx.clock = () => time;
  ctx.preflight = () => { time = CAPS.workMs; };
  const receipt = await superviseCapture(ctx); assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["origin"], 0); assert.equal(receipt["workerNotStarted"], true);
});
test("time consumed by validation cannot extend total operation deadline", async () => {
  let time = 0; const ctx = syntheticContext(fixture()); ctx.clock = () => time;
  ctx.validate = async () => { time = CAPS.operationMs - 500; };
  const receipt = await superviseCapture(ctx); assert.equal(receipt["terminalState"], "FAIL"); assert.equal((receipt["deadlineSnapshot"] as Frame)["observedExceeded"], false);
});
test("final binding recheck consumes the reserved finalization deadline", async () => {
  let time = 0, checks = 0; const ctx = syntheticContext(fixture()); ctx.clock = () => time;
  ctx.recheck = () => { if (++checks === 2) time = CAPS.operationMs - 500; };
  const receipt = await superviseCapture(ctx); assert.equal(checks, 2); assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["failure"], "absolute-deadline");
});
test("observed total deadline overrun produces no PASS receipt", async () => {
  let time = 0, checks = 0; const ctx = syntheticContext(fixture()); ctx.clock = () => time;
  ctx.recheck = () => { if (++checks === 2) time = CAPS.operationMs; };
  await assert.rejects(superviseCapture(ctx), /absolute-deadline/);
  assert.equal(fs.existsSync(join(ctx.operationPath, "consumption-receipt.json")), false);
});
test("synthetic context rejects production paths before claim", async () => {
  const ctx = syntheticContext(fixture()); ctx.operationPath = join(ROOT, OP);
  await assert.rejects(superviseCapture(ctx), /synthetic-root-only/);
});
test("frame parser rejects noncanonical duplicate keys", async () => {
  const input = new PassThrough(), frames = new Frames(input), payload = Buffer.from('{"type":"A","type":"B"}'), h = Buffer.alloc(4); h.writeUInt32BE(payload.length);
  input.end(Buffer.concat([h, payload])); await assert.rejects(frames.read(now() + 100), /noncanonical-or-duplicate/); input.destroy();
});
test("frame parser enforces byte caps before payload accumulation", async () => {
  const input = new PassThrough(), frames = new Frames(input), h = Buffer.alloc(4); h.writeUInt32BE(0xffffffff); input.write(h);
  await assert.rejects(frames.read(now() + 100), /frame-cap/); input.destroy();
});
test("frame parser enforces aggregate stdout cap", async () => {
  const input = new PassThrough(), frames = new Frames(input); input.write(Buffer.alloc(CAPS.stdout + 1));
  await assert.rejects(frames.read(now() + 100), /stdout-cap/); input.destroy();
});
test("frame parser handles fragmented header and payload", async () => {
  const input = new PassThrough(), frames = new Frames(input), p = packet({ type: "SYNTHETIC" });
  for (const b of p) input.write(Buffer.from([b])); input.end();
  assert.deepEqual(await frames.read(now() + 100), { type: "SYNTHETIC" }); assert.equal(await frames.read(now() + 100), null);
});
test("ACK pipe write and output callbacks are bounded", async () => {
  const sink = new Writable({ write() {} });
  await assert.rejects(sendFrame(sink, { type: "ACK" }, now() + 8), /absolute-deadline/); sink.destroy();
});
test("offline mocked HTTP captures bytes and separate invocation/response facts", async () => {
  const data = Buffer.from("synthetic archive"), events: string[] = [], written: Buffer[] = [];
  const result = await downloadArchive(withIntegrity(data), { write: b => { written.push(b); } }, { transport: transport(data), deadline: now() + 100, event: async type => { events.push(type); } });
  assert.deepEqual(events, ["GET_INVOKED", "RESPONSE_COMPLETED"]); assert.ok(result.data.equals(data)); assert.ok(Buffer.concat(written).equals(data));
});
for (const status of [301, 302, 404, 500]) test(`HTTP ${status} never redirects or retries`, async () => {
  let calls = 0; const data = Buffer.from("synthetic");
  await assert.rejects(downloadArchive(withIntegrity(data), { write() {} }, { transport: async (s, a) => { calls++; return transport(data, status)(s, a); }, deadline: now() + 100, event: async () => {} }), /http-status/);
  assert.equal(calls, 1);
});
test("HTTP content encoding other than identity is rejected", async () => {
  const data = Buffer.from("synthetic"); await assert.rejects(downloadArchive(withIntegrity(data), { write() {} }, { transport: transport(data, 200, { "content-encoding": "gzip" }), deadline: now() + 100, event: async () => {} }), /http-content-encoding/);
});
test("actual streamed archive cap rejects before oversized write", async () => {
  const data = Buffer.alloc(CAPS.archive + 1); let wrote = false;
  await assert.rejects(downloadArchive(withIntegrity(data), { write() { wrote = true; } }, { transport: transport(data), deadline: now() + 100, event: async () => {} }), /archive-byte-cap/); assert.equal(wrote, false);
});
test("absolute DNS/connect stall deadline aborts transport", async () => {
  let aborted = false;
  await assert.rejects(downloadArchive(spec, { write() {} }, { transport: (_s, signal) => { signal.addEventListener("abort", () => { aborted = true; }); return new Promise(() => {}); }, deadline: now() + 8, event: async () => {} }), /absolute-deadline/); assert.equal(aborted, true);
});
test("absolute deadline rejects drip streams without refreshing timer", async () => {
  let time = 0;
  await assert.rejects(downloadArchive(spec, { write() {} }, { clock: () => time, deadline: 10, event: async () => {}, transport: async () => ({ statusCode: 200, headers: {}, body: (async function* () { for (let n = 0; n < 20; n++) { time++; yield Buffer.from("x"); } })() }) }), /absolute-deadline/);
});
test("response completion does not imply valid archive SRI", async () => {
  const events: string[] = [];
  await assert.rejects(downloadArchive(spec, { write() {} }, { transport: transport(Buffer.from("bad SRI")), deadline: now() + 100, event: async t => { events.push(t); } }), /archive-sri/);
  assert.deepEqual(events, ["GET_INVOKED", "RESPONSE_COMPLETED"]);
});
test("SRI check precedes every inflation attempt", () => { assert.throws(() => inspectVerifiedArchive(Buffer.from("not gzip"), spec), /sri-before-inflate/); });
test("matching SRI with invalid gzip is rejected", () => { const raw = Buffer.from("not gzip"); assert.throws(() => inspectVerifiedArchive(raw, withIntegrity(raw)), /gzip-invalid/); });
test("gzip bomb and skipped content count toward expansion cap", () => {
  const raw = gzipSync(Buffer.alloc(CAPS.expanded + 512)); assert.throws(() => inspectVerifiedArchive(raw, withIntegrity(raw)), /expanded/);
});
test("ordinary USTAR package retains exact source bytes without executing", () => {
  const entries = required(), result = inspect(entries); assert.equal(result.files.length, 2); assert.ok(result.files[1]!.data.equals(entries[1]!.data!)); assert.equal(result.legalClearance, false);
});
test("ordinary USTAR prefix preserves exact selected origin", () => {
  const entries = required(); entries[1] = { name: "esm/index.mjs", prefix: "package", data: entries[1]!.data! };
  assert.equal(inspect(entries).files.length, 2);
});
for (const original of specs) test(`validates ${original.name} exact JSON name and version`, () => {
  const entries = required(original); entries[0]!.data = Buffer.from('{"name":"wrong","version":"0"}'); assert.throws(() => inspect(entries, original), /package-identity/);
});
test("missing required runtime member is rejected", () => { assert.throws(() => inspect(required().slice(0, 1)), /missing-required-member/); });
test("invalid package JSON is never executed", () => {
  const entries = required(); entries[0]!.data = Buffer.from("throw new Error('must not execute')"); assert.throws(() => inspect(entries));
});
test("license preference is ordered and preserves at most one notice", () => {
  const result = inspect([...required(), { name: "package/LICENSE.txt", data: Buffer.from("third") }, { name: "package/LICENSE.md", data: Buffer.from("second") }, { name: "package/LICENSE", data: Buffer.from("first") }]);
  assert.equal(result.licenseMember, "package/LICENSE"); assert.equal(result.files.length, 3); assert.equal(result.files[2]!.data.toString(), "first");
});
test("license absence is honest and does not imply legal clearance", () => { const result = inspect(required()); assert.equal(result.licenseMember, null); assert.equal(result.legalClearance, false); });
test("duplicate selected physical member is rejected", () => { assert.throws(() => inspect([...required(), required()[1]!]), /physical-selected-duplicate/); });
for (const type of ["1", "2", "3", "4", "6", "7", "S", "K"]) test(`unsupported/link/sparse type ${type} is rejected even when skipped`, () => {
  assert.throws(() => inspect([...required(), { name: "package/skipped", type }]), /unsupported-type/);
});
test("nonregular selected directory is rejected", () => { const entries = required(); entries[1] = { name: entries[1]!.name, type: "5" }; assert.throws(() => inspect(entries), /physical-selected-duplicate-or-type/); });
test("skipped regular contents are never selected", () => { assert.equal(inspect([...required(), { name: "package/other.js", data: Buffer.from("not retained") }]).files.length, 2); });
test("all physical metadata headers count toward header cap", () => {
  const entries = Array.from({ length: CAPS.headers + 1 }, () => ({ name: "GlobalHead", type: "g", data: paxRecord("mtime", "0") }));
  assert.throws(() => inspect([...required(), ...entries]), /physical-header-cap/);
});
test("exact physical header cap permits bounded skipped headers", () => {
  const entries = Array.from({ length: CAPS.headers - 2 }, (_, n) => ({ name: `package/skipped-${n}`, data: Buffer.alloc(0) }));
  assert.equal(inspect([...required(), ...entries]).physicalTarHeaders, CAPS.headers);
});
test("PAX harmless local fields and exact path/size work", () => {
  const entries = required(), runtime = entries[1]!;
  const metadata = Buffer.concat([paxRecord("path", runtime.name), paxRecord("size", String(runtime.data!.length)), paxRecord("mtime", "0")]);
  assert.equal(inspect([entries[0]!, { name: "PaxHeader/runtime", type: "x", data: metadata }, runtime]).files.length, 2);
});
test("PAX remapping cannot hide a physical selected member", () => {
  const entries = required(); assert.throws(() => inspect([entries[0]!, { name: "PaxHeader/runtime", type: "x", data: paxRecord("path", "package/other") }, entries[1]!]), /selected-origin/);
});
test("PAX remapping cannot create selected member from another origin", () => {
  const entries = required(); assert.throws(() => inspect([entries[0]!, { name: "PaxHeader/runtime", type: "x", data: paxRecord("path", entries[1]!.name) }, { name: "package/other", data: entries[1]!.data! }]), /selected-origin/);
});
test("PAX selected size disagreement is rejected", () => {
  const entries = required(); assert.throws(() => inspect([entries[0]!, { name: "PaxHeader/runtime", type: "x", data: paxRecord("size", "1") }, entries[1]!]), /pax-size-origin/);
});
for (const metadata of [paxRecord("GNU.sparse.size", "1"), Buffer.concat([paxRecord("path", "a"), paxRecord("path", "b")]), Buffer.from("999 path=x\n")]) {
  test(`malformed or unsupported PAX metadata ${sha(metadata).slice(0, 8)} is rejected`, () => { assert.throws(() => inspect([{ name: "PaxHeader/x", type: "x", data: metadata }, ...required()]), /pax-/); });
}
test("global PAX path and pending metadata at end are rejected", () => {
  assert.throws(() => inspect([{ name: "GlobalHead", type: "g", data: paxRecord("path", "package/other") }, ...required()]), /global-path/);
  assert.throws(() => inspect([...required(), { name: "PaxHeader/end", type: "x", data: paxRecord("mtime", "0") }]), /tar-terminator/);
});
test("GNU longname for skipped member is supported without widening selection", () => {
  const name = "package/" + "a".repeat(140);
  assert.equal(inspect([...required(), { name: "./LongLink", type: "L", data: Buffer.from(name + "\0") }, { name: "package/short", data: Buffer.from("skipped") }]).files.length, 2);
});
test("GNU longname cannot alias a selected origin", () => {
  const entries = required(); assert.throws(() => inspect([entries[0]!, { name: "LongLink", type: "L", data: Buffer.from(entries[1]!.name + "\0") }, { name: "package/short", data: entries[1]!.data! }]), /selected-origin/);
});
test("PAX plus GNU metadata stacking is rejected as ambiguous", () => {
  assert.throws(() => inspect([{ name: "PaxHeader/x", type: "x", data: paxRecord("mtime", "0") }, { name: "LongLink", type: "L", data: Buffer.from("package/other\0") }, ...required()]), /gnu-longname/);
});
test("tar checksum corruption is rejected", () => { const data = tar(required()); data[0] = 88; const raw = gzipSync(data); assert.throws(() => inspectVerifiedArchive(raw, withIntegrity(raw)), /checksum/); });
test("tar payload padding and missing terminator are rejected", () => {
  const data = tar(required()); data[512 + required()[0]!.data!.length] = 1; let raw = gzipSync(data); assert.throws(() => inspectVerifiedArchive(raw, withIntegrity(raw)), /payload-padding/);
  raw = gzipSync(tar(required()).subarray(0, -1024)); assert.throws(() => inspectVerifiedArchive(raw, withIntegrity(raw)), /missing-terminator/);
});
test("tar traversal cannot widen mappings", () => { assert.throws(() => inspect([...required(), { name: "../escape" }]), /tar-path/); });
test("tar truncated payload and nonzero terminator tail are rejected", () => {
  let raw = gzipSync(tar([...required(), { name: "package/skipped", size: 1000000 }]));
  assert.throws(() => inspectVerifiedArchive(raw, withIntegrity(raw)), /payload-padding/);
  raw = gzipSync(Buffer.concat([tar(required()), Buffer.from([1]), Buffer.alloc(511)]));
  assert.throws(() => inspectVerifiedArchive(raw, withIntegrity(raw)), /tar-terminator/);
});
test("final selected validation recomputes archive and selected hashes", () => {
  const f = selectedFixture(); assert.doesNotThrow(() => validateSyntheticSelected(f.base, f.bound, f.marker, f.protocol));
  fs.writeFileSync(join(f.base, "synthetic-selected", "files", f.bound[0]!.requiredMembers[1]!.retainedFile), Buffer.from("changed"));
  assert.throws(() => validateSyntheticSelected(f.base, f.bound, f.marker, f.protocol), /selected-file-hash/);
});
test("final selected validation rejects changed raw archive", () => {
  const f = selectedFixture(); fs.writeFileSync(join(f.base, "synthetic-raw", f.bound[0]!.archiveFile), Buffer.from("changed"));
  assert.throws(() => validateSyntheticSelected(f.base, f.bound, f.marker, f.protocol), /final-raw-binding/);
});
for (const child of ["synthetic-raw", "synthetic-selected", "synthetic-selected/files"]) test(`final exact membership rejects extra ${child} file`, () => {
  const f = selectedFixture(); exclusive(join(f.base, child, "unexpected"), Buffer.from("extra"));
  assert.throws(() => validateSyntheticSelected(f.base, f.bound, f.marker, f.protocol), /exact-output-membership/);
});
test("final selected validation rejects forged manifest even with claimed hash", () => {
  const f = selectedFixture(), path = join(f.base, "synthetic-selected", "selected-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(path, "utf8")) as Frame; manifest["legalClearance"] = true;
  const bytes = encoded(manifest); fs.writeFileSync(path, bytes); f.protocol.done!["manifestSha256"] = sha(bytes);
  assert.throws(() => validateSyntheticSelected(f.base, f.bound, f.marker, f.protocol), /final-manifest/);
});
test("combined selected bytes and file count remain bounded", () => {
  const i = inspect(required()), j = inspect(required(specs[1]!), specs[1]!);
  assert.equal((selectedManifest([i, j], specs, "synthetic")["files"] as unknown[]).length, 4);
  const huge = { ...i, files: i.files.map(f => ({ ...f, data: Buffer.alloc(CAPS.selected / 2 + 1) })) };
  assert.throws(() => selectedManifest([huge, j], specs, "synthetic"), /aggregate-selected/);
  const many = { ...i, files: [...i.files, ...i.files] }; assert.throws(() => selectedManifest([many, many], specs, "synthetic"), /aggregate-selected/);
});
test("flat filename collision cannot overwrite selected files", () => {
  const i = inspect(required()), j = inspect(required(specs[1]!), specs[1]!); j.files[0]!.retainedFile = i.files[0]!.retainedFile;
  assert.throws(() => selectedManifest([i, j], specs, "synthetic"), /collision/);
  const path = join(fixture(), "selected.json"); exclusive(path, Buffer.from("original")); assert.throws(() => exclusive(path, Buffer.from("replacement")), /EEXIST/); assert.equal(readRegular(path, 20).toString(), "original");
});
test("bounded primitive rejects deadline elapsed during finalization", async () => {
  let time = 0; await assert.rejects(bounded(Promise.resolve().then(() => { time = 10; }), 10, () => time), /absolute-deadline/);
});
test("finalization closes durable journal before provisional receipt and single bounded candidate", async () => {
  const f = provisionalFixture(), events: string[] = [], lines: Buffer[] = []; let stored: Buffer | undefined;
  const deps: FinalizationDeps = { journalCandidate: candidate => { events.push("journal-write-fsync"); assert.equal(candidate["terminalState"], "PROVISIONAL_PASS"); },
    closeJournal: () => { events.push("journal-close"); }, persistReceipt: bytes => { events.push("receipt-write-fsync-close"); stored = Buffer.from(bytes); },
    writeCompletion: async line => { events.push("completion-line"); assert.ok(stored); lines.push(Buffer.from(line)); } };
  await finalizeCapture(f.receipt, f.marker, deps, () => f.marker.origin);
  assert.deepEqual(events, ["journal-write-fsync", "journal-close", "receipt-write-fsync-close", "completion-line"]);
  assert.ok(stored); assert.equal((JSON.parse(stored.toString("utf8")) as Frame)["terminalState"], "PROVISIONAL_PASS");
  assert.equal(lines.length, 1); assert.equal(assessCapture(stored, lines[0]!, f.outer, f.identity), "PASS");
  assert.equal(assessCapture(stored, lines[0]!, undefined, f.identity), "PROVISIONAL");
});
test("finalization never persists immutable terminal PASS", async () => {
  const f = provisionalFixture(); f.receipt["terminalState"] = "PASS"; let io = false;
  const touched = (): void => { io = true; };
  await assert.rejects(finalizeCapture(f.receipt, f.marker, { journalCandidate: touched, closeJournal: touched, persistReceipt: touched,
    writeCompletion: async () => { io = true; } }, () => f.marker.origin), /provisional-or-failure-only/);
  assert.equal(io, false);
});
for (const stage of ["journal-fsync", "journal-close", "receipt-write", "receipt-fsync", "receipt-close", "line-write"]) {
  for (const overrun of [0, 1]) test(`synthetic ${stage} at deadline+${overrun} cannot qualify durable success`, async () => {
    const f = provisionalFixture(), lines: Buffer[] = []; let time = f.marker.origin, stored: Buffer | undefined, journalState: unknown;
    const step = (name: string): void => { if (name === stage) time = f.marker.operationDeadline + overrun; };
    const deps: FinalizationDeps = {
      journalCandidate: candidate => { journalState = candidate["terminalState"]; step("journal-fsync"); }, closeJournal: () => { step("journal-close"); },
      persistReceipt: bytes => { stored = Buffer.from(bytes); step("receipt-write"); step("receipt-fsync"); step("receipt-close"); },
      writeCompletion: async line => { lines.push(Buffer.from(line)); step("line-write"); },
    };
    await assert.rejects(finalizeCapture(f.receipt, f.marker, deps, () => time), /absolute-deadline/);
    assert.equal(journalState, "PROVISIONAL_PASS");
    if (stored) {
      assert.equal((JSON.parse(stored.toString("utf8")) as Frame)["terminalState"], "PROVISIONAL_PASS");
      assert.equal(assessCapture(stored, Buffer.concat(lines), { ...f.outer, exitCode: 1, completionObservedMonoMs: time }, f.identity), "FAIL");
      assert.equal(assessCapture(stored, Buffer.concat(lines), { ...f.outer, completionObservedMonoMs: time }, f.identity), "FAIL");
    } else assert.equal(lines.length, 0);
  });
}
for (const stage of ["receipt-write", "receipt-fsync", "receipt-close"]) test(`synthetic ${stage} failure leaves provisional bytes and emits no candidate`, async () => {
  const f = provisionalFixture(); let stored: Buffer | undefined, lines = 0;
  await assert.rejects(finalizeCapture(f.receipt, f.marker, { journalCandidate: () => {}, closeJournal: () => {},
    persistReceipt: bytes => { stored = Buffer.from(bytes); throw new Error(stage); }, writeCompletion: async () => { lines++; } }, () => f.marker.origin), new RegExp(stage));
  assert.ok(stored); assert.equal((JSON.parse(stored.toString("utf8")) as Frame)["terminalState"], "PROVISIONAL_PASS"); assert.equal(lines, 0);
});
test("failure finalization emits no success candidate", async () => {
  const f = provisionalFixture(); f.receipt["terminalState"] = "FAIL"; f.receipt["failure"] = "synthetic-failure"; let emitted = false;
  await finalizeCapture(f.receipt, f.marker, { journalCandidate: () => {}, closeJournal: () => {}, persistReceipt: () => {}, writeCompletion: async () => { emitted = true; } }, () => f.marker.origin);
  assert.equal(emitted, false); assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), f.outer, f.identity), "FAIL");
});
test("missing outer witness leaves successful receipt provisional rather than operational PASS", () => {
  const f = provisionalFixture(); assert.equal(assessCapture(encoded(f.receipt), Buffer.alloc(0), undefined, f.identity), "PROVISIONAL");
});
for (const [label, changes] of [
  ["stdout EOF missing", { stdoutEof: false }], ["stderr EOF missing", { stderrEof: false }], ["nonzero exit", { exitCode: 1 }],
  ["unknown exit", { exitCode: null }], ["timed out", { timedOut: true }], ["stderr output", { stderrBytes: 1 }],
  ["late exit zero", { completionObservedMonoMs: 900 + CAPS.operationMs + 1 }], ["exit zero at deadline", { completionObservedMonoMs: 900 + CAPS.operationMs }],
  ["zero outer elapsed", { startedMonoMs: 1100 }], ["observation before invocation", { completionObservedMonoMs: 899 }],
] satisfies [string, Partial<OuterWitness>][]) test(`completion candidate rejects contradictory outer witness: ${label}`, () => {
  const f = provisionalFixture(); assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), { ...f.outer, ...changes }, f.identity), "FAIL");
});
for (const kind of ["missing", "duplicate", "wrong-hash", "wrong-attempt", "extra-line"]) test(`outer acceptance requires matching single completion candidate: ${kind}`, () => {
  const f = provisionalFixture(), line = completionLine(f.receipt); let stdout = line;
  if (kind === "missing") stdout = Buffer.alloc(0);
  if (kind === "duplicate") stdout = Buffer.concat([line, line]);
  if (kind === "extra-line") stdout = Buffer.concat([line, Buffer.from("\n")]);
  if (kind === "wrong-hash" || kind === "wrong-attempt") {
    const candidate = JSON.parse(line.toString("utf8")) as Frame;
    candidate[kind === "wrong-hash" ? "consumptionReceiptSha256" : "attemptId"] = kind === "wrong-hash" ? "0".repeat(64) : "other-attempt";
    stdout = Buffer.concat([encoded(candidate), Buffer.from("\n")]);
  }
  assert.equal(assessCapture(encoded(f.receipt), stdout, f.outer, f.identity), "FAIL");
});
for (const key of ["workerReaped", "workerStdoutEof", "workerStderrEof", "doneEvidenceReceived", "eligibilityRevalidated", "selectedHashesAndMembershipVerified", "bindingRechecked"]) {
  test(`outer witness cannot replace missing existing evidence: ${key}`, () => {
    const f = provisionalFixture(); f.receipt[key] = false;
    assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), f.outer, f.identity), "FAIL");
  });
}
test("outer witness cannot replace matching source/review binding identity", () => {
  const f = provisionalFixture(), expected = { ...f.identity, executionBindingSha256: "0".repeat(64) };
  assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), f.outer, expected), "FAIL");
});
test("outer witness rejects synthetic operational receipts", () => {
  const f = provisionalFixture(); f.receipt["offlineSynthetic"] = true;
  assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), f.outer, f.identity), "FAIL");
});
test("supervisor emits only a provisional receipt plus matching completion line", async () => {
  const ctx = syntheticContext(fixture()), lines: Buffer[] = []; ctx.writeCompletion = async line => { lines.push(Buffer.from(line)); };
  const receipt = await superviseCapture(ctx), stored = readRegular(join(ctx.operationPath, "consumption-receipt.json"), CAPS.receipt);
  assert.equal(receipt["terminalState"], "PROVISIONAL_PASS"); assert.equal(lines.length, 1);
  const candidate = JSON.parse(lines[0]!.toString("utf8")) as Frame;
  assert.equal(candidate["consumptionReceiptSha256"], sha(stored));
  assert.equal((JSON.parse(stored.toString("utf8")) as Frame)["terminalState"], "PROVISIONAL_PASS");
  assert.match(fs.readFileSync(join(ctx.operationPath, "events.jsonl"), "utf8"), /"type":"TERMINAL_CANDIDATE","terminalState":"PROVISIONAL_PASS"/);
});
for (const [start, width, value] of [[100, 8, "000 0644"], [108, 8, "0 000000"], [116, 8, "000\0 001"], [124, 12, "0000 0000000"], [136, 12, "00000000000\t"], [100, 8, "        "]] as const) {
  test(`checksum-correct tar rejects malformed octal field ${start}:${sha(Buffer.from(value)).slice(0, 8)}`, () => {
    const data = tar(required()); data.write(value, start, width, "ascii");
    data.fill(32, 148, 156); const sum = data.subarray(0, 512).reduce((a, b) => a + b, 0); data.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
    const raw = gzipSync(data); assert.throws(() => inspectVerifiedArchive(raw, withIntegrity(raw)), /tar-octal/);
  });
}
test("ordinary octal leading spaces and numeric terminators remain supported", () => {
  const data = tar(required()); data.write(" 000644\0", 100, 8, "ascii");
  data.fill(32, 148, 156); const sum = data.subarray(0, 512).reduce((a, b) => a + b, 0); data.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  const raw = gzipSync(data); assert.equal(inspectVerifiedArchive(raw, withIntegrity(raw)).files.length, 2);
});
for (const digit of [0, 1]) test(`PAX length rejects high-bit original decimal byte ${digit} before ASCII decoding`, () => {
  const metadata = paxRecord("mtime", "0"); assert.ok(metadata.indexOf(32) > digit); metadata[digit] = metadata[digit]! | 128;
  assert.throws(() => inspect([{ name: "PaxHeader/highbit", type: "x", data: metadata }, ...required()]), /pax-length-ascii/);
});
function clockPair(parentOffset = 1000000, workerOffset = 10): { p: CaptureProtocol; w: WorkerTiming; setParent: (n: number) => void; setWorker: (n: number) => void; config: Frame } {
  let parent = parentOffset, worker = workerOffset;
  const m: Marker = { ...marker(), origin: parentOffset, workDeadline: parentOffset + CAPS.workMs, operationDeadline: parentOffset + CAPS.operationMs };
  const p = new CaptureProtocol(m, () => {}, () => parent), w = new WorkerTiming(m.attemptId, m.supervisorPid, 456, () => worker);
  p.ready(w.ready(), 456); const config = p.configure("synthetic"); w.acceptConfig(config);
  return { p, w, setParent: n => { parent = n; }, setWorker: n => { worker = n; }, config };
}
for (const role of ["supervisor", "worker", "outer"]) test(`${role} local guard permits equal samples and rejects regression without sharing counters`, () => {
  let tick = 100; const clock = guardClock(() => tick); assert.equal(clock(), 100); assert.equal(clock(), 100);
  tick = 99; assert.throws(clock, /clock-invalid-or-regressed/); assert.equal(guardClock(() => tick)(), 99);
});
for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) test(`local guard rejects invalid sample ${String(invalid)}`, () => {
  assert.throws(guardClock(() => invalid), /clock-invalid-or-regressed/);
});
for (const [parent, worker] of [[1000000, 10], [10, 1000000], [0, 100]] as const) test(`duration protocol ignores independent offsets ${parent}/${worker}`, () => {
  const x = clockPair(parent, worker); assert.equal(x.config["remainingWorkMs"], CAPS.workMs);
  assert.equal(x.w.workCutoff, worker + CAPS.workMs); assert.equal(Object.hasOwn(x.config, "workDeadline"), false);
  const start = x.w.startRequest(0); assert.equal(start["requestStartMonoMs"], worker);
  x.setWorker(worker + 7); const ack = x.p.accept(start)!; assert.equal(ack["remainingGetMs"], CAPS.getMs); assert.equal(Object.hasOwn(ack, "deadline"), false);
  assert.equal(x.w.acceptAck(ack), worker + CAPS.getMs);
});
for (const changed of [{ workerPid: 457 }, { supervisorPid: 1 }, { attemptId: "stale" }, { workerDomain: "wrong" }, { supervisorDomain: "wrong" }]) test(`READY rejects wrong identity ${Object.keys(changed)[0]}`, () => {
  const m = marker(), p = new CaptureProtocol(m, () => {}), w = new WorkerTiming(m.attemptId, m.supervisorPid, 456, () => 10);
  assert.throws(() => p.ready({ ...w.ready(), ...changed }, 456), /ready-identity-or-duplicate/);
});
test("WAIT_READY prevents CONFIG and late or duplicate READY never restarts startup", () => {
  let tick = 0; const m = { ...marker(), origin: 0, workDeadline: 10, operationDeadline: 120000 };
  const p = new CaptureProtocol(m, () => {}, () => tick), w = new WorkerTiming(m.attemptId, m.supervisorPid, 456, () => 20), ready = w.ready();
  assert.throws(() => p.configure("x"), /config-before-ready/); p.ready(ready, 456);
  assert.throws(() => p.ready(ready, 456), /ready-identity-or-duplicate/); tick = 10;
  assert.throws(() => p.configure("x"), /duration-invalid-or-exhausted/);
  const late = new CaptureProtocol(m, () => {}, () => tick); assert.throws(() => late.ready(ready, 456), /absolute-deadline/);
});
test("CONFIG samples remaining original work after startup and uses pre-READY worker anchor", () => {
  let parent = 1000, worker = 500000; const m = { ...marker(), origin: parent, workDeadline: parent + CAPS.workMs, operationDeadline: parent + CAPS.operationMs };
  const p = new CaptureProtocol(m, () => {}, () => parent), w = new WorkerTiming(m.attemptId, m.supervisorPid, 456, () => worker);
  const ready = w.ready(); parent += 50; worker += 20; p.ready(ready, 456); parent += 30;
  const config = p.configure("x"); assert.equal(config["remainingWorkMs"], CAPS.workMs - 80);
  worker += 7; w.acceptConfig(config); assert.equal(w.workCutoff, 500000 + CAPS.workMs - 80);
  assert.throws(() => p.configure("x"), /duplicate/); assert.throws(() => w.acceptConfig(config), /duplicate/);
});
for (const value of [0, -1, 0.5, CAPS.workMs + 1, NaN, Infinity]) test(`CONFIG rejects invalid remaining duration ${String(value)}`, () => {
  const x = clockPair(), w = new WorkerTiming("synthetic", process.pid, 456, () => 10); w.ready();
  assert.throws(() => w.acceptConfig({ ...x.config, remainingWorkMs: value }), /duration-invalid-or-exhausted/);
});
for (const value of [0, -1, 0.5, CAPS.getMs + 1, NaN, Infinity]) test(`ACK rejects invalid remaining duration ${String(value)}`, () => {
  const x = clockPair(), ack = x.p.accept(x.w.startRequest(0))!;
  assert.throws(() => x.w.acceptAck({ ...ack, remainingGetMs: value }), /duration-invalid-or-exhausted/);
});
test("delayed CONFIG exhausts worker-start anchored cutoff without a reset", () => {
  let tick = 10; const w = new WorkerTiming("synthetic", process.pid, 456, () => tick); const ready = w.ready();
  const p = new CaptureProtocol({ ...marker(), origin: 1000, workDeadline: 1010, operationDeadline: 121000 }, () => {}, () => 1009); p.ready(ready, 456);
  const config = p.configure("x"); assert.equal(config["remainingWorkMs"], 1); tick = 11;
  assert.throws(() => w.acceptConfig(config), /absolute-deadline/);
});
test("request anchor precedes send and delayed ACK never invokes injected DNS/transport", async () => {
  const x = clockPair(); const start = x.w.startRequest(0); assert.equal(start["requestStartMonoMs"], 10);
  const ack = x.p.accept(start)!; x.setWorker(10 + CAPS.getMs); let invoked = false;
  await assert.rejects((async () => { const deadline = x.w.acceptAck(ack); await downloadArchive(spec, { write() {} }, { deadline, clock: x.w.clock,
    transport: async () => { invoked = true; throw new Error("must-not-run"); }, event: async () => {} }); })(), /absolute-deadline/);
  assert.equal(invoked, false);
});
test("ACK subtracts journal latency before returning a duration and cannot replay", () => {
  let tick = 1000; const m = { ...marker(), origin: tick, workDeadline: tick + CAPS.workMs, operationDeadline: tick + CAPS.operationMs };
  const p = new CaptureProtocol(m, frame => { if (frame["type"] === "URL_START") tick += 20; }, () => tick), w = new WorkerTiming(m.attemptId, m.supervisorPid, 456, () => 5);
  p.ready(w.ready(), 456); w.acceptConfig(p.configure("x")); const start = w.startRequest(0), ack = p.accept(start)!;
  assert.equal(ack["remainingGetMs"], CAPS.getMs - 20); assert.equal(p.deadline, 31000); w.acceptAck(ack);
  assert.throws(() => w.acceptAck(ack), /ack-identity-or-stale/); assert.throws(() => p.accept(start), /start-order/);
});
for (const changed of [{ attemptId: "stale" }, { workerDomain: "wrong" }, { supervisorDomain: "wrong" }, { ordinal: 1 }]) test(`ACK rejects stale identity ${Object.keys(changed)[0]}`, () => {
  const x = clockPair(), ack = x.p.accept(x.w.startRequest(0))!; assert.throws(() => x.w.acceptAck({ ...ack, ...changed }), /ack-identity-or-stale/);
});
test("CONFIG rejects absolute deadline fields and wrong domains", () => {
  for (const changes of [{ workDeadline: 108000 }, { workerDomain: "wrong" }, { workerPid: 457 }, { attemptId: "stale" }]) {
    const x = clockPair(), w = new WorkerTiming("synthetic", process.pid, 456, () => 10); w.ready();
    assert.throws(() => w.acceptConfig({ ...x.config, ...changes }), /schema-keys|config-identity-or-duplicate/);
  }
});
test("authoritative parent GET expiry rejects progress even while worker clock remains locally valid", () => {
  const x = clockPair(), ack = x.p.accept(x.w.startRequest(0))!; const local = x.w.acceptAck(ack); assert.ok(x.w.clock() < local);
  x.setParent(1000000 + CAPS.getMs);
  assert.throws(() => x.p.accept(x.w.frame("GET_INVOKED", { ordinal: 0 })), /absolute-deadline/);
});
for (const [supervisor, worker, outer] of [[1000000, 10, 5], [10, 1000000, 8000000], [0, 0, 0]] as const) test(`acceptance compares epochs only within domains ${supervisor}/${worker}/${outer}`, () => {
  const f = provisionalFixture(); f.receipt["origin"] = supervisor; f.receipt["workDeadline"] = supervisor + CAPS.workMs; f.receipt["operationDeadline"] = supervisor + CAPS.operationMs;
  f.receipt["deadlineSnapshot"] = { clockDomain: f.marker.supervisorDomain, observedMonoMs: supervisor, operationDeadlineMonoMs: supervisor + CAPS.operationMs, observedExceeded: false };
  f.receipt["workerTiming"] = { clockDomain: f.receipt["workerDomain"]!, workerStartMonoMs: worker, requestStartsMonoMs: [worker, worker + 1] };
  const witness = { ...f.outer, startedMonoMs: outer, completionObservedMonoMs: outer + 1 };
  assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), witness, f.identity), "PASS");
});
for (const changes of [{ clockDomain: "" }, { clockDomain: "wrong" }, { clockDomain: "synthetic:outer:0" }, { completionObservedMonoMs: -1 }, { startedMonoMs: 0.5 }]) test(`outer witness rejects invalid own domain/timing ${Object.keys(changes)[0]}:${String(Object.values(changes)[0])}`, () => {
  const f = provisionalFixture(); assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), { ...f.outer, ...changes }, f.identity), "FAIL");
});
test("candidate must match supervisor domain and inner preparation must precede original deadline", () => {
  const f = provisionalFixture(), candidate = JSON.parse(completionLine(f.receipt).toString("utf8")) as Frame;
  for (const changes of [{ supervisorDomain: f.receipt["workerDomain"] }, { candidatePreparationMonoMs: f.marker.operationDeadline }, { candidatePreparationMonoMs: f.marker.origin - 1 }]) {
    assert.equal(assessCapture(encoded(f.receipt), Buffer.concat([encoded({ ...candidate, ...changes }), Buffer.from("\n")]), f.outer, f.identity), "FAIL");
  }
});
test("parent and worker context clocks reject local regression independently", () => {
  const x = clockPair(); x.setParent(999999); assert.throws(() => x.p.accept(x.w.startRequest(0)), /clock-invalid-or-regressed/);
  const y = clockPair(); y.setWorker(9); assert.throws(() => y.w.startRequest(0), /clock-invalid-or-regressed/);
});
test("original parent work expiry wins over a still-valid worker local timer", () => {
  const x = clockPair(); assert.ok(x.w.clock() < x.w.workCutoff); x.setParent(1000000 + CAPS.workMs);
  assert.throws(() => x.p.accept(x.w.startRequest(0)), /absolute-deadline/);
  const f = provisionalFixture(); (f.receipt["deadlineSnapshot"] as Frame)["observedMonoMs"] = f.marker.operationDeadline;
  assert.equal(assessCapture(encoded(f.receipt), completionLine(f.receipt), f.outer, f.identity), "FAIL");
});
for (const phase of ["CONFIG", "ACK"]) test(`lost ${phase} has bounded local waiting and cannot issue transport permission`, async () => {
  const clock = guardClock(() => 1000000 + now()), w = new WorkerTiming("synthetic", process.pid, 456, clock), input = new PassThrough(), frames = new Frames(input);
  w.ready();
  if (phase === "ACK") {
    w.acceptConfig({ type: "CONFIG", attemptId: w.attemptId, supervisorPid: process.pid, workerPid: 456, supervisorDomain: w.supervisorDomain, workerDomain: w.workerDomain, remainingWorkMs: 100, executionBindingSha256: "x" });
    w.startRequest(0);
  }
  try { await assert.rejects(frames.read(clock() + 8, clock), /absolute-deadline/); }
  finally { input.destroy(); }
  assert.throws(() => w.startRequest(0), /request-order/);
});
for (const mode of ["wrongReady", "duplicateReady"] as const) test(`${mode} startup stops the sole fake worker without any GET permission`, async () => {
  const ctx = syntheticContext(fixture()); let spawns = 0;
  ctx.spawn = m => { spawns++; return fakeWorker(mode, undefined, m); };
  const receipt = await superviseCapture(ctx); assert.equal(receipt["terminalState"], "FAIL"); assert.equal(receipt["confirmedGetInvocations"], 0); assert.equal(receipt["urlStartsConsumed"], 0); assert.equal(spawns, 1);
});
test("READY arriving at original work deadline receives no CONFIG or replacement", async () => {
  let tick = 0, configs = 0, spawns = 0; const ctx = syntheticContext(fixture()); ctx.clock = () => tick;
  ctx.spawn = m => { spawns++; tick = CAPS.workMs; return fakeWorker("complete", frame => { if (frame["type"] === "CONFIG") configs++; }, m); };
  const receipt = await superviseCapture(ctx); assert.equal(receipt["terminalState"], "FAIL"); assert.equal(configs, 0); assert.equal(spawns, 1); assert.equal(receipt["confirmedGetInvocations"], 0);
});
test("owned fake Bun child proves READY duration handshakes across independent clock domains", async () => {
  const base = fixture(), script = join(base, "owned-fake-worker.ts");
  const source = `import * as fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkerTiming, Frames, sendFrame, guardClock, now } from ${JSON.stringify(join(ROOT, SOURCE, "capture.ts"))};
const clock = guardClock(() => 1000000 + now()), workerStart = clock();
const base = dirname(fileURLToPath(import.meta.url));
const marker = JSON.parse(fs.readFileSync(join(base, "operation", "attempt.json"), "utf8"));
const timing = new WorkerTiming(marker.attemptId, process.ppid, process.pid, clock, workerStart), frames = new Frames(process.stdin);
await sendFrame(process.stdout, timing.ready(), workerStart + 108000, clock);
const config = await frames.read(workerStart + 108000, clock); timing.acceptConfig(config);
const starts = [], cutoffs = [], durations = [];
for (const ordinal of [0, 1]) {
  const start = timing.startRequest(ordinal); starts.push(start.requestStartMonoMs);
  await sendFrame(process.stdout, start, timing.workCutoff, clock);
  const ack = await frames.read(timing.workCutoff, clock), cutoff = timing.acceptAck(ack); durations.push(ack.remainingGetMs); cutoffs.push(cutoff);
  await sendFrame(process.stdout, timing.frame("GET_INVOKED", { ordinal }), cutoff, clock);
  await sendFrame(process.stdout, timing.frame("RESPONSE_COMPLETED", { ordinal, bytes: 3, sha256: "a".repeat(64), sha512: "b".repeat(128) }), cutoff, clock);
  await sendFrame(process.stdout, timing.frame("URL_DONE", { ordinal }), cutoff, clock);
}
fs.writeFileSync(join(base, "worker-local-timing.json"), JSON.stringify({ clockDomain: timing.workerDomain, pid: process.pid, ppid: process.ppid,
  workerStart, localWorkCutoff: timing.workCutoff, remainingWorkMs: config.remainingWorkMs, starts, cutoffs, durations, actualGetRequests: 0 }), { flag: "wx" });
await sendFrame(process.stdout, timing.frame("DONE", { manifestSha256: "c".repeat(64) }), timing.workCutoff, clock);
process.stdin.destroy();
`;
  exclusive(script, Buffer.from(source));
  const ctx = syntheticContext(base), lines: Buffer[] = []; ctx.clock = guardClock(() => 10 + now());
  const outerClock = guardClock(() => 2000000 + now()), startedMonoMs = outerClock(); let ownedPid = 0;
  ctx.spawn = () => {
    const child = spawn(BUN, ["--no-env-file", "--no-install", script], { cwd: ROOT, env: { LANG: "C", LC_ALL: "C" }, stdio: ["pipe", "pipe", "pipe"], shell: false });
    const exited = new Promise<number | null>((resolveExit, reject) => { child.once("exit", resolveExit); child.once("error", reject); }); void exited.catch(() => {});
    child.stdin.on("error", () => {}); ownedPid = child.pid!;
    return { pid: ownedPid, stdin: child.stdin, stdout: child.stdout, stderr: child.stderr, exited,
      kill: signal => { child.kill(signal); }, destroy: () => { child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); } };
  };
  ctx.writeCompletion = async line => { lines.push(Buffer.from(line)); };
  const receipt = await superviseCapture(ctx), completionObservedMonoMs = outerClock();
  assert.equal(receipt["terminalState"], "PROVISIONAL_PASS"); assert.equal(receipt["workerPid"], ownedPid); assert.equal(receipt["workerExitCode"], 0); assert.equal(lines.length, 1);
  const timing = JSON.parse(readRegular(join(base, "worker-local-timing.json"), CAPS.receipt).toString("utf8")) as { clockDomain: string; pid: number; ppid: number; workerStart: number; localWorkCutoff: number; remainingWorkMs: number; starts: number[]; cutoffs: number[]; durations: number[]; actualGetRequests: number };
  assert.equal(timing.pid, ownedPid); assert.equal(timing.ppid, process.pid); assert.equal(timing.clockDomain, receipt["workerDomain"]); assert.equal(timing.actualGetRequests, 0);
  assert.equal(timing.localWorkCutoff, timing.workerStart + timing.remainingWorkMs);
  for (const [index, cutoff] of timing.cutoffs.entries()) assert.equal(cutoff, Math.min(timing.localWorkCutoff, timing.starts[index]! + timing.durations[index]!));
  const analogue: Frame = { ...receipt, offlineSynthetic: false }, bytes = encoded(analogue), candidate = JSON.parse(lines[0]!.toString("utf8")) as Frame;
  const matchingLine = Buffer.concat([encoded({ ...candidate, consumptionReceiptSha256: sha(bytes) }), Buffer.from("\n")]);
  const outer: OuterWitness = { clockDomain: clockDomain("owned-fake-observer", "outer", process.pid), exitCode: 0, stdoutEof: true, stderrEof: true, stderrBytes: 0, startedMonoMs, completionObservedMonoMs, timedOut: false };
  assert.equal(assessCapture(bytes, matchingLine, outer, receipt["identity"] as unknown as Identity), "PASS");
  exclusive(join(fixtures, "clock-domain-proof.json"), encoded({ status: "PASS_SYNTHETIC_PROCESS_LOCAL_DOMAINS", scope: "Owned fake Bun child using timing helpers only; no production worker or transport",
    captureSourceSha256: sha(readRegular(join(ROOT, SOURCE, "capture.ts"), 256 * 1024)), fakeWorkerSourceSha256: sha(Buffer.from(source)),
    supervisorDomain: receipt["supervisorDomain"], supervisorOrigin: receipt["origin"], worker: timing, outer,
    pureSyntheticAnalogueQualification: "PASS", originalSyntheticReceiptRemainsNonOperational: true,
    actualGetRequests: 0, productionEntryInvoked: false, productionWorkerInvoked: false, productionRootsTouched: false, acquisitionGrantConsumed: false }));
});
