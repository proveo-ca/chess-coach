// SPEC: _spec/runtime-protocol.puml
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { createDeliveryRuntime } from "./delivery-bootstrap.ts";
import type { DeliveryPins, DeliveryRequestFactory, DeliveryRuntime, DeliverySyntheticOptions } from "./delivery-bootstrap.ts";
import { buildLiteralPacket, readLiteralText } from "./delivery-packet.ts";
import { renderDelivery } from "./delivery-render.ts";
import { assessDeliveryVerification, verifyDelivery } from "./delivery-verify.ts";

const api: DeliveryRuntime = await createDeliveryRuntime();
const C = api.constants;
const evidence = process.env["DELIVERY_EVIDENCE_ROOT"] ?? "";
api.need(typeof evidence === "string" && new RegExp(`^${C.HOSTROOT}/${C.R2}/delivery-verification-[1-9][0-9]{0,2}$`).test(evidence), "bounded-offline-verifier-required");
api.ancestors(evidence);
const fixtureBase = join(evidence, "fixtures");
api.freshDirectory(fixtureBase);
let fixtureIndex = 0;
const callerText = `import * as fs from "node:fs";
import { join } from "node:path";
if (process.argv.length !== 3 || process.argv[2] !== "execute") throw Error("literal-execute-required");
if (process.versions.bun !== "1.4.0" || process.env.TZ !== "UTC") throw Error("same-bun-and-minimal-environment-required");
for (const name of ["GH_TOKEN","GITHUB_TOKEN","GH_CONFIG_DIR","HTTP_PROXY","HTTPS_PROXY","NODE_OPTIONS","BUN_OPTIONS"]) if (process.env[name]) throw Error("environment-leak");
const h=join(process.cwd(),"..");
const receipt=JSON.parse(fs.readFileSync(join(h,"evidence/transfer-receipt.json"),"utf8"));
if(receipt.status!=="SEALED_STAGE_A_CANDIDATE_NOT_DELIVERY_SUCCESS") throw Error("stage-a-not-durable");
const observer=join(process.cwd(),${JSON.stringify(C.OBSERVER)});
fs.mkdirSync(observer,{mode:0o700});
for(const name of ["command.stdout","command.stderr","observation.json"]) fs.writeFileSync(join(observer,name),name==="observation.json"?"{}\\n":"",{flag:"wx",mode:0o600});
fs.writeFileSync(join(h,"evidence/fake-caller.json"),JSON.stringify({argv:process.argv.slice(2),execPath:process.execPath,cwd:process.cwd(),scope:"OFFLINE_SYNTHETIC"})+"\\n",{flag:"wx",mode:0o600});
`;
const literalPaths = [
  ...C.bindings.map(row => row[1]), `${C.R2}/approval2.json`, C.BOUNDARY_PATH, C.AMENDMENT_PATH, C.CALLER,
  ...C.fixedInputs.map(row => row[0]), `${C.D}/package-acquisition-bun-source2/.gitignore`
] as const;
const sources = new Map<string, Buffer>(literalPaths.map(path => [path, path === C.CALLER ? Buffer.from(callerText) : fs.readFileSync(join(C.HOSTROOT, path))]));
const packet = await buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: literalPaths }, name => { const bytes = sources.get(name); api.need(bytes, "fixture-source-required"); return bytes!; });
const pins: DeliveryPins = { ...packet.pin, commitOid: "1".repeat(40), packetPath: C.PACKET_PATH, fileTable: packet.table };
const response = (bytes = packet.bytes, pin = api.identity(bytes)): Buffer => Buffer.from(JSON.stringify({ sha: pin.gitBlobOid, size: pin.bytes, encoding: "base64", content: bytes.toString("base64").replace(/.{60}/g, "$&\n") }) + "\n");
function mutatedPacket(mutate: (envelope: Record<string, unknown>) => void) {
  const value = JSON.parse(packet.bytes.toString()) as Record<string, unknown>; mutate(value);
  const bytes = Buffer.from(JSON.stringify(value) + "\n"); return { bytes, pin: api.identity(bytes) };
}
async function fixture(label: string, mode = "success", body = response(), expectedPins = pins) {
  const root = join(fixtureBase, `${label}-${++fixtureIndex}`); api.freshDirectory(root);
  api.writeExclusive(join(root, "OFFLINE_SYNTHETIC.json"), Buffer.from('{"scope":"OFFLINE_SYNTHETIC"}\n'));
  api.writeExclusive(join(root, "response.json"), body);
  for (const part of ["host", "host/_work", "host/_work/gpu-owner-recovery", "host/_work/gpu-owner-recovery/runs"]) api.freshDirectory(join(root, part));
  const trace = { calls: 0, destroyed: [] as string[], events: [] as string[] };
  const requestFactory: DeliveryRequestFactory = (options, onResponse) => {
    api.ancestors(root); expect(fs.readFileSync(join(root, "OFFLINE_SYNTHETIC.json"), "utf8")).toBe('{"scope":"OFFLINE_SYNTHETIC"}\n');
    trace.calls++; expect(options).toEqual(api.requestOptions(expectedPins.gitBlobOid));
    api.record(join(root, "fake-https-invocation.json"), { options, scope: "OFFLINE_SYNTHETIC", network: false });
    if (mode === "construction-error") throw Error("synthetic-construction-error");
    const socket: EventEmitter & { destroyed: boolean; destroy(): void } = Object.assign(new EventEmitter(), { destroyed: false, destroy(): void {
      if (this.destroyed) return; this.destroyed = true; trace.destroyed.push("socket");
      if (mode === "socket-error-after-eof") socket.emit("error", Error("synthetic-socket-error"));
      if (mode !== "cleanup-never-close") setTimeout(() => { trace.events.push("socket-close"); socket.emit("close", false); }, mode === "slow-close" ? 60 : 0);
      if (mode === "socket-destroy-throws") throw Error("synthetic-socket-destroy");
    } });
    class FakeResponse extends Readable {
      statusCode = mode.startsWith("status-") ? Number(mode.slice(7)) : 200;
      complete = false;
      override _read(): void {}
      override destroy(error?: Error): this {
        const first = !this.destroyed; if (first) trace.destroyed.push("response");
        const result = super.destroy(error); if (first && mode === "response-destroy-throws") throw Error("synthetic-response-destroy"); return result;
      }
    }
    const incoming = new FakeResponse(); incoming.on("close", () => { trace.events.push("response-close"); });
    const request: EventEmitter & { destroyed: boolean; writableFinished: boolean; destroy(): void; end(): void } = Object.assign(new EventEmitter(), { destroyed: false, writableFinished: false,
      destroy(): void {
        if (this.destroyed) return; this.destroyed = true; trace.destroyed.push("request");
        setTimeout(() => { trace.events.push("request-close"); request.emit("close"); }, mode === "slow-close" ? 40 : 0);
        if (mode === "request-destroy-throws") throw Error("synthetic-request-destroy");
      },
      end(): void {
        queueMicrotask(() => {
          request.emit("socket", socket); this.writableFinished = mode !== "missing-finish";
          if (this.writableFinished) request.emit("finish");
          if (mode === "timeout") return;
          if (mode === "request-error" || mode === "socket-reset") { (mode === "request-error" ? request : socket).emit("error", Error("synthetic-reset")); return; }
          onResponse(incoming);
          if (incoming.destroyed) return;
          if (mode.startsWith("plant-")) {
            const planted = join(root, "host", C.HREL, "snapshot/_work");
            if (mode === "plant-directory") fs.mkdirSync(planted, { mode: 0o700 });
            else if (mode === "plant-file") fs.writeFileSync(planted, "collision\n", { flag: "wx" });
            else { fs.mkdirSync(join(root, "victim"), { mode: 0o700 }); fs.writeFileSync(join(root, "victim/preserved.ts"), "preserved\n", { flag: "wx" }); fs.symlinkSync(join(root, "victim"), planted); }
          }
          if (mode === "response-error") { incoming.emit("error", Error("synthetic-response-error")); return; }
          if (mode === "aborted") { incoming.emit("aborted"); return; }
          if (mode === "premature-close") { incoming.destroy(); return; }
          const chunks = mode === "oversize" ? Array.from({ length: 193 }, () => Buffer.alloc(65536, 65)) : Array.from({ length: Math.ceil(body.length / 65536) }, (_, index) => body.subarray(index * 65536, (index + 1) * 65536));
          let next = 0;
          const send = (): void => {
            if (incoming.destroyed) return;
            if (next < chunks.length) { incoming.push(chunks[next++]!); queueMicrotask(send); return; }
            if (mode === "no-eof") return;
            const end = () => { if (!incoming.destroyed) { incoming.complete = mode !== "incomplete"; trace.events.push("response-eof"); incoming.push(null); } };
            if (mode === "slow-eof") setTimeout(end, 150); else end();
          };
          queueMicrotask(send);
        });
      }
    });
    return request;
  };
  return { root, trace, host: join(root, "host"), options: { scope: "OFFLINE_SYNTHETIC", fixtureRoot: root, requestFactory } satisfies DeliverySyntheticOptions };
}
async function execute(label: string, mode = "success", changes: Partial<DeliverySyntheticOptions> = {}, body = response(), usePins = pins) {
  const f = await fixture(label, mode, body, usePins), runApi = await createDeliveryRuntime();
  const result = await runApi.runSynthetic(usePins, { ...f.options, ...changes });
  const fetched = result.fetchResult; api.record(join(f.root, "test-result.json"), { label, mode, failure: result.failure, claimed: result.claimed, fetched: result.fetched, sealed: result.sealed, stageB: result.stageB, source: fetched && { requestCalls: fetched.requestCalls, statusCode: fetched.statusCode, responseEOF: fetched.responseEOF, cleanupConfirmed: fetched.cleanupConfirmed, receivedBytes: fetched.receivedBytes, retainedBytes: fetched.retainedBytes }, trace: f.trace, scope: "OFFLINE_SYNTHETIC" });
  for (const relative of ["_work/gpu-owner-recovery/cache", `${C.R2}/acquisition-execution-1`, `${C.D}/package-inputs-2`]) expect(fs.existsSync(join(f.host, relative))).toBe(false);
  return { f, result };
}
async function isolatedProbe(label: string, body: string) {
  const f = await fixture(label), script = join(f.root, "probe.ts");
  const header = `import * as fs from "node:fs";\nimport {join} from "node:path";\nimport {createDeliveryRuntime} from ${JSON.stringify(join(C.HOSTROOT, C.R2, "delivery-bootstrap.ts"))};\nconst api=await createDeliveryRuntime();\nconst spec={executable:process.execPath,args:["--no-env-file","--no-install",join(process.cwd(),"owned-caller.ts")],cwd:process.cwd(),env:{LANG:"C",LC_ALL:"C",TZ:"UTC"},stdoutCap:1024,stderrCap:1024,remainingMs:()=>{throw Error("healthy-parent-deadline-must-not-run")},workMs:1,cleanupMs:2000,deadlineOwner:"INNER_CALLER" as const};\n`;
  api.writeExclusive(script, Buffer.from(header + body));
  const started = process.hrtime.bigint(), outer = await api.runChild({ executable: process.execPath, args: ["--no-env-file", "--no-install", script], cwd: f.root, env: { LANG: "C", LC_ALL: "C", TZ: "UTC" }, stdoutCap: 65536, stderrCap: 65536, remainingMs: () => 9000 - Number(process.hrtime.bigint() - started) / 1e6, workMs: 7000, cleanupMs: 2000 });
  api.record(join(f.root, "probe-process.json"), { ...outer, stdout: api.identity(outer.stdout), stderr: api.identity(outer.stderr), scope: "OFFLINE_SYNTHETIC" });
  expect(outer.failure).toBeNull(); expect(outer.exitCode).toBe(0); expect(outer.reaped && outer.closed && outer.outEOF && outer.errEOF).toBe(true);
  const result = JSON.parse(outer.stdout.toString()) as Awaited<ReturnType<DeliveryRuntime["runChild"]>> & { listenerCountsBefore?: number[]; listenerCountsAfter?: number[] };
  api.record(join(f.root, "probe-result.json"), result);
  return { f, result, elapsedMs: Number(process.hrtime.bigint() - started) / 1e6 };
}
const printProbe = 'process.stdout.write(JSON.stringify({...result,stdout:undefined,stderr:undefined})+"\\n");\n';
function holderCaller(holder: string, detached: boolean): string {
  return `import{spawn}from"node:child_process";\nimport*as fs from"node:fs";\nconst child=spawn(process.execPath,["--no-env-file","--no-install","--eval",${JSON.stringify('import * as fs from "node:fs";fs.writeFileSync("holder-ready.json","{}\\n",{flag:"wx"});' + holder)}],{env:{LANG:"C"},detached:${detached},stdio:["ignore",1,2]});\nchild.unref();\nconst timer=setInterval(()=>{if(fs.existsSync("holder-ready.json")){clearInterval(timer);process.exit(0);}},2);\n`;
}

