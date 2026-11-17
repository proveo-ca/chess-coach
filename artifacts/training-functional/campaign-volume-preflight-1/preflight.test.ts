// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inspect, metadataIO, HOST_VOLUME } from "./preflight";
import type { Counters, MetadataIO } from "./preflight";
import type { FrozenPlan } from "../campaign-handoff-1/preflight";
import { renderHostCommand } from "../campaign-handoff-1/render-command";
import { repositoryScratch } from "../../../packages/runtime/tests/repository-scratch";

const plan = JSON.parse(readFileSync(new URL("../campaign-handoff-1/handoff.json", import.meta.url), "utf8")).plan as FrozenPlan;
function fixture() {
  const calls: string[] = [];
  const counters: Counters = { type: 0xef53n, bsize: 4096n, bavail: BigInt(plan.minimumUsableBytes) / 4096n, files: 1000000n, ffree: BigInt(plan.minimumFreeEntries) };
  const io: MetadataIO = { now: () => 0, alarm: () => () => {},
    lstat: async path => { calls.push(`lstat:${path}`); expect(path).toBe(HOST_VOLUME); return { kind: "directory", mode: 0o700, uid: "1000", gid: "1000" }; },
    statfs: async path => { calls.push(`statfs:${path}`); expect(path).toBe(HOST_VOLUME); return counters; } };
  return { io, calls, counters };
}
test("exact thresholds pass only the fixed HOST path metadata", async () => {
  const env = fixture(), report = await inspect(env.io, plan);
  expect(report.status).toBe("PASS_METADATA_PRECONDITIONS"); expect(report.capacity.bytesSufficient).toBe(true); expect(report.capacity.entriesSufficient).toBe(true);
  expect(report.hostPath).toBe(HOST_VOLUME); expect(env.calls).toEqual([`lstat:${HOST_VOLUME}`, `statfs:${HOST_VOLUME}`]);
  expect(report).toMatchObject({ directoryUsabilityVerified: false, selinuxCompatibilityVerified: false, quotaVerified: false, reservationCreated: false,
    preparationExecuted: false, campaignRootsRelocated: false, nativeGpuDockerCommandsExecuted: false, trainingExecuted: false, trainingExecutionAuthorized: false });
  expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThan(8192);
});
test("old plan paths and sandbox targets cannot redirect the HOST probe", async () => {
  const env = fixture(); await inspect(env.io, { ...plan, runsParent: "/mnt/training", freshRoots: [], retained: [] });
  expect(env.calls.every(call => call.endsWith(HOST_VOLUME))).toBe(true);
});
test("insufficient bytes and entries remain distinct false comparisons", async () => {
  const env = fixture(); env.counters.bavail = 1n; env.counters.ffree = 1n;
  const report = await inspect(env.io, plan); expect(report.status).toBe("BLOCKED_METADATA_PRECONDITIONS");
  expect(report.failures).toEqual(["USABLE_BYTES_INSUFFICIENT", "FREE_ENTRIES_INSUFFICIENT"]);
  expect(report.capacity.bytesSufficient).toBe(false); expect(report.capacity.entriesSufficient).toBe(false);
});
test("unsupported zero/zero inode accounting stays unknown with raw counters retained", async () => {
  const env = fixture(); env.counters.files = 0n; env.counters.ffree = 0n;
  const report = await inspect(env.io, plan); expect(report.capacity.raw).toMatchObject({ files: "0", ffree: "0" });
  expect(report.capacity.freeEntries).toBeNull(); expect(report.capacity.entriesSufficient).toBeNull(); expect(report.failures).toEqual(["FREE_ENTRIES_UNKNOWN"]);
});
test("exposed zero free entries with a nonzero total means insufficient rather than unknown", async () => {
  const env = fixture(); env.counters.ffree = 0n;
  const report = await inspect(env.io, plan); expect(report.capacity.freeEntries).toBe("0"); expect(report.capacity.entriesSufficient).toBe(false);
});
test("negative filesystem counters stay raw and do not become capacity", async () => {
  const env = fixture(); env.counters.bavail = -1n; env.counters.ffree = -1n;
  const report = await inspect(env.io, plan); expect(report.capacity.usableBytes).toBeNull(); expect(report.capacity.freeEntries).toBeNull();
  expect(report.capacity.raw).toMatchObject({ bavail: "-1", ffree: "-1" }); expect(report.failures).toEqual(["USABLE_BYTES_UNKNOWN", "FREE_ENTRIES_UNKNOWN"]);
});
test("large counters use exact integer arithmetic and serialize losslessly", async () => {
  const env = fixture(); env.counters.bavail = 9007199254740993n; env.counters.ffree = 9007199254740993n;
  const report = await inspect(env.io, plan); expect(report.capacity.usableBytes).toBe(String(9007199254740993n * 4096n));
  expect(report.capacity.freeEntries).toBe("9007199254740993");
});
test("missing or inaccessible path stops before statfs", async () => {
  for (const code of ["ENOENT", "EACCES"]) {
    const env = fixture(); env.io.lstat = async () => { throw Object.assign(new Error(code), { code }); };
    const report = await inspect(env.io, plan); expect(report.status).toBe("BLOCKED_METADATA_PRECONDITIONS"); expect(report.pathMetadata.error).toBe(code);
    expect(env.calls).toEqual([]); expect(report.capacity.raw).toBeNull();
  }
});
test("symlink and non-directory leaves never receive statfs", async () => {
  for (const kind of ["symlink", "file", "other"] as const) {
    const env = fixture(); env.io.lstat = async () => ({ kind, mode: 0o755, uid: "1000", gid: "1000" });
    const report = await inspect(env.io, plan); expect(report.failures).toEqual(["VOLUME_PATH_NOT_DIRECTORY"]); expect(env.calls).toEqual([]);
  }
});
test("directory mode remains an observation rather than an effective-access proof", async () => {
  const env = fixture(); env.io.lstat = async () => ({ kind: "directory", mode: 0o644, uid: "0", gid: "0" });
  const report = await inspect(env.io, plan); expect(report.pathMetadata.observed?.mode).toBe(0o644);
  expect(report.directoryUsabilityVerified).toBe(false); expect(report.selinuxCompatibilityVerified).toBe(false);
});
test("statfs permission errors return unknown capacity rather than success", async () => {
  const env = fixture(); env.io.statfs = async () => { throw Object.assign(new Error("DENIED"), { code: "EACCES" }); };
  const report = await inspect(env.io, plan); expect(report.failures).toEqual(["CAPACITY_UNKNOWN"]); expect(report.capacity.error).toBe("EACCES");
  expect(report.capacity.bytesSufficient).toBeNull(); expect(report.capacity.entriesSufficient).toBeNull();
});
test("observation timeout returns a blocked report without retry", async () => {
  const env = fixture(); let cancelCount = 0;
  env.io.lstat = () => new Promise(() => {}); env.io.alarm = (_ms, callback) => { queueMicrotask(callback); return () => { cancelCount++; }; };
  const report = await inspect(env.io, plan); expect(report.pathMetadata.error).toBe("METADATA_TIMEOUT"); expect(report.status).toBe("BLOCKED_METADATA_PRECONDITIONS");
  expect(env.calls).toEqual([]); expect(cancelCount).toBe(1);
});
test("malformed context and clock fail before metadata IO", async () => {
  const env = fixture(); await expect(inspect(env.io, { ...plan, minimumFreeEntries: "1" })).rejects.toThrow("FROZEN_BUDGET_CONTEXT");
  env.io.now = () => NaN; await expect(inspect(env.io, plan)).rejects.toThrow("CLOCK"); expect(env.calls).toEqual([]);
});
test("payload imports are inert and production adapter reads only metadata on local fixtures", async () => {
  const source = readFileSync(new URL("./preflight.ts", import.meta.url), "utf8");
  expect(source).not.toMatch(/Bun\.spawn|spawnSync|fetch\(|readFile|openSync|mkdir|writeFile|readdir|unlink|chcon|setenforce/);
  const js = new Bun.Transpiler({ loader: "ts" }).transformSync(source), payload = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
  const env = fixture(); expect((await payload.inspect(env.io, plan)).status).toBe("PASS_METADATA_PRECONDITIONS");
  const io = metadataIO(), path = repositoryScratch("volume-metadata-api-"), node = await io.lstat(path), value = await io.statfs(path);
  expect(node.kind).toBe("directory"); expect(typeof value.bavail).toBe("bigint");
});
test("the retained renderer carries the new source with old budget context without executing HOST metadata locally", () => {
  const source = readFileSync(new URL("./preflight.ts", import.meta.url));
  const command = renderHostCommand(source, plan, "a".repeat(40)), syntax = Bun.spawnSync(["bash", "--noprofile", "--norc", "-n"], { stdin: Buffer.from(command), stdout: "pipe", stderr: "pipe" });
  expect(syntax.exitCode).toBe(0); expect(command).toContain(plan.cachedBun); expect(command).toContain("TRANSPORT_HASH"); expect(command).toContain("SOURCE_PLAN_HASH");
});
test("corrupting this payload fails at the reused transport check before import", () => {
  const source = readFileSync(new URL("./preflight.ts", import.meta.url)), packed = Buffer.from(Bun.gzipSync(source)).toString("base64");
  const command = renderHostCommand(source, { ...plan, cachedBun: process.execPath }, "a".repeat(40));
  expect(command).toContain(packed); const result = Bun.spawnSync(["bash", "--noprofile", "--norc", "-c", command.replace(packed, packed.slice(0, -4) + "AAAA")],
    { cwd: repositoryScratch("volume-payload-hash-"), env: { PATH: process.env.PATH }, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 5000 });
  expect(result.exitCode).not.toBe(0); expect(Buffer.from(result.stderr).toString()).toContain("TRANSPORT_HASH");
});
