// SPEC: _spec/runtime-protocol.puml
import { afterAll, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { projectHostPlan } from "../../campaign-handoff-1/render-command";
import { accessPlan, ANCESTORS, CONTEXT_PATHS, inspect, metadataIO, VOLUME } from "./preflight";
import type { AccessPlan, MetadataIO, Node } from "./preflight";
import { renderHostCommand } from "./render-command";
import { repositoryScratch } from "../../../../packages/runtime/tests/repository-scratch";

const rawSpawnSync = Bun.spawnSync.bind(Bun), spawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_PROCESS"); });
const spawnSync = spyOn(Bun, "spawnSync").mockImplementation(() => { throw new Error("FORBIDDEN_PROCESS"); });
const network = spyOn(globalThis, "fetch").mockImplementation(Object.assign(() => { throw new Error("FORBIDDEN_NETWORK"); }, { preconnect() {} }));
afterAll(() => { spawn.mockRestore(); spawnSync.mockRestore(); network.mockRestore(); });
const plan = accessPlan(), encode = (value: string) => Buffer.from(value);
const node = (kind: Node["kind"] = "directory"): Node => ({ kind, mode: 0o755, uid: "1000", gid: "1000", bytes: "4096" });
function failure(code: string) { return Object.assign(new Error(code), { code }); }
function fixture() {
  const calls: { method: string; path: string; mode?: string }[] = [], errors = new Map<string, string>(), nodes = new Map<string, Node>(); let time = 0;
  for (const path of ANCESTORS) nodes.set(path, node());
  for (const target of plan.retained) nodes.set(target.path, node(target.kind === "directory" ? "directory" : "file"));
  const io: MetadataIO = { now: () => time, alarm: () => () => {}, identity: () => ({ uid: 1000, euid: 1000, gid: 1000, egid: 1000, groups: [1000] }),
    lstat: async path => { calls.push({ method: "lstat", path }); if (errors.has(path)) throw failure(errors.get(path)!); const value = nodes.get(path); if (!value) throw failure("ENOENT"); return value; },
    realpath: async path => { calls.push({ method: "realpath", path }); return path; },
    access: async (path, mode) => { calls.push({ method: "access", path, mode }); if (errors.has(`${path}:${mode}`)) throw failure(errors.get(`${path}:${mode}`)!); },
    context: async path => { calls.push({ method: "context", path }); return encode(path.endsWith("enforce") ? "1\n" : "unconfined_u:unconfined_r:unconfined_t:s0\n"); },
    labels: async paths => { calls.push({ method: "labels", path: paths.join(",") }); return { exitCode: 0, stdout: encode("observed labels\n"), stderr: encode("") }; } };
  return { io, calls, nodes, errors, setTime: (value: number) => { time = value; } };
}
test("frozen access plan exactly projects packet2 targets and binds its completion without mutating them", () => {
  const requestBytes = readFileSync(new URL("../../full-training-packet-2/request.json", import.meta.url)), request = JSON.parse(requestBytes.toString());
  const { inspection, completionSha256, ...base } = plan;
  expect(base).toEqual(projectHostPlan(request.plan, createHash("sha256").update(requestBytes).digest("hex")));
  expect(inspection).toBe("READ_ONLY_ACCESS_METADATA_V1");
  expect(completionSha256).toBe(createHash("sha256").update(readFileSync(new URL("../../full-training-packet-2/completion.json", import.meta.url))).digest("hex"));
  expect(JSON.stringify(plan)).not.toContain("/mnt/training");
});
test("MOCK observation remains caller-only, read-only and separate from container readiness or capacity", async () => {
  const env = fixture(), report = await inspect(env.io, plan); expect(report.status).toBe("PASS_METADATA_PRECONDITIONS"); expect(report.failures).toEqual([]);
  expect(report.identity).toEqual({ uid: 1000, euid: 1000, gid: 1000, egid: 1000, groups: [1000] });
  expect(report.freshRoots.map(row => row.observation)).toEqual(["ABSENT", "ABSENT", "ABSENT"]);
  expect(report).toMatchObject({ capacityQueried: false, writeProbeExecuted: false, retainedPayloadContentsRead: false, retainedNativeToolsExecuted: false,
    directoryContentsListed: false, futureContainerAccessVerified: false, preparationExecuted: false, permissionOrSelinuxChangesExecuted: false,
    nativeGpuDockerCommandsExecuted: false, trainingExecuted: false, trainingExecutionAuthorized: false });
  expect(report.selinux.compatibilityVerified).toBe(false); expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThan(32768);
  expect(env.calls.filter(row => row.method === "labels")).toHaveLength(1);
});
test("proposed roots distinguish ENOENT from permission errors and existing directories", async () => {
  for (const code of ["EACCES", "EPERM", "ENOTDIR", "EIO"]) {
    const env = fixture(); env.errors.set(plan.freshRoots[0]!, code);
    const report = await inspect(env.io, plan); expect(report.freshRoots[0]).toMatchObject({ observation: "UNKNOWN", error: code });
    expect(report.status).toBe("BLOCKED_METADATA_PRECONDITIONS");
  }
  const env = fixture(); env.nodes.set(plan.freshRoots[0]!, node());
  expect((await inspect(env.io, plan)).freshRoots[0]!.observation).toBe("EXISTS");
});
test("reported root-owned 0644 metadata never substitutes for caller search access", async () => {
  const env = fixture(); env.nodes.set(VOLUME, { ...node(), mode: 0o644, uid: "0", gid: "0" }); env.errors.set(`${VOLUME}:execute`, "EACCES");
  const report = await inspect(env.io, plan); expect(report.ancestors.at(-1)!.metadata.value).toMatchObject({ mode: 0o644, uid: "0", gid: "0" });
  expect(report.volumeAccess.search).toEqual({ allowed: false, error: "EACCES" }); expect(report.status).toBe("BLOCKED_METADATA_PRECONDITIONS");
  expect(env.calls.filter(row => row.method === "access" && row.path === VOLUME).map(row => row.mode)).toEqual(["execute", "read", "write", "execute"]);
});
test("ancestor links, incorrect kinds, unknown access and missing retained tools remain blocking observations", async () => {
  const env = fixture(); env.nodes.set("/var/lib", node("symlink")); env.io.realpath = async path => path === "/var/lib" ? "/different" : path;
  env.errors.set(`${VOLUME}:write`, "EIO"); env.nodes.delete(plan.cachedBun);
  const report = await inspect(env.io, plan); expect(report.ancestors[2]!.metadata.value!.kind).toBe("symlink");
  expect(report.volumeAccess.write.allowed).toBeNull(); expect(report.retained.find(row => row.path === plan.cachedBun)!.metadata.error).toBe("ENOENT");
  expect(report.failures).toContain("ANCESTOR_SEARCH_UNKNOWN_OR_DENIED"); expect(report.failures).toContain("RETAINED_METADATA_OR_CALLER_ACCESS_UNVERIFIED");
});
test("malformed frozen allowlists reject before all metadata operations", async () => {
  for (const mutation of [{ runsParent: "/mnt/training" }, { freshRoots: ["/etc"] }, { requestSha256: "0".repeat(64) },
    { completionSha256: "0".repeat(64) }, { retained: [{ path: "/etc/shadow", kind: "executable" }] }, { inspection: "REPAIR" }]) {
    const env = fixture(); await expect(inspect(env.io, { ...plan, ...mutation } as AccessPlan)).rejects.toThrow("FROZEN_ACCESS_ALLOWLIST"); expect(env.calls).toEqual([]);
  }
});
test("metadata errors remain bounded codes rather than exception text or fabricated observations", async () => {
  const env = fixture(); env.io.lstat = async () => { throw new Error("arbitrary private exception text".repeat(2000)); };
  const report = await inspect(env.io, plan); expect(report.ancestors.every(row => row.metadata.error === "METADATA_ERROR")).toBe(true);
  expect(report.freshRoots.every(row => row.observation === "UNKNOWN")).toBe(true); expect(JSON.stringify(report)).not.toContain("private exception");
});
test("missing SELinux facilities stay unknown and do not become compatibility proof", async () => {
  const env = fixture(); env.io.context = async () => { throw failure("ENOENT"); }; env.io.labels = async () => { throw failure("ENOENT"); };
  const report = await inspect(env.io, plan); expect(report.selinux.context.every(row => row.value === null && row.error === "ENOENT")).toBe(true);
  expect(report.selinux.labels).toEqual({ value: null, error: "ENOENT" }); expect(report.selinux.compatibilityVerified).toBe(false);
});
test("SELinux reads and label output reject oversized or invalid bytes without parsing payloads", async () => {
  for (const bytes of [new Uint8Array(1025), Uint8Array.from([0xc0, 0xaf])]) {
    const env = fixture(); env.io.context = async () => bytes; env.io.labels = async () => ({ exitCode: 0, stdout: new Uint8Array(8193), stderr: encode("") });
    const report = await inspect(env.io, plan); expect(report.selinux.context.every(row => row.value === null && row.error !== null)).toBe(true);
    expect(report.selinux.labels.error).toBe("LABEL_RESULT_BOUND");
  }
});
test("metadata deadline does not renew or start later operations", async () => {
  const env = fixture(); env.io.lstat = async () => { env.calls.push({ method: "first", path: "/" }); env.setTime(30001); return node(); };
  const report = await inspect(env.io, plan); expect(report.status).toBe("BLOCKED_METADATA_PRECONDITIONS");
  expect(env.calls).toEqual([{ method: "first", path: "/" }]); expect(report.ancestors[0]!.metadata.error).toBe("METADATA_DEADLINE");
});
test("an observation timeout remains unknown with one cancellation and no operation retry", async () => {
  const env = fixture(); let cancelled = 0, fired = false;
  env.io.lstat = path => { if (path !== "/") return Promise.resolve(node()); return new Promise(() => {}); };
  env.io.alarm = (_ms, fire) => { if (!fired) { fired = true; queueMicrotask(fire); } return () => { cancelled++; }; };
  const report = await inspect(env.io, plan); expect(report.ancestors[0]!.metadata.error).toBe("METADATA_TIMEOUT"); expect(cancelled).toBeGreaterThan(0);
});
test("transpiled embedded source imports only builtin modules and remains inert under process/network denial", async () => {
  const source = readFileSync(new URL("./preflight.ts", import.meta.url)), js = new Bun.Transpiler({ loader: "ts" }).transformSync(source);
  expect(source.byteLength).toBeLessThanOrEqual(16384); expect(new Bun.Transpiler({ loader: "js" }).scanImports(js).every(row => row.path.startsWith("node:"))).toBe(true);
  const embedded = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64")), env = fixture();
  expect((await embedded.inspect(env.io, plan)).status).toBe("PASS_METADATA_PRECONDITIONS");
  expect(spawn).not.toHaveBeenCalled(); expect(spawnSync).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled();
  expect(source.toString()).not.toMatch(/statfs|readdir|writeFile|mkdir|unlink|chmod|chown|setenforce|chcon|fetch\(/);
});
test("production adapters reject every path outside their fixed read-only target sets", async () => {
  const io = metadataIO(); await expect(io.lstat("/etc/shadow")).rejects.toThrow("METADATA_TARGET");
  await expect(io.access("/tmp", "write")).rejects.toThrow("METADATA_TARGET"); await expect(io.realpath(plan.cachedBun)).rejects.toThrow("ANCESTOR_TARGET");
  await expect(io.context(plan.cachedBun)).rejects.toThrow("CONTEXT_TARGET"); await expect(io.labels(["/etc/shadow"])).rejects.toThrow("METADATA_TARGET");
  expect(spawnSync).not.toHaveBeenCalled();
});
test("the sole production subprocess has fixed ls metadata argv, environment, output and time bounds", async () => {
  const result = { exitCode: 0, signalCode: null, stdout: encode("label\n"), stderr: encode("") } as unknown as ReturnType<typeof Bun.spawnSync>;
  spawnSync.mockImplementation(((argv: any, options: any) => {
    expect(argv).toEqual(["/usr/bin/ls", "-Zd", "--", VOLUME]); expect(options.timeout).toBe(1000); expect(options.maxBuffer).toBe(8192);
    expect(options.env).toEqual({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", TERM: "dumb" }); return result;
  }) as unknown as typeof Bun.spawnSync);
  try { expect(await metadataIO().labels([VOLUME])).toMatchObject({ exitCode: 0, stdout: encode("label\n") }); }
  finally { spawnSync.mockImplementation(() => { throw new Error("FORBIDDEN_PROCESS"); }); spawnSync.mockClear(); }
});
test("label target lists never include unobserved missing paths", async () => {
  const env = fixture(); env.nodes.delete(plan.cachedBun); const report = await inspect(env.io, plan), argv = report.selinux.labels.value!.argv;
  expect(argv.slice(0, 3)).toEqual(["/usr/bin/ls", "-Zd", "--"]); expect(argv).not.toContain(plan.cachedBun); expect(plan.freshRoots.every(path => !argv.includes(path))).toBe(true);
  expect(CONTEXT_PATHS).toEqual(["/sys/fs/selinux/enforce", "/proc/self/attr/current"]);
});
test("rendered delivery checks compressed and decoded hashes before import and passes shell syntax", () => {
  const source = readFileSync(new URL("./preflight.ts", import.meta.url)), command = renderHostCommand(source, plan, "a".repeat(40));
  expect(command.indexOf("TRANSPORT_HASH")).toBeLessThan(command.indexOf("await import")); expect(command.indexOf("SOURCE_PLAN_HASH")).toBeLessThan(command.indexOf("await import"));
  expect(command).toContain(plan.cachedBun); const syntax = rawSpawnSync(["bash", "--noprofile", "--norc", "-n"], { stdin: encode(command), stdout: "pipe", stderr: "pipe" }); expect(syntax.exitCode).toBe(0);
});
test("corrupted delivery stops at transport authentication before evaluating embedded HOST metadata", () => {
  const source = readFileSync(new URL("./preflight.ts", import.meta.url)), packed = Buffer.from(Bun.gzipSync(source)).toString("base64");
  const command = renderHostCommand(source, { ...plan, cachedBun: process.execPath }, "a".repeat(40));
  const result = rawSpawnSync(["bash", "--noprofile", "--norc", "-c", command.replace(packed, packed.slice(0, -4) + "AAAA")],
    { cwd: repositoryScratch("access-transport-"), env: { PATH: "/usr/local/bin:/usr/bin:/bin" }, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 5000 });
  expect(result.exitCode).not.toBe(0); expect(Buffer.from(result.stderr).toString()).toContain("TRANSPORT_HASH");
});