describe("literal packet and genuine authorization", () => {
  test("computes exact source lengths, sha256, Git blob and packet pins", () => {
    const result = api.validatePacket(packet.bytes, packet.pin, packet.table);
    expect(result.files.size).toBe(literalPaths.length);
    expect(result.directories).toContain(C.OBSERVER);
    expect(result.aggregateBytes).toBe([...sources.values()].reduce((sum, bytes) => sum + bytes.length, 0));
    for (const row of packet.table) expect(row).toEqual({ path: row.path, ...api.identity(sources.get(row.path)!) });
  });
  test("pins the actual immutable launch-boundary record", () => {
    const bytes = sources.get(C.BOUNDARY_PATH)!;
    expect(bytes.length).toBe(2525); expect(api.hash(bytes)).toBe(C.BOUNDARY_SHA);
    const record = JSON.parse(bytes.toString());
    expect(record.stageA.clockOrigin).toBe("FIRST_INLINE_BOOTSTRAP_ENTRY_BEFORE_BOOTSTRAP_CONTROLLED_PREFLIGHT");
    expect(record.launchPrecondition.clockedByBootstrap).toBe(false);
    expect(record.additionalAttemptsOrRequestsGranted).toBe(0);
  });
  test("rejects missing or replaced launch-boundary row", () => {
    for (const value of [undefined, Buffer.from("{}\n")]) {
      const files = new Map(sources); if (value) files.set(C.BOUNDARY_PATH, value); else files.delete(C.BOUNDARY_PATH);
      expect(() => api.verifyApproval(files)).toThrow("genuine-launch-boundary-sha256");
    }
  });
  test("pins the exact approved transport amendment and its four bindings", () => {
    const bytes = sources.get(C.AMENDMENT_PATH)!; expect(bytes.length).toBe(3813); expect(api.hash(bytes)).toBe(C.AMENDMENT_SHA);
    const amendment = JSON.parse(bytes.toString()); expect(amendment.additionalAttemptsOrRequestsGranted).toBe(0); expect(amendment.allowancesConsumedByThisAmendment).toBe(false);
    expect(amendment.approval.sha256).toBe(C.APPROVAL_SHA); expect(amendment.launchBoundary.sha256).toBe(C.BOUNDARY_SHA);
    for (const replacement of [undefined, Buffer.from("{}\n")]) {
      const files = new Map(sources); if (replacement) files.set(C.AMENDMENT_PATH, replacement); else files.delete(C.AMENDMENT_PATH);
      expect(() => api.verifyApproval(files)).toThrow("genuine-transport-amendment-sha256");
    }
  });
  test("accepts historical explicit path grammar without freezing the changing runtime closure", () => {
    const entryBytes = fs.readFileSync(join(C.HOSTROOT, C.R2, "runtime-entry-contract1.json")), readsBytes = fs.readFileSync(join(C.HOSTROOT, C.R2, "runtime-eligibility-reads1.json"));
    const entry = JSON.parse(entryBytes.toString()), closure = JSON.parse(readsBytes.toString()) as { reads: string[]; pendingNonAuthorizingRecords: string[]; requiredReadCount: number };
    expect(entry.callerRelativePath).toBe(C.CALLER); expect(entry.applicationArgs).toEqual(["execute"]); expect(entry.environment).toEqual({ LANG: "C", LC_ALL: "C", TZ: "UTC" });
    expect(closure.requiredReadCount).toBe(32); expect(closure.reads.length).toBe(32); expect(new Set(closure.reads).size).toBe(32); expect(closure.pendingNonAuthorizingRecords.length).toBe(2);
    for (const member of closure.reads) expect(() => api.safePath(member)).not.toThrow();
    expect(closure.reads).toContain(`${C.D}/package-acquisition-bun-source2/.gitignore`);
    expect(() => api.safePath(".gitignore")).toThrow("text-source-extension"); expect(() => api.safePath(`${C.R2}/.gitignore`)).toThrow("text-source-extension");
    expect(api.directories([...closure.reads, C.BOUNDARY_PATH, C.AMENDMENT_PATH]).length).toBeLessThanOrEqual(256);
  });
  test("requires genuine approval and all four unchanged byte bindings", () => {
    const files = new Map(sources); files.set(`${C.R2}/approval2.json`, Buffer.from("{}\n"));
    expect(() => api.verifyApproval(files)).toThrow("genuine-approval-sha256");
    for (const [, name] of C.bindings) { const changed = new Map(sources); changed.set(name, Buffer.from("{}\n")); expect(() => api.verifyApproval(changed)).toThrow("four-immutable-approval-bindings"); }
  });
  test("requires unchanged helper and reference lock members", () => {
    for (const [member] of C.fixedInputs) {
      const table = packet.table.filter(row => row.path !== member), value = JSON.parse(packet.bytes.toString());
      value.files = value.files.filter((row: { path: string }) => row.path !== member);
      value.aggregateBytes -= sources.get(member)!.length; value.directories = api.directories(table.map(row => row.path));
      const bytes = Buffer.from(JSON.stringify(value)); expect(() => api.validatePacket(bytes, api.identity(bytes), table)).toThrow("unchanged-helpers-and-lock-required");
    }
  });
  test("rejects changed packet length sha and Git blob", () => {
    for (const pin of [{ ...packet.pin, bytes: packet.pin.bytes + 1 }, { ...packet.pin, sha256: "0".repeat(64) }, { ...packet.pin, gitBlobOid: "0".repeat(40) }]) expect(() => api.validatePacket(packet.bytes, pin, packet.table)).toThrow("length-sha256-git-blob-mismatch");
  });
  test("rejects unknown members and missing caller helpers", () => {
    expect(() => api.validatePacket(packet.bytes, packet.pin, packet.table.slice(1))).toThrow("literal-file-table-count");
    const table = packet.table.map(row => row.path === C.CALLER ? { ...row, path: `${C.R2}/not-the-caller.ts` } : row);
    expect(() => api.validatePacket(packet.bytes, packet.pin, table)).toThrow("fixed-literal-table-mismatch");
  });
  test.each(["/absolute.ts", "../escape.ts", "a//b.ts", "a/./b.ts", "a/../b.ts", "a\\b.ts", "a\0b.ts", "a/cache/b.ts", `${C.R2}/acquisition-invocation-1/b.json`, `${C.R2}/acquisition-execution-1/b.json`, `${C.D}/package-inputs-2/b.json`, "archive.tgz", "native.so", C.PACKET_PATH].map(invalid => [JSON.stringify(invalid), invalid] as const))("rejects path %s", (_display, invalid) => { expect(() => api.safePath(invalid)).toThrow(); });
  test("rejects duplicate table members", () => { expect(() => api.validatePacket(packet.bytes, packet.pin, [packet.table[0]!, packet.table[0]!, ...packet.table.slice(2)])).toThrow("duplicate-literal-member"); });
  test("rejects repeated packet members", () => {
    const bad = mutatedPacket(value => { const rows = value["files"] as unknown[]; rows[1] = rows[0]; });
    expect(() => api.validatePacket(bad.bytes, bad.pin, packet.table)).toThrow("duplicate-packet-member");
  });
  test.each(["bytes", "sha256", "gitBlobOid"])("rejects tampered source %s", key => {
    const bad = mutatedPacket(value => { const first = (value["files"] as Record<string, unknown>[])[0]!; first[key] = key === "bytes" ? 1 : "0".repeat(key === "sha256" ? 64 : 40); });
    expect(() => api.validatePacket(bad.bytes, bad.pin, packet.table)).toThrow("fixed-literal-table-mismatch");
  });
  test("rejects bytes changed with unchanged table", () => {
    const bad = mutatedPacket(value => { (value["files"] as Record<string, unknown>[])[0]!["base64"] = Buffer.from("{}\n").toString("base64"); });
    expect(() => api.validatePacket(bad.bytes, bad.pin, packet.table)).toThrow("length-sha256-git-blob-mismatch");
  });
  test.each(["%%%", "YQ=", "YR==", "YQ==\n"])("rejects noncanonical base64 %s", value => { expect(() => api.decode(value, 64)).toThrow(); });
  test.each([Buffer.from([0xff]), Buffer.from([0]), Buffer.from([0x1f]), Buffer.from([0xef, 0xbb, 0xbf, 65])])("rejects nonUTF8 or binary %j", bytes => { expect(() => api.text(bytes)).toThrow(); });
  test("enforces file directory and aggregate caps", async () => {
    await expect(buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: ["file.ts"] }, () => Buffer.alloc(C.limits.file + 1, 65))).rejects.toThrow("file-byte-cap");
    await expect(buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: Array.from({ length: 7 }, (_, i) => `file${i}.ts`) }, () => Buffer.alloc(C.limits.file, 65))).rejects.toThrow("aggregate-source-cap");
    expect(() => api.directories(Array.from({ length: 90 }, (_, i) => `a${i}/b/c/file.ts`))).toThrow("snapshot-directory-cap");
    await expect(buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: Array.from({ length: 97 }, (_, i) => `file${i}.ts`) }, () => Buffer.from("x"))).rejects.toThrow("literal-closure-count");
  });
  test("rejects changed totals, directories and packet self-reference fields", () => {
    for (const mutate of [(value: Record<string, unknown>) => { value["aggregateBytes"] = 0; }, (value: Record<string, unknown>) => { value["directories"] = []; }, (value: Record<string, unknown>) => { value["publicationCommit"] = "1".repeat(40); }]) {
      const bad = mutatedPacket(mutate); expect(() => api.validatePacket(bad.bytes, bad.pin, packet.table)).toThrow();
    }
  });
  test("decodes one exact GitHub blob response", () => { expect(api.parseResponse(response(), packet.pin)).toEqual(packet.bytes); });
  test.each(["sha", "size", "encoding", "content"])("rejects bad GitHub %s", field => {
    const row = JSON.parse(response().toString()); row[field] = field === "size" ? 0 : "invalid";
    expect(() => api.parseResponse(Buffer.from(JSON.stringify(row)), packet.pin)).toThrow();
  });
  test("enforces API and decoded packet caps", () => {
    expect(() => api.parseResponse(Buffer.alloc(C.limits.response + 1, 65), packet.pin)).toThrow("github-response-cap");
    expect(() => api.decode("A".repeat(Math.ceil((C.limits.packet + 1) / 3) * 4), C.limits.packet)).toThrow();
  });
  test("uses only the caller-supplied finite literal array", async () => {
    const reads: string[] = []; await buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: literalPaths }, name => { reads.push(name); return sources.get(name)!; }); expect(reads).toEqual([...literalPaths]);
    expect(buildLiteralPacket.toString()).not.toMatch(/readdir|resolveImports|glob|fetch\(/);
  });
  test("preserves explicitly named empty UTF8 text evidence with exact zero-byte identity", async () => {
    const empty = `${C.R2}/synthetic-empty.stderr`, built = await buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: [...literalPaths, empty] }, name => name === empty ? Buffer.alloc(0) : sources.get(name)!);
    expect(built.table.at(-1)).toEqual({ path: empty, ...api.identity(Buffer.alloc(0)) });
    expect(api.validatePacket(built.bytes, built.pin, built.table).files.get(empty)?.length).toBe(0);
  });
});

