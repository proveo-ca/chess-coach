import { PassThrough, Writable } from "node:stream";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { superviseCapture, authority, sourceHashes, PINS, readRegular, encoded, WorkerTiming, fresh, exclusive, ROOT, active, now } from "/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source2/capture.ts";
import { fixtureCacheParentIO } from "/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source2/cache-parent-adapter.ts";
import { prepareFixedCacheParent, FIXED_ANCESTORS, FIXED_CACHE_PARENT } from "/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source2/cache-parent.ts";
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
