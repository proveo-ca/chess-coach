// SPEC: _spec/runtime-protocol.puml
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import { join } from "node:path";
import { createDeliveryRuntime } from "./delivery-bootstrap.ts";
import type { DeliveryPins, DeliveryRuntime, DeliverySyntheticOptions } from "./delivery-bootstrap.ts";
import { buildLiteralPacket, readLiteralText } from "./delivery-packet.ts";
import { renderDelivery } from "./delivery-render.ts";

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
if (process.versions.bun !== "1.4.0") throw Error("same-bun-required");
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
  ...C.bindings.map(row => row[1]), `${C.R2}/approval2.json`, C.BOUNDARY_PATH, C.CALLER,
  ...C.fixedInputs.map(row => row[0])
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
  const fakeGh = join(root, "fake-gh.ts");
  const script = `import * as fs from "node:fs";
import { join } from "node:path";
const mode=${JSON.stringify(mode)},root=process.cwd();
const expected=${JSON.stringify(api.ghArgs(expectedPins.gitBlobOid))};
const args=process.argv.slice(2);
if(JSON.stringify(args)!==JSON.stringify(expected))throw Error("fixed-gh-arguments");
fs.writeFileSync(join(root,"fake-gh-invocation.json"),JSON.stringify({args,execPath:process.execPath,scope:"OFFLINE_SYNTHETIC"})+"\\n",{flag:"wx"});
if(mode==="success")process.stdout.write(fs.readFileSync(join(root,"response.json")));
else if(mode==="nonzero"){process.stderr.write("synthetic-gh-failure\\n");process.exitCode=7;}
else if(mode==="oversize"){for(let i=0;i<210;i++)process.stdout.write(Buffer.alloc(65536,65));}
else if(mode==="stderr-cap"){for(let i=0;i<3;i++)process.stderr.write(Buffer.alloc(65536,65));}
else if(mode==="timeout"){process.on("SIGTERM",()=>{});setInterval(()=>{},1000);}
else if(mode==="slow-exit"){process.stdout.write(fs.readFileSync(join(root,"response.json")));setTimeout(()=>{},150);}
else if(mode.startsWith("plant-")){
const planted=join(root,"host",${JSON.stringify(C.HREL)},"snapshot/_work");
if(mode==="plant-directory")fs.mkdirSync(planted,{mode:0o700});
else if(mode==="plant-file")fs.writeFileSync(planted,"collision\\n",{flag:"wx"});
else{fs.mkdirSync(join(root,"victim"),{mode:0o700});fs.writeFileSync(join(root,"victim/preserved.ts"),"preserved\\n",{flag:"wx"});fs.symlinkSync(join(root,"victim"),planted);}
process.stdout.write(fs.readFileSync(join(root,"response.json")));
}
else if(mode==="pipe-descendant"){
const {spawn}=await import("node:child_process");
const child=spawn(process.execPath,["--no-env-file","--no-install","--eval","setTimeout(()=>{},150)"],{env:{LANG:"C"},stdio:["ignore",1,2]});
child.unref();process.stdout.write(fs.readFileSync(join(root,"response.json")));process.exit(0);
}
`;
  api.writeExclusive(fakeGh, Buffer.from(script));
  for (const part of ["host", "host/_work", "host/_work/gpu-owner-recovery", "host/_work/gpu-owner-recovery/runs"]) api.freshDirectory(join(root, part));
  return { root, fakeGh, host: join(root, "host"), options: { scope: "OFFLINE_SYNTHETIC", fixtureRoot: root, fakeGh } satisfies DeliverySyntheticOptions };
}
async function execute(label: string, mode = "success", changes: Partial<DeliverySyntheticOptions> = {}, body = response(), usePins = pins) {
  const f = await fixture(label, mode, body, usePins), runApi = await createDeliveryRuntime();
  const result = await runApi.runSynthetic(usePins, { ...f.options, ...changes });
  api.record(join(f.root, "test-result.json"), { label, mode, failure: result.failure, claimed: result.claimed, fetched: result.fetched, sealed: result.sealed, stageB: result.stageB, scope: "OFFLINE_SYNTHETIC" });
  for (const relative of ["_work/gpu-owner-recovery/cache", `${C.R2}/acquisition-execution-1`, `${C.D}/package-inputs-2`]) expect(fs.existsSync(join(f.host, relative))).toBe(false);
  return { f, result };
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
});