describe("offline fake HTTPS and subprocess handoff lifecycle", () => {
  test("materializes complete validated text then calls literal execute in snapshot", async () => {
    const { f, result } = await execute("success"); expect(result.failure).toBeNull(); expect(result.stageB).toBe(true);
    for (const [relative, bytes] of sources) { expect(fs.readFileSync(join(result.snapshot, relative)).equals(bytes)).toBe(true); expect(fs.statSync(join(result.snapshot, relative)).mode & 0o777).toBe(0o400); }
    const called = JSON.parse(fs.readFileSync(join(result.evidence, "fake-caller.json"), "utf8"));
    expect(called.argv).toEqual(["execute"]); expect(called.cwd).toBe(result.snapshot); expect(called.execPath).toBe(process.execPath);
    expect(fs.readdirSync(join(result.snapshot, C.OBSERVER)).sort()).toEqual(["command.stderr", "command.stdout", "observation.json"]);
    const invocation = JSON.parse(fs.readFileSync(join(f.root, "fake-https-invocation.json"), "utf8")); expect(invocation.options).toEqual(api.requestOptions(pins.gitBlobOid)); expect(f.trace.calls).toBe(1);
    expect(result.fetchResult?.responseEOF && result.fetchResult.responseComplete && result.fetchResult.cleanupConfirmed).toBe(true);
    expect(result.callerResult?.reaped && result.callerResult.outEOF && result.callerResult.errEOF).toBe(true);
  });
  test("rejects duplicate packets before any source write and preserves claimed roots", async () => {
    const bad = mutatedPacket(value => { const rows = value["files"] as unknown[]; rows[1] = rows[0]; });
    const usePins = { ...pins, ...bad.pin }, { result } = await execute("duplicate", "success", {}, response(bad.bytes), usePins);
    expect(result.failure).toContain("duplicate-packet-member"); expect(result.claimed).toBe(true); expect(result.stageB).toBe(false);
    expect(fs.readdirSync(result.snapshot)).toEqual([]);
    expect(fs.existsSync(join(result.handoff, "handoff-claim.json"))).toBe(true);
  });
  test("rejects traversal before source writes", async () => {
    const bad = mutatedPacket(value => { (value["files"] as Record<string, unknown>[])[0]!["path"] = "../outside.ts"; });
    const { result } = await execute("traversal", "success", {}, response(bad.bytes), { ...pins, ...bad.pin });
    expect(result.failure).toContain("canonical-relative-path"); expect(fs.readdirSync(result.snapshot)).toEqual([]);
  });
  test("rejects bad response blob before source writes", async () => {
    const row = JSON.parse(response().toString()); row.sha = "0".repeat(40);
    const { result } = await execute("badblob", "success", {}, Buffer.from(JSON.stringify(row)));
    expect(result.failure).toContain("github-blob-response-identity"); expect(fs.readdirSync(result.snapshot)).toEqual([]);
  });
  test.each([["boundary", C.BOUNDARY_PATH, "genuine-launch-boundary-sha256"], ["amendment", C.AMENDMENT_PATH, "genuine-transport-amendment-sha256"]])("requires the genuine %s row before materialization", async (name, omitted, error) => {
    const bad = mutatedPacket(value => {
      value["files"] = (value["files"] as { path: string }[]).filter(row => row.path !== omitted);
      value["aggregateBytes"] = Number(value["aggregateBytes"]) - sources.get(omitted)!.length;
    });
    const table = packet.table.filter(row => row.path !== omitted), { result } = await execute(`missing-${name}`, "success", {}, response(bad.bytes), { ...pins, ...bad.pin, fileTable: table });
    expect(result.failure).toBe(error); expect(fs.readdirSync(result.snapshot)).toEqual([]); expect(result.stageB).toBe(false);
  });
  test.each(["plant-directory", "plant-file", "plant-symlink"])("rejects %s collisions without overwrite or adoption", async mode => {
    const { f, result } = await execute(mode, mode); expect(result.failure).not.toBeNull(); expect(result.stageB).toBe(false);
    expect(fs.readdirSync(result.snapshot)).toEqual(["_work"]);
    if (mode === "plant-symlink") expect(fs.readFileSync(join(f.root, "victim/preserved.ts"), "utf8")).toBe("preserved\n");
  });
  test("claims once and rejects replay without adoption", async () => {
    const f = await fixture("collision"); api.freshDirectory(join(f.host, C.HREL));
    const before = fs.statSync(join(f.host, C.HREL), { bigint: true });
    const result = await (await createDeliveryRuntime()).runSynthetic(pins, f.options);
    expect(result.claimed).toBe(false); expect(result.fetched).toBe(false); expect(result.failure).toBe("fresh-path-required");
    expect(fs.statSync(join(f.host, C.HREL), { bigint: true }).mtimeNs).toBe(before.mtimeNs);
  });
  test("rejects symlink ancestors without claiming or repair", async () => {
    const f = await fixture("symlink"); fs.symlinkSync(join(f.host, "_work/gpu-owner-recovery/runs"), join(f.host, C.D.split("/").slice(0, 4).join("/")));
    const result = await (await createDeliveryRuntime()).runSynthetic(pins, f.options);
    expect(result.claimed).toBe(false); expect(result.failure).toBe("host-operation-parent-invalid");
  });
  test("rejects symlink handoff roots without adoption", async () => {
    const f = await fixture("symlink-handoff"); fs.symlinkSync(f.host, join(f.host, C.HREL));
    const result = await (await createDeliveryRuntime()).runSynthetic(pins, f.options);
    expect(result.claimed).toBe(false); expect(result.failure).toBe("fresh-path-required");
  });
  test("leaves existing valid host operation parents unchanged", async () => {
    const f = await fixture("existing-parents"), relatives = ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1", C.D, C.R2];
    for (const relative of relatives) api.freshDirectory(join(f.host, relative));
    const before = relatives.map(relative => fs.statSync(join(f.host, relative), { bigint: true }));
    const result = await (await createDeliveryRuntime()).runSynthetic(pins, f.options); expect(result.failure).toBeNull();
    for (const [index, relative] of relatives.entries()) { const after = fs.statSync(join(f.host, relative), { bigint: true }); expect([after.ino, after.mode, after.mtimeNs, after.ctimeNs]).toEqual([before[index]!.ino, before[index]!.mode, before[index]!.mtimeNs, before[index]!.ctimeNs]); }
  });
  test("accepts an existing valid common cache parent without payload or metadata changes", async () => {
    const f = await fixture("existing-cache"), cache = join(f.host, "_work/gpu-owner-recovery/cache");
    api.freshDirectory(cache); api.writeExclusive(join(cache, "preserved.ts"), Buffer.from("preserved\n"));
    const before = fs.statSync(cache, { bigint: true }), fileBefore = fs.statSync(join(cache, "preserved.ts"), { bigint: true });
    const result = await (await createDeliveryRuntime()).runSynthetic(pins, f.options);
    expect(result.failure).toBeNull(); expect(f.trace.calls).toBe(1);
    const after = fs.statSync(cache, { bigint: true }), fileAfter = fs.statSync(join(cache, "preserved.ts"), { bigint: true });
    expect([after.ino, after.mode, after.size, after.mtimeNs, after.ctimeNs]).toEqual([before.ino, before.mode, before.size, before.mtimeNs, before.ctimeNs]);
    expect([fileAfter.ino, fileAfter.size, fileAfter.mtimeNs, fileAfter.ctimeNs]).toEqual([fileBefore.ino, fileBefore.size, fileBefore.mtimeNs, fileBefore.ctimeNs]);
    expect(fs.readFileSync(join(cache, "preserved.ts"), "utf8")).toBe("preserved\n"); expect(fs.existsSync(join(cache, "reference-package-inputs-2"))).toBe(false);
  });
  test.each(["file", "symlink"])("rejects a %s common cache parent before claim", async kind => {
    const f = await fixture(`invalid-cache-${kind}`), cache = join(f.host, "_work/gpu-owner-recovery/cache");
    if (kind === "file") api.writeExclusive(cache, Buffer.from("preserved\n")); else fs.symlinkSync(f.root, cache);
    const before = fs.lstatSync(cache, { bigint: true }), result = await (await createDeliveryRuntime()).runSynthetic(pins, f.options), after = fs.lstatSync(cache, { bigint: true });
    expect(result.failure).toBe("fixed-cache-parent-invalid"); expect(result.claimed).toBe(false); expect(f.trace.calls).toBe(0);
    expect([after.ino, after.mode, after.mtimeNs, after.ctimeNs]).toEqual([before.ino, before.mode, before.mtimeNs, before.ctimeNs]);
  });
  test.each(["raw", "output", "operation"])("requires fresh %s roots without consuming the handoff", async kind => {
    const f = await fixture(`existing-${kind}`);
    const relative = kind === "raw" ? "_work/gpu-owner-recovery/cache/reference-package-inputs-2" : kind === "output" ? `${C.D}/package-inputs-2` : `${C.R2}/acquisition-execution-1`;
    const parts = relative.split("/"); let current = f.host;
    for (const part of parts) { current = join(current, part); if (!fs.existsSync(current)) api.freshDirectory(current); }
    const result = await (await createDeliveryRuntime()).runSynthetic(pins, f.options);
    expect(result.failure).toBe("fresh-path-required"); expect(result.claimed).toBe(false); expect(f.trace.calls).toBe(0);
  });
  test.each(["construction-error", "request-error", "socket-reset", "response-error", "aborted", "premature-close", "incomplete", "missing-finish", "oversize", "status-301", "status-302", "status-307", "status-308", "status-401", "status-403", "status-429", "status-500"])("rejects fake HTTPS %s with exactly one request and no fallback", async mode => {
    const { f, result } = await execute(mode, mode); expect(result.failure).not.toBeNull(); expect(result.stageB).toBe(false); expect(result.sealed).toBe(false);
    expect(f.trace.calls).toBe(1); expect(result.fetchResult?.requestCalls).toBe(1); expect(result.fetchResult!.body.length).toBeLessThanOrEqual(C.limits.response);
    if (mode === "oversize") { expect(result.fetchResult!.receivedBytes).toBeGreaterThan(C.limits.response); expect(result.fetchResult!.retainedBytes).toBe(C.limits.response); }
  });
  test.each(["timeout", "no-eof", "cleanup-never-close"])("aborts %s within the source budget and records cleanup certainty", async mode => {
    const start = process.hrtime.bigint(), { f, result } = await execute(mode, mode, { fetchMs: 200 });
    expect(result.failure).toContain("github-https:https-deadline"); expect(result.stageB).toBe(false); expect(f.trace.calls).toBe(1);
    expect(Number(process.hrtime.bigint() - start) / 1e6).toBeLessThan(2000);
    expect(result.fetchResult?.cleanupConfirmed).toBe(mode !== "cleanup-never-close");
  });
  test("waits for real response EOF after all body bytes", async () => {
    const start = process.hrtime.bigint(), { result } = await execute("slow-eof", "slow-eof"); expect(result.failure).toBeNull(); expect(Number(process.hrtime.bigint() - start) / 1e6).toBeGreaterThan(150);
  });
  test("waits for request, response, and socket close before Stage B", async () => {
    const start = process.hrtime.bigint(), { f, result } = await execute("slow-close", "slow-close");
    expect(Number(process.hrtime.bigint() - start) / 1e6).toBeGreaterThan(60); expect(result.failure).toBeNull();
    expect(result.fetchResult?.requestClosed && result.fetchResult.responseClosed && result.fetchResult.socketClosed).toBe(true);
    expect(f.trace.events).toContain("socket-close");
  });
  test.each(["request-destroy-throws", "response-destroy-throws", "socket-destroy-throws", "socket-error-after-eof"])("keeps successful-body %s cleanup failure sticky", async mode => {
    const { f, result } = await execute(mode, mode); expect(result.failure).not.toBeNull(); expect(result.stageB).toBe(false);
    expect(result.fetchResult?.statusCode).toBe(200); expect(result.fetchResult?.responseEOF).toBe(true);
    expect(new Set(f.trace.destroyed)).toEqual(new Set(["request", "response", "socket"]));
  });
  test.each(["cleanup", "interrupt", "clock-after-fetch", "transport-clock", "transport-finalization-deadline", "file-close", "receipt-close", "directory-close", "finalization-deadline", "seal-deadline"] as const)("keeps %s failure sticky and preserves partials", async fault => {
    const { result } = await execute(fault, fault === "interrupt" ? "timeout" : "success", { fault, fetchMs: 300 }); expect(result.failure).not.toBeNull(); expect(result.stageB).toBe(false); expect(result.claimed).toBe(true);
    expect(fs.existsSync(result.handoff)).toBe(true); expect(fs.existsSync(join(result.handoff, "delivery-outcome.json"))).toBe(true);
    if (["cleanup", "clock-after-fetch", "transport-finalization-deadline"].includes(fault)) expect(result.fetchResult?.statusCode).toBe(200);
    if (["transport-clock", "transport-finalization-deadline", "interrupt"].includes(fault)) expect(result.fetchResult?.cleanupConfirmed).toBe(true);
  });
  test("does not apply Stage A or a new whole-script deadline to the inner-owned caller", async () => {
    const changed = new Map(sources); changed.set(C.CALLER, Buffer.from(`await new Promise(resolve=>setTimeout(resolve,250));\n${callerText}`));
    const delayed = await buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: literalPaths }, name => changed.get(name)!);
    const start = process.hrtime.bigint(), { result } = await execute("independent-stage-b", "success", { stageMs: 150 }, response(delayed.bytes), { ...pins, ...delayed.pin, fileTable: delayed.table });
    expect(result.failure).toBeNull(); expect(result.stageB).toBe(true); expect(Number(process.hrtime.bigint() - start) / 1e6).toBeGreaterThan(250);
  });
  test("clock failure before claim creates nothing", async () => {
    const { result } = await execute("clock", "success", { fault: "clock" }); expect(result.failure).toBe("stage-a-clock-failure"); expect(result.claimed).toBe(false); expect(fs.existsSync(result.handoff)).toBe(false);
  });
  test("starts Stage A at first factory entry before imports or preflight", async () => {
    const local = await createDeliveryRuntime(), f = await fixture("origin"); await new Promise(resolve => setTimeout(resolve, 30));
    const result = await local.runSynthetic(pins, { ...f.options, stageMs: 10 }); expect(result.claimed).toBe(false); expect(result.failure).toBe("stage-a-deadline");
    expect(createDeliveryRuntime.toString().indexOf("bootstrapEntryOrigin")).toBeLessThan(createDeliveryRuntime.toString().indexOf('import("node:fs")'));
  });
  test("restricts injected request factories to protected fixtures", async () => {
    const f = await fixture("guard"); await expect((await createDeliveryRuntime()).runSynthetic(pins, { ...f.options, fixtureRoot: C.HOSTROOT })).rejects.toThrow("protected-fixture-root-required");
    await expect((await createDeliveryRuntime()).runSynthetic(pins, { ...f.options, requestFactory: undefined as unknown as DeliveryRequestFactory })).rejects.toThrow("fixture-only-fake-https-required"); expect(f.trace.calls).toBe(0);
  });
  test("exclusive materialization rejects existing regular or symlink files", async () => {
    const f = await fixture("exclusive"); api.writeExclusive(join(f.root, "original.ts"), Buffer.from("original\n"));
    expect(() => api.writeExclusive(join(f.root, "original.ts"), Buffer.from("changed\n"))).toThrow();
    fs.symlinkSync(join(f.root, "original.ts"), join(f.root, "link.ts")); expect(() => api.writeExclusive(join(f.root, "link.ts"), Buffer.from("changed\n"))).toThrow();
    expect(fs.readFileSync(join(f.root, "original.ts"), "utf8")).toBe("original\n");
    await expect(readLiteralText(f.root, "link.ts")).rejects.toThrow(); expect(await readLiteralText(f.root, "original.ts")).toEqual(Buffer.from("original\n"));
  });
  test.each(["success", "timeout", "stdout-cap", "stderr-cap", "interrupt", "cleanup"])("keeps owned synthetic caller %s exit EOF cleanup bounded", async mode => {
    const f = await fixture(`caller-${mode}`), script = join(f.root, "owned-caller.ts");
    const text = mode === "timeout" || mode === "interrupt" ? "setInterval(()=>{},1000);\n" : mode === "stdout-cap" ? "process.stdout.write(Buffer.alloc(65536,65));\n" : mode === "stderr-cap" ? "process.stderr.write(Buffer.alloc(65536,65));\n" : "process.stdout.write('synthetic\\n');process.stderr.write('synthetic\\n');\n";
    api.writeExclusive(script, Buffer.from(text)); const origin = process.hrtime.bigint();
    const result = await api.runChild({ executable: process.execPath, args: ["--no-env-file", "--no-install", script], cwd: f.root, env: { LANG: "C", LC_ALL: "C", TZ: "UTC" }, stdoutCap: 1024, stderrCap: 1024, remainingMs: () => 1000 - Number(process.hrtime.bigint() - origin) / 1e6, workMs: 150, cleanupMs: 500, ...(mode === "interrupt" || mode === "cleanup" ? { syntheticFault: mode } : {}) });
    expect(result.reaped && result.closed && result.outEOF && result.errEOF).toBe(true); expect(result.stdout.length).toBeLessThanOrEqual(1024); expect(result.stderr.length).toBeLessThanOrEqual(1024);
    if (mode === "success") expect(result.failure).toBeNull(); else expect(result.failure).not.toBeNull();
    if (mode === "cleanup") expect(result.exitCode).toBe(0);
    api.record(join(f.root, "caller-lifecycle.json"), { mode, ...result, stdout: api.identity(result.stdout), stderr: api.identity(result.stderr), scope: "OFFLINE_SYNTHETIC" });
  });
  test("waits for synthetic caller descendants and pipe EOF rather than stdout completion", async () => {
    const f = await fixture("caller-descendant"), script = join(f.root, "owned-caller.ts");
    api.writeExclusive(script, Buffer.from('import {spawn} from "node:child_process";\nprocess.stdout.write("synthetic\\n");\nconst child=spawn(process.execPath,["--no-env-file","--no-install","--eval","setTimeout(()=>{},150)"],{env:{LANG:"C"},stdio:["ignore",1,2]});\nawait new Promise(resolve=>child.once("close",resolve));\n'));
    const origin = process.hrtime.bigint(), result = await api.runChild({ executable: process.execPath, args: ["--no-env-file", "--no-install", script], cwd: f.root, env: { LANG: "C", LC_ALL: "C" }, stdoutCap: 1024, stderrCap: 1024, remainingMs: () => 2000 - Number(process.hrtime.bigint() - origin) / 1e6, workMs: 1500, cleanupMs: 500 });
    expect(result.failure).toBeNull(); expect(result.reaped && result.closed && result.outEOF && result.errEOF).toBe(true); expect(Number(process.hrtime.bigint() - origin) / 1e6).toBeGreaterThan(150);
  });
});

