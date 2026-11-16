// SPEC: _spec/runtime-protocol.puml
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fixtureCacheParentIO } from "./cache-parent-adapter.ts";
import { prepareFixedCacheParent, FIXED_CACHE_PARENT, FIXED_CONTAINER, FIXED_ANCESTORS } from "./cache-parent.ts";
import type { CacheParentIO, DirectoryIdentity } from "./cache-parent.ts";
import { HOSTROOT, S2 } from "./root-context.ts";

const adapter = readFileSync(new URL("./cache-parent-adapter.ts", import.meta.url), "utf8");
for (const forbidden of ["readdir", "chmod", "unlink", "rmSync", "recursive: true", "process.env", "fetch(", "spawn("]) {
  test(`fixed parent adapter excludes ${forbidden}`, () => assert.equal(adapter.includes(forbidden), false));
}
test("fixed parent adapter requires owned capability before its first filesystem read", () => {
  const start = adapter.indexOf("export async function prepareClaimedCacheParent");
  assert.ok(start > 0);
  assert.ok(adapter.indexOf("if (!state || state.deadline !== deadline)", start) < adapter.indexOf("fs.lstatSync", start));
  assert.ok(adapter.indexOf("assertClaimedContext(deadline);", start) < adapter.indexOf("fs.lstatSync", start));
  for (const expected of ["current.dev !== state.dev", "current.ino !== state.ino", "marker[\"combinedAttemptsConsumed\"] !== 1", "marker[\"remainingCombinedAttempts\"] !== 0", "claims.delete(capability)", "fs.constants.O_NOFOLLOW"]) assert.ok(adapter.includes(expected), expected);
});
test("isolated fixed parent implementation remains byte immutable", () => {
  const digest = createHash("sha256").update(readFileSync(new URL("./cache-parent.ts", import.meta.url))).digest("hex");
  assert.equal(digest, "62db5298937cf1c752a76b39f42fa19876e36e637d9d21dba6de323de347b27c");
});
function scenario(failAt = Infinity, existing = false) {
  const base = join(HOSTROOT, S2, "fullverification-999/fixtures/adapter_case"), deadline = { assertActive: () => { if (expired) throw Error("absolute-deadline"); } };
  let claimed = true, expired = false, serial = 0;
  const directory = (ino: number): DirectoryIdentity => ({ kind: "directory", dev: 1n, ino: BigInt(ino) });
  const nodes = new Map<string, DirectoryIdentity>(FIXED_ANCESTORS.map((path, index) => [path, directory(index + 1)]));
  if (existing) nodes.set(FIXED_CACHE_PARENT, directory(999));
  const trace: string[] = [], handles = new Map<number, DirectoryIdentity>(), closes: number[] = [];
  const event = (name: string): void => { trace.push(name); if (trace.length === failAt) throw Error("injected-adapter-fault"); };
  const backend: Omit<CacheParentIO, "assertClaimedContext"> = {
    lstat: path => { event(`lstat:${path}`); const value = nodes.get(path); if (!value) throw Object.assign(Error("absent"), { code: "ENOENT" }); return value; },
    mkdirCacheParent: (path, options) => { event("mkdir"); assert.deepEqual(options, { mode: 0o700, recursive: false }); nodes.set(path, directory(1000)); },
    openDirectory: path => { event(`open:${path}`); const fd = ++serial; handles.set(fd, nodes.get(path)!); return fd; },
    fstat: fd => { event("fstat"); return handles.get(fd)!; },
    fsync: () => { event("fsync"); },
    close: fd => { closes.push(fd); handles.delete(fd); event("close"); }
  };
  const io = fixtureCacheParentIO({ readRoot: HOSTROOT, operationRoot: base, observerRoot: join(base, "observer") }, backend, deadline, () => { if (!claimed) throw Error("unclaimed"); });
  return { io, deadline, nodes, trace, handles, closes, expire: () => { expired = true; }, unclaim: () => { claimed = false; } };
}
test("fixture adapter rejects missing claim before backend access", async () => {
  const s = scenario(); s.unclaim(); await assert.rejects(prepareFixedCacheParent(s.io, s.deadline), error => error instanceof AggregateError && error.errors.every((value: unknown) => value instanceof Error && value.message === "unclaimed")); assert.deepEqual(s.trace, []);
});
test("fixture adapter preserves a validated existing directory", async () => {
  const s = scenario(Infinity, true), before = s.nodes.get(FIXED_CACHE_PARENT);
  assert.equal(await prepareFixedCacheParent(s.io, s.deadline), "EXISTING_DIRECTORY");
  assert.equal(s.nodes.get(FIXED_CACHE_PARENT), before); assert.equal(s.trace.includes("mkdir"), false); assert.equal(s.handles.size, 0);
});
test("fixture adapter creates only fixed leaf and syncs both owned directories", async () => {
  const s = scenario(); assert.equal(await prepareFixedCacheParent(s.io, s.deadline), "CREATED");
  assert.equal(s.trace.filter(value => value === "mkdir").length, 1); assert.equal(s.trace.filter(value => value === "fsync").length, 2);
  assert.ok(s.trace.includes(`open:${FIXED_CONTAINER}`)); assert.equal(s.handles.size, 0); assert.equal(s.closes.length, 2);
});
for (let index = 1; index <= 19; index++) test(`fixture adapter fault ${index} preserves partials and attempts every acquired close`, async () => {
  const s = scenario(index); await assert.rejects(prepareFixedCacheParent(s.io, s.deadline)); assert.equal(s.handles.size, 0);
});
test("fixture adapter does not recover from an expired original deadline", async () => {
  const s = scenario(); s.expire(); await assert.rejects(prepareFixedCacheParent(s.io, s.deadline), error => error instanceof AggregateError && error.errors.every((value: unknown) => value instanceof Error && value.message === "absolute-deadline")); assert.deepEqual(s.trace, []);
});