describe("offline fake-subprocess handoff lifecycle", () => {
  test("materializes complete validated text then calls literal execute in snapshot", async () => {
    const { f, result } = await execute("success"); expect(result.failure).toBeNull(); expect(result.stageB).toBe(true);
    for (const [relative, bytes] of sources) { expect(fs.readFileSync(join(result.snapshot, relative)).equals(bytes)).toBe(true); expect(fs.statSync(join(result.snapshot, relative)).mode & 0o777).toBe(0o400); }
    const called = JSON.parse(fs.readFileSync(join(result.evidence, "fake-caller.json"), "utf8"));
    expect(called.argv).toEqual(["execute"]); expect(called.cwd).toBe(result.snapshot); expect(called.execPath).toBe(process.execPath);
    expect(fs.readdirSync(join(result.snapshot, C.OBSERVER)).sort()).toEqual(["command.stderr", "command.stdout", "observation.json"]);
    const invocation = JSON.parse(fs.readFileSync(join(f.root, "fake-gh-invocation.json"), "utf8")); expect(invocation.args).toEqual(api.ghArgs(pins.gitBlobOid));
    expect(result.fetchResult?.outEOF && result.fetchResult.errEOF && result.fetchResult.reaped).toBe(true);
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
  test("requires the genuine boundary row before materialization", async () => {
    const bad = mutatedPacket(value => {
      value["files"] = (value["files"] as { path: string }[]).filter(row => row.path !== C.BOUNDARY_PATH);
      value["aggregateBytes"] = Number(value["aggregateBytes"]) - sources.get(C.BOUNDARY_PATH)!.length;
    });
    const table = packet.table.filter(row => row.path !== C.BOUNDARY_PATH), { result } = await execute("missing-boundary", "success", {}, response(bad.bytes), { ...pins, ...bad.pin, fileTable: table });
    expect(result.failure).toBe("genuine-launch-boundary-sha256"); expect(fs.readdirSync(result.snapshot)).toEqual([]); expect(result.stageB).toBe(false);
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
  test.each(["nonzero", "oversize", "stderr-cap"])("rejects fake GH %s and never starts caller", async mode => {
    const { result } = await execute(mode, mode); expect(result.failure).not.toBeNull(); expect(result.stageB).toBe(false); expect(result.sealed).toBe(false);
    expect(result.fetchResult!.stdout.length).toBeLessThanOrEqual(C.limits.response); expect(result.fetchResult!.stderr.length).toBeLessThanOrEqual(C.limits.stderr);
  });
  test("kills a noncooperating owned child within local fetch cleanup budget", async () => {
    const { result } = await execute("timeout", "timeout", { fetchMs: 250 });
    expect(result.failure).toContain("github-child:child-deadline"); expect(result.stageB).toBe(false);
    expect(result.fetchResult?.reaped).toBe(true); expect(result.fetchResult?.outEOF).toBe(true); expect(result.fetchResult?.errEOF).toBe(true);
  });
  test("waits for actual exit after complete stdout", async () => {
    const start = process.hrtime.bigint(), { result } = await execute("slow-exit", "slow-exit"); expect(result.failure).toBeNull(); expect(Number(process.hrtime.bigint() - start) / 1e6).toBeGreaterThan(150);
  });
  test("waits for descendant pipe EOF before Stage B", async () => {
    const start = process.hrtime.bigint(), { result } = await execute("pipe-descendant", "pipe-descendant");
    expect(Number(process.hrtime.bigint() - start) / 1e6).toBeGreaterThan(150);
    expect(result.fetchResult?.closed && result.fetchResult.outEOF && result.fetchResult.errEOF).toBe(true);
    if (result.fetchResult?.failure !== null) expect(result.stageB).toBe(false);
  });
  test.each(["cleanup", "interrupt", "clock-after-fetch", "child-finalization-deadline", "file-close", "receipt-close", "directory-close", "finalization-deadline", "seal-deadline"] as const)("keeps %s failure sticky and preserves partials", async fault => {
    const { result } = await execute(fault, "success", { fault }); expect(result.failure).not.toBeNull(); expect(result.stageB).toBe(false); expect(result.claimed).toBe(true);
    expect(fs.existsSync(result.handoff)).toBe(true); expect(fs.existsSync(join(result.handoff, "delivery-outcome.json"))).toBe(true);
    if (["cleanup", "clock-after-fetch", "child-finalization-deadline"].includes(fault)) expect(result.fetchResult?.exitCode).toBe(0);
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
  test("restricts injected subprocess roots to protected fixtures", async () => {
    const f = await fixture("guard"); await expect((await createDeliveryRuntime()).runSynthetic(pins, { ...f.options, fixtureRoot: C.HOSTROOT })).rejects.toThrow("protected-fixture-root-required");
    await expect((await createDeliveryRuntime()).runSynthetic(pins, { ...f.options, fakeGh: "/bin/true" })).rejects.toThrow("fixture-only-fake-gh-required");
  });
  test("exclusive materialization rejects existing regular or symlink files", async () => {
    const f = await fixture("exclusive"); api.writeExclusive(join(f.root, "original.ts"), Buffer.from("original\n"));
    expect(() => api.writeExclusive(join(f.root, "original.ts"), Buffer.from("changed\n"))).toThrow();
    fs.symlinkSync(join(f.root, "original.ts"), join(f.root, "link.ts")); expect(() => api.writeExclusive(join(f.root, "link.ts"), Buffer.from("changed\n"))).toThrow();
    expect(fs.readFileSync(join(f.root, "original.ts"), "utf8")).toBe("original\n");
    await expect(readLiteralText(f.root, "link.ts")).rejects.toThrow(); expect(await readLiteralText(f.root, "original.ts")).toEqual(Buffer.from("original\n"));
  });
});

describe("inline renderer and fixed tool contracts", () => {
  test("embeds self-contained builtin-only implementation in nonrunning Fish syntax fixture", async () => {
    const rendered = await renderDelivery(pins, "OFFLINE_SYNTHETIC_NONRUNNING");
    expect(rendered.inline).toContain(C.APPROVAL_SHA); expect(rendered.inline).toContain(C.BOUNDARY_SHA);
    expect(rendered.body).toContain("MISE_AUTO_INSTALL false"); expect(rendered.body).toContain("MISE_TASK_RUN_AUTO_INSTALL false");
    expect(rendered.body).toContain("MISE_EXEC_AUTO_INSTALL false"); expect(rendered.body).toContain("core:bun@1.4.0");
    expect(rendered.body).not.toContain("/usr/local/bin/bun"); expect(rendered.body).not.toContain("date "); expect(rendered.runnableOperatorCommand).toBe(false);
    expect(rendered.body.split("\n")[1]).toBe("exit 1");
    const imports = [...rendered.inline.matchAll(/import\("([^"]+)"\)/g)].map(row => row[1]); expect(imports).toEqual(["node:fs", "node:path", "node:crypto", "node:child_process"]);
  });
  test("refuses production rendering and statically gates bootstrap before any claim or tool invocation", async () => {
    await expect(renderDelivery(pins, "PUBLISHED_OPERATOR_ONLY")).rejects.toThrow("PRODUCTION_DELIVERY_BLOCKED");
    const production = api.runProduction.toString(); expect(production).toContain("PRODUCTION_DELIVERY_BLOCKED");
    expect(production.indexOf("blockers.length === 0")).toBeLessThan(production.indexOf("return run(pins)"));
  });
  test("fixes one GitHub endpoint and excludes unsafe parent environment", () => {
    const args = api.ghArgs("a".repeat(40)); expect(args).toEqual(["api", "--hostname", "github.com", "--method", "GET", "-H", "Accept: application/vnd.github+json", "repos/proveo-ca/chess-coach/git/blobs/" + "a".repeat(40)]);
    expect(() => api.ghArgs("https://example.com")).toThrow();
    const env = api.ghEnvironment({ PATH: "/usr/bin:/bin", HOME: "/home/executor", GH_CONFIG_DIR: "/home/executor/.config/gh", GH_TOKEN: "forbidden", GH_DEBUG: "api", GH_HOST: "evil", NODE_OPTIONS: "forbidden", HTTPS_PROXY: "forbidden", npm_config_userconfig: "forbidden" });
    expect(env["GH_CONFIG_DIR"]).toBe("/home/executor/.config/gh"); expect(env["GH_HOST"]).toBe("github.com");
    for (const key of ["GH_TOKEN", "GH_DEBUG", "NODE_OPTIONS", "HTTPS_PROXY", "npm_config_userconfig"]) expect(env[key]).toBeUndefined();
  });
});