describe("confirmed per-pipe destruction evidence", () => {
  test("retries a first thrown destroy and still attempts the other pipe", () => {
    const helper = api.createPipeCleanup(); let outCalls = 0, errCalls = 0;
    const out = { destroyed: false, destroy() { if (++outCalls === 1) throw Error("first-destroy"); this.destroyed = true; } };
    const err = { destroyed: false, destroy() { errCalls++; this.destroyed = true; } };
    const first = helper.attempt(out, err);
    expect(first.pipesDestroyed).toBe(false); expect(first.cleanupFailed).toBe(true); expect(first.stdout.confirmed).toBe(false); expect(first.stderr.confirmed).toBe(true); expect(errCalls).toBe(1);
    const second = helper.attempt(out, err);
    expect(second.pipesDestroyed).toBe(true); expect(second.cleanupFailed).toBe(true); expect(second.stdout.failed).toBe(true);
    expect(second.stdout.attempts).toBe(2); expect(second.stderr.attempts).toBe(1); expect(outCalls).toBe(2); expect(errCalls).toBe(1);
    expect(first.stdout.confirmed).toBe(false); expect(first.stdout.attempts).toBe(1);
  });
  test("does not confirm a no-op destroy and reattempts only the unconfirmed pipe", () => {
    const helper = api.createPipeCleanup(); let outCalls = 0, errCalls = 0;
    const out = { destroyed: false, destroy() { outCalls++; } }, err = { destroyed: false, destroy() { errCalls++; this.destroyed = true; } };
    helper.attempt(out, err); const second = helper.attempt(out, err);
    expect(second.pipesDestroyed).toBe(false); expect(second.stdout.destroyed).toBe(false); expect(second.stdout.confirmed).toBe(false); expect(second.cleanupFailed).toBe(true);
    expect(outCalls).toBe(2); expect(errCalls).toBe(1); expect(second.stdout.attempts).toBe(2);
  });
  test("records throwing state getters as unknown even when destruction itself returns", () => {
    const helper = api.createPipeCleanup(); let getterFails = true, destroyed = false, calls = 0;
    const out = { get destroyed() { if (getterFails) throw Error("state-getter"); return destroyed; }, destroy() { calls++; destroyed = true; } };
    const err = { destroyed: false, destroy() { this.destroyed = true; } };
    const first = helper.attempt(out, err); expect(first.stdout.destroyed).toBeNull(); expect(first.stdout.confirmed).toBe(false); expect(first.pipesDestroyed).toBe(false); expect(first.stdout.getterErrors).toBeGreaterThan(0);
    getterFails = false; const recovered = helper.attempt(out, err);
    expect(recovered.pipesDestroyed).toBe(true); expect(recovered.cleanupFailed).toBe(true); expect(recovered.stdout.failed).toBe(true); expect(calls).toBe(1);
  });
  test("a throw after actual destruction or a later pipe error remains a failed cleanup", () => {
    const helper = api.createPipeCleanup(), out = { destroyed: false, destroy() { this.destroyed = true; throw Error("destroyed-then-threw"); } }, err = { destroyed: false, destroy() { this.destroyed = true; } };
    const first = helper.attempt(out, err); expect(first.pipesDestroyed).toBe(true); expect(first.cleanupFailed).toBe(true); expect(first.stdout.destroyErrors).toBe(1);
    helper.noteError("stderr"); const final = helper.attempt(out, err);
    expect(final.pipesDestroyed).toBe(true); expect(final.cleanupFailed).toBe(true); expect(final.stderr.streamErrors).toBe(1); expect(final.stdout.failed && final.stderr.failed).toBe(true);
  });
  test("repeated failures stay bounded per call and do not block attempts on either pipe", () => {
    const helper = api.createPipeCleanup(); let outCalls = 0, errCalls = 0;
    const out = { destroyed: false, destroy() { outCalls++; throw Error("out-always-fails"); } }, err = { destroyed: false, destroy() { errCalls++; throw Error("err-always-fails"); } };
    for (let i = 0; i < 3; i++) helper.attempt(out, err);
    const report = helper.report(); expect(outCalls).toBe(3); expect(errCalls).toBe(3); expect(report.cleanupCalls).toBe(3);
    expect(report.pipesDestroyed).toBe(false); expect(report.cleanupFailed).toBe(true); expect(report.stdout.attempts).toBe(3); expect(report.stderr.attempts).toBe(3);
    expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThan(4096);
  });
  test("absent pipes are not fabricated as confirmed destructions", () => {
    const helper = api.createPipeCleanup(), report = helper.attempt(null, undefined);
    expect(report.pipesDestroyed).toBe(false); expect(report.destructionAttempted).toBe(false); expect(report.stdout.present).toBe(false); expect(report.stderr.present).toBe(false);
  });
  test("the real runChild uses the same tested per-pipe helper", () => {
    const source = api.runChild.toString(); expect(source).toContain("createPipeCleanup()"); expect(source).toContain("pipeCleanup.attempt("); expect(source).toContain("pipeCleanup.report()"); expect(source).toContain('pipeCleanup.noteError("stdout")');
  });
  test("real isolated runChild retries its native pipe after a first destroy throw without clearing failure", async () => {
    const caller = holderCaller("setTimeout(()=>process.exit(0),2300);", true);
    const body = `fs.writeFileSync("owned-caller.ts",${JSON.stringify(caller)},{flag:"wx"});\nconst {ChildProcess}=await import("node:child_process");const original=ChildProcess.prototype.emit;ChildProcess.prototype.emit=function(event,...args){if(event==="spawn"&&this.stdout&&!this.pipeFaultInstalled){this.pipeFaultInstalled=true;const stream=this.stdout, destroy=stream.destroy;let first=true;stream.destroy=function(...values){if(first){first=false;throw Error("fixture-first-destroy")}return destroy.apply(this,values)}}return original.call(this,event,...args)};\nconst result=await api.runChild(spec);\n${printProbe}`;
    const { result, elapsedMs } = await isolatedProbe("inner-native-pipe-recovery", body);
    expect(elapsedMs).toBeLessThan(4000); expect(result.exitCode).toBe(0); expect(result.reaped).toBe(true);
    expect(result.pipeDestruction.stdout.attempts).toBe(2); expect(result.pipeDestruction.stdout.destroyErrors).toBe(1); expect(result.pipeDestruction.stdout.confirmed).toBe(true);
    expect(result.pipeDestruction.stderr.confirmed).toBe(true); expect(result.pipesDestroyed).toBe(true); expect(result.pipeCleanupFailed).toBe(true);
    expect(result.cleanupConfirmed).toBe(false); expect(result.failure).not.toBeNull(); expect(result.cleanupOriginsStarted).toBe(1); expect(result.cleanupBudgetMs).toBe(2000);
  });
});

describe("exact INNER_CALLER cleanup and cancellation", () => {
  test("bounds retained grandchild pipes after the real caller exit without fabricating EOF", async () => {
    const caller = holderCaller('process.on("SIGTERM",()=>{});setTimeout(()=>process.exit(0),5000);', false);
    const { result, elapsedMs } = await isolatedProbe("inner-retained-pipes", `fs.writeFileSync("owned-caller.ts",${JSON.stringify(caller)},{flag:"wx"});\nconst result=await api.runChild(spec);\n${printProbe}`);
    expect(elapsedMs).toBeLessThan(4000); expect(elapsedMs).toBeGreaterThan(1900);
    expect(result.reaped).toBe(true); expect(result.exitCode).toBe(0); expect(result.cleanupExpired).toBe(true); expect(result.pipesDestroyed).toBe(true);
    expect(result.failure).not.toBeNull(); expect(result.cleanupConfirmed).toBe(false); expect(result.cleanupOriginsStarted).toBe(1); expect(result.cleanupBudgetMs).toBe(2000);
    expect(result.signalAttempts.some(row => row.target === "GROUP" && row.signal === "SIGKILL")).toBe(true); expect(result.descendantsConfirmedGone).toBe(false);
  });
  test("allows clean late EOF within the original drain window without a healthy work deadline", async () => {
    const caller = holderCaller("setTimeout(()=>process.exit(0),150);", true);
    const { result, elapsedMs } = await isolatedProbe("inner-clean-drain", `fs.writeFileSync("owned-caller.ts",${JSON.stringify(caller)},{flag:"wx"});\nconst result=await api.runChild(spec);\n${printProbe}`);
    expect(elapsedMs).toBeGreaterThan(150); expect(result.failure).toBeNull(); expect(result.reaped && result.closed && result.outEOF && result.errEOF).toBe(true);
    expect(result.cleanupReason).toBe("POST_EXIT_DRAIN"); expect(result.cleanupOriginsStarted).toBe(1); expect(result.cleanupExpired).toBe(false);
    expect(result.signalAttempts).toEqual([]); expect(result.processGroupGone).toBe(true); expect(result.descendantsConfirmedGone).toBe(false);
  });
  test("never restarts post-exit cleanup when a later pipe overflow latches failure", async () => {
    const caller = holderCaller("setTimeout(()=>process.stdout.write(Buffer.alloc(65536,65)),1400);setTimeout(()=>process.exit(0),2300);", true);
    const { result, elapsedMs } = await isolatedProbe("inner-single-origin", `fs.writeFileSync("owned-caller.ts",${JSON.stringify(caller)},{flag:"wx"});\nconst result=await api.runChild(spec);\n${printProbe}`);
    expect(result.failure).toBe("child-stdout-cap"); expect(result.cleanupReason).toBe("POST_EXIT_DRAIN"); expect(result.cleanupOriginsStarted).toBe(1);
    expect(result.cleanupExpired).toBe(true); expect(result.pipesDestroyed).toBe(true); expect(result.outEOF).toBe(false); expect(result.cleanupConfirmed).toBe(false);
    expect(elapsedMs).toBeLessThan(3000); expect(result.descendantsConfirmedGone).toBe(false);
  });
  test("late actual EOF and exit zero cannot erase a failure latched before cleanup", async () => {
    const caller = 'process.on("SIGTERM",()=>setTimeout(()=>process.exit(0),10));setTimeout(()=>process.stdout.write(Buffer.alloc(65536,65)),20);setInterval(()=>{},1000);';
    const { result } = await isolatedProbe("inner-late-eof-failure", `fs.writeFileSync("owned-caller.ts",${JSON.stringify(caller)},{flag:"wx"});\nconst result=await api.runChild(spec);\n${printProbe}`);
    expect(result.exitCode).toBe(0); expect(result.reaped && result.closed && result.outEOF && result.errEOF).toBe(true);
    expect(result.failure).toBe("child-stdout-cap"); expect(result.cleanupOriginsStarted).toBe(1); expect(result.cleanupReason).toBe("FAILURE");
  });
  test.each(["SIGINT", "SIGTERM", "SIGHUP"] as const)("forwards real isolated %s to the detached caller and removes lifetime listeners", async sig => {
    const caller = 'import*as fs from"node:fs";for(const sig of["SIGINT","SIGTERM","SIGHUP"])process.on(sig,()=>fs.appendFileSync("forwarded-signals.jsonl",JSON.stringify(sig)+"\\n"));fs.writeFileSync("caller-ready.json","{}\\n",{flag:"wx"});setInterval(()=>{},1000);';
    const body = `fs.writeFileSync("owned-caller.ts",${JSON.stringify(caller)},{flag:"wx"});\nconst names=["SIGINT","SIGTERM","SIGHUP"];const before=names.map(name=>process.listenerCount(name));\nconst sender=setInterval(()=>{if(fs.existsSync("caller-ready.json")){clearInterval(sender);process.kill(process.pid,${JSON.stringify(sig)});}},2);\nconst result=await api.runChild(spec);\nconst after=names.map(name=>process.listenerCount(name));\nprocess.stdout.write(JSON.stringify({...result,stdout:undefined,stderr:undefined,listenerCountsBefore:before,listenerCountsAfter:after})+"\\n");\n`;
    const { f, result } = await isolatedProbe(`inner-${sig.toLowerCase()}`, body);
    expect(result.interrupted).toBe(true); expect(result.cancellationSignal).toBe(sig); expect(result.failure).toBe("delivery-interrupted");
    expect(result.reaped && result.closed && result.outEOF && result.errEOF).toBe(true); expect(result.cleanupOriginsStarted).toBe(1);
    expect(result.signalAttempts).toContainEqual({ target: "CHILD", signal: sig, result: "SENT" });
    expect(result.listenerCountsAfter).toEqual(result.listenerCountsBefore);
    const observed = fs.existsSync(join(f.root, "forwarded-signals.jsonl")) ? fs.readFileSync(join(f.root, "forwarded-signals.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as string) : [];
    expect(observed.every(value => ["SIGINT", "SIGTERM", "SIGHUP"].includes(value))).toBe(true);
    api.record(join(f.root, "signal-observations.json"), { cancellationSignal: sig, signalAttempts: result.signalAttempts, observedChildHandlerSignals: observed, originalChildHandlerAcknowledged: observed.includes(sig), descendantsConfirmedGone: false, scope: "OFFLINE_SYNTHETIC" });
    expect(result.descendantsConfirmedGone).toBe(false);
  });
  test("real forwarded SIGHUP produces the default caller exit witness independently of TERM handling", async () => {
    const caller = 'import*as fs from"node:fs";process.on("SIGTERM",()=>{});fs.writeFileSync("caller-ready.json","{}\\n",{flag:"wx"});setInterval(()=>{},1000);';
    const body = `fs.writeFileSync("owned-caller.ts",${JSON.stringify(caller)},{flag:"wx"});\nconst sender=setInterval(()=>{if(fs.existsSync("caller-ready.json")){clearInterval(sender);process.kill(process.pid,"SIGHUP");}},2);\nconst result=await api.runChild(spec);\n${printProbe}`;
    const { result } = await isolatedProbe("inner-hup-exit-witness", body);
    expect(result.cancellationSignal).toBe("SIGHUP"); expect(result.reaped).toBe(true); expect(result.signal).toBe("SIGHUP"); expect(result.failure).toBe("delivery-interrupted");
    expect(result.signalAttempts).toContainEqual({ target: "CHILD", signal: "SIGHUP", result: "SENT" }); expect(result.cleanupOriginsStarted).toBe(1);
  });
  test.each(["false", "throw"])("records a real owned-group signal adapter %s result without reporting delivery", async mode => {
    const caller = 'setTimeout(()=>process.stdout.write(Buffer.alloc(65536,65)),20);setInterval(()=>{},1000);';
    const body = `fs.writeFileSync("owned-caller.ts",${JSON.stringify(caller)},{flag:"wx"});\nconst original=process.kill.bind(process);\nprocess.kill=((pid,sig)=>{if(pid<0&&sig==="SIGTERM"){${mode === "false" ? "return false;" : 'throw Error("synthetic-signal-send");'}}return original(pid,sig);}) as typeof process.kill;\nconst result=await api.runChild(spec);\n${printProbe}`;
    const { result } = await isolatedProbe(`inner-send-${mode}`, body);
    expect(result.signalFailure).toBe(true); expect(result.cleanupConfirmed).toBe(false); expect(result.failure).toBe("child-stdout-cap");
    expect(result.signalAttempts).toContainEqual({ target: "GROUP", signal: "SIGTERM", result: mode === "false" ? "NOT_DELIVERED" : "THREW" });
    expect(result.signalAttempts).toContainEqual({ target: "GROUP", signal: "SIGKILL", result: "SENT" }); expect(result.reaped).toBe(true);
  });
  test("records false child forwarding separately from successful group termination", async () => {
    const caller = 'import*as fs from"node:fs";fs.writeFileSync("caller-ready.json","{}\\n",{flag:"wx"});setInterval(()=>{},1000);';
    const body = `fs.writeFileSync("owned-caller.ts",${JSON.stringify(caller)},{flag:"wx"});\nconst {ChildProcess}=await import("node:child_process");const original=ChildProcess.prototype.kill;ChildProcess.prototype.kill=function(sig){return sig==="SIGHUP"?false:original.call(this,sig)};\nconst sender=setInterval(()=>{if(fs.existsSync("caller-ready.json")){clearInterval(sender);process.kill(process.pid,"SIGHUP");}},2);\nconst result=await api.runChild(spec);\n${printProbe}`;
    const { result } = await isolatedProbe("inner-child-send-false", body);
    expect(result.signalAttempts).toContainEqual({ target: "CHILD", signal: "SIGHUP", result: "NOT_DELIVERED" });
    expect(result.signalFailure).toBe(true); expect(result.failure).toBe("delivery-interrupted"); expect(result.cleanupConfirmed).toBe(false); expect(result.reaped).toBe(true);
  });
  test("reports failed spawn as no child rather than a fabricated exit witness", async () => {
    const { result } = await isolatedProbe("inner-spawn-failure", `const result=await api.runChild({...spec,executable:join(process.cwd(),"missing-bun")});\n${printProbe}`);
    expect(result.spawnAttempted).toBe(true); expect(result.spawnError).toBe(true); expect(result.spawned).toBe(false); expect(result.pid).toBeNull(); expect(result.noChildCreated).toBe(true);
    expect(result.reaped).toBe(false); expect(result.exitCode).toBeNull(); expect(result.failure).toBe("child-spawn-error"); expect(result.cleanupConfirmed).toBe(false);
  });
  test("a real isolated post-spawn local clock exception starts cleanup once and stays failed", async () => {
    const caller = 'import*as fs from"node:fs";fs.writeFileSync("caller-ready.json","{}\\n",{flag:"wx"});setInterval(()=>{},1000);';
    const body = `fs.writeFileSync("owned-caller.ts",${JSON.stringify(caller)},{flag:"wx"});\nconst timer=setInterval(()=>{if(fs.existsSync("caller-ready.json")){clearInterval(timer);const original=process.hrtime.bigint;let once=true;process.hrtime.bigint=()=>{if(once){once=false;throw Error("synthetic-clock")}return original()};}},2);\nconst result=await api.runChild(spec);\n${printProbe}`;
    const { result } = await isolatedProbe("inner-clock-failure", body);
    expect(result.spawned).toBe(true); expect(result.reaped).toBe(true); expect(result.cleanupClockFailed).toBe(true);
    expect(result.failure).toBe("child-clock-failure"); expect(result.cleanupOriginsStarted).toBe(1); expect(result.cleanupConfirmed).toBe(false);
  });
  test("a non-inner parent clock failure cannot become successful cleanup or renew its origin", async () => {
    const body = 'fs.writeFileSync("owned-caller.ts","setInterval(()=>{},1000);\\n",{flag:"wx"});let calls=0;const result=await api.runChild({...spec,deadlineOwner:undefined,workMs:5000,remainingMs:()=>{if(calls++===0)return 7000;throw Error("fixture-parent-clock")}});\n' + printProbe;
    const { result } = await isolatedProbe("child-parent-clock-failure", body);
    expect(result.failure).toBe("parent-clock-failure"); expect(result.spawned && result.reaped).toBe(true); expect(result.cleanupClockFailed).toBe(true); expect(result.cleanupOriginsStarted).toBe(1); expect(result.cleanupConfirmed).toBe(false);
  });
});

describe("shared strict verification assessment", () => {
  const results = ["tests", "typecheck", "fish-syntax"].map(name => ({ name, spawned: true, pid: 123, exitCode: 0, failure: null, reaped: true, closed: true, outEOF: true, errEOF: true, cleanupConfirmed: true, cleanupExpired: false, pipesDestroyed: false, pipeDestructionAttempted: false, pipeCleanupFailed: false, processGroupGone: true, signalFailure: false }));
  const input = { testText: " 117 pass\n 0 fail\n", results, readchecksMatch: true, sourceUnchanged: true };
  test("is the exported assessment actually wired into the real receipt PASS decision", () => {
    expect(assessDeliveryVerification(input).passed).toBe(true);
    const source = verifyDelivery.toString(); expect(source).toContain("assessDeliveryVerification("); expect(source).toMatch(/\{\s*passed,\s*testsPassed,\s*testsFailed\s*\}\s*=\s*assessment/);
    expect(source).toMatch(/status:\s*passed\s*\?/); expect(source).toContain("assessment,"); expect(source).not.toContain("text.match(");
  });
  test.each(["1 pass\n0 fail\n1 pass\n", "1 pass\n0 fail\n1 fail\n", "9007199254740992 pass\n0 fail\n", "9007199254740993 pass\n0 fail\n", "NaN pass\n0 fail\n", "Infinity pass\n0 fail\n", "1.5 pass\n0 fail\n", "1e2 pass\n0 fail\n", "-1 pass\n0 fail\n", "0 pass\n0 fail\n", "01 pass\n0 fail\n", "1 pass\n1 fail\n", "1 pass\n0 fail trailing\n", "1 pass\n0 fail\nNaN fail\n", "1\n pass\n0 fail\n", "1 pass\n", "0 fail\n"])("rejects malformed duplicate unsafe or contradictory counts %j", testText => { expect(assessDeliveryVerification({ ...input, testText }).passed).toBe(false); });
  test("accepts one line-local canonical summary pair and ignores ordinary Bun case labels", () => {
    expect(assessDeliveryVerification({ ...input, testText: "(pass) ordinary test\r\n\t117 pass\r\n\t0 fail\r\n" }).passed).toBe(true);
  });
  test.each(["(pass) pass through", "(pass) failover route", "(pass) passfailwords", "(fail) fail through", "(skip) pass through", "(todo) fail through", "\t(pass) 9007199254740992 pass"])("accepts a legitimate Bun case label %j without treating its title as a summary", label => {
    expect(assessDeliveryVerification({ ...input, testText: label + "\n" + input.testText }).passed).toBe(true);
  });
  test.each(["(pass) pass through\n1 pass\n0 fail\n1 pass\n", "(skip) pass through\nNaN pass\n0 fail\n", "(todo) fail through\n9007199254740992 pass\n0 fail\n", "1 pass (pass) label\n0 fail\n"])("case label recognition does not hide invalid numeric summary lines %j", testText => {
    expect(assessDeliveryVerification({ ...input, testText }).passed).toBe(false);
  });
  test.each(["pass 3", "fail", "1\vpass", "3 pass."])("rejects an additional malformed summary-shaped line %j", line => {
    expect(assessDeliveryVerification({ ...input, testText: input.testText + line + "\n" }).passed).toBe(false);
  });
  test.each(["exitCode", "failure", "reaped", "closed", "outEOF", "errEOF", "cleanupConfirmed", "cleanupExpired", "pipesDestroyed", "pipeDestructionAttempted", "pipeCleanupFailed", "processGroupGone", "signalFailure", "spawned", "pid"])("command %s facts override valid summaries", field => {
    const changed = results.map(row => ({ ...row }));
    Object.assign(changed[0]!, { [field]: field === "exitCode" ? 1 : field === "failure" ? "sticky-failure" : field === "pid" ? null : ["cleanupExpired", "pipesDestroyed", "pipeDestructionAttempted", "pipeCleanupFailed", "signalFailure"].includes(field) });
    expect(assessDeliveryVerification({ ...input, results: changed }).passed).toBe(false);
  });
  test("requires unchanged readchecks/source and the real Fish and TypeScript commands", () => {
    expect(assessDeliveryVerification({ ...input, readchecksMatch: false }).passed).toBe(false); expect(assessDeliveryVerification({ ...input, sourceUnchanged: false }).passed).toBe(false);
    expect(assessDeliveryVerification({ ...input, results: results.slice(0, 2) }).passed).toBe(false);
    expect(assessDeliveryVerification({ ...input, results: [results[0]!, results[1]!, results[1]!] }).passed).toBe(false);
  });
});

test("pass through", () => { expect(typeof assessDeliveryVerification).toBe("function"); });

describe("inline renderer and fixed tool contracts", () => {
  test("embeds self-contained builtin-only implementation in nonrunning Fish syntax fixture", async () => {
    const rendered = await renderDelivery(pins, "OFFLINE_SYNTHETIC_NONRUNNING");
    expect(rendered.inline).toContain(C.APPROVAL_SHA); expect(rendered.inline).toContain(C.BOUNDARY_SHA);
    expect(rendered.inline).toContain(C.AMENDMENT_SHA);
    expect(rendered.body).toContain("MISE_AUTO_INSTALL false"); expect(rendered.body).toContain("MISE_TASK_RUN_AUTO_INSTALL false");
    expect(rendered.body).toContain("MISE_EXEC_AUTO_INSTALL false"); expect(rendered.body).toContain("core:bun@1.4.0");
    expect(rendered.body).not.toContain("/usr/local/bin/bun"); expect(rendered.body).not.toContain("date "); expect(rendered.runnableOperatorCommand).toBe(false);
    expect(rendered.body.split("\n")[1]).toBe("exit 1");
    const imports = [...rendered.inline.matchAll(/import\("([^"]+)"\)/g)].map(row => row[1]); expect(imports).toEqual(["node:fs", "node:path", "node:crypto", "node:child_process", "node:https"]);
  });
  test("refuses production rendering and statically gates bootstrap before any claim or tool invocation", async () => {
    await expect(renderDelivery(pins, "PUBLISHED_OPERATOR_ONLY")).rejects.toThrow("successful-committed-packet-and-https-publication-required");
    expect(C.blockers).toEqual([]); expect(createDeliveryRuntime.toString()).toContain("https.request(options, onResponse)");
  });
  test("fixes one anonymous direct HTTPS endpoint without environment or credential configuration reads", () => {
    expect(api.requestOptions("a".repeat(40))).toEqual({ protocol: "https:", hostname: "api.github.com", port: 443, path: "/repos/proveo-ca/chess-coach/git/blobs/" + "a".repeat(40), method: "GET", agent: false, headers: { Accept: "application/vnd.github+json", "User-Agent": "chess-coach-reference-package-handoff-2", Connection: "close", "Accept-Encoding": "identity" } });
    expect(() => api.requestOptions("https://example.com")).toThrow(); expect(api.requestOptions.toString()).not.toMatch(/process.env|Authorization|Cookie|Proxy|GH_TOKEN|GITHUB_TOKEN/);
    expect(createDeliveryRuntime.toString()).not.toContain("ghEnvironment"); expect(createDeliveryRuntime.toString()).not.toContain('Bun.which("gh"');
  });
});
