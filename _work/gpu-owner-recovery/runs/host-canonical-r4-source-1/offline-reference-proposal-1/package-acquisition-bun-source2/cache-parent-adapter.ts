// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { join, relative, resolve } from "node:path";
import { prepareFixedCacheParent } from "./cache-parent.ts";
import type { CacheParentIO, DirectoryIdentity, ExistingLocalDeadline } from "./cache-parent.ts";
import { HOSTROOT, S2, R2, assertProductionContext } from "./root-context.ts";
import type { RootContext } from "./root-context.ts";

type Claim = Readonly<{ attemptId: string; supervisorPid: number; origin: number; workDeadline: number; operationDeadline: number }>;
type Capability = Readonly<{ marker: Claim }>;
const claims = new WeakMap<Capability, { context: RootContext; deadline: ExistingLocalDeadline; dev: bigint; ino: bigint }>();
type Backend = Omit<CacheParentIO, "assertClaimedContext">;
function claimBoundIO(assertOwner: () => void, deadline: ExistingLocalDeadline, backend: Backend): CacheParentIO {
  const handles = new Set<number>();
  const assertClaimedContext = (supplied: ExistingLocalDeadline): void => { assertOwner(); if (supplied !== deadline) throw new Error("claim-deadline-substitution"); deadline.assertActive(); };
  return {
    assertClaimedContext,
    lstat: path => { assertClaimedContext(deadline); return backend.lstat(path); },
    mkdirCacheParent: (path, options) => { assertClaimedContext(deadline); backend.mkdirCacheParent(path, options); },
    openDirectory: (path, flags) => { assertClaimedContext(deadline); const fd = backend.openDirectory(path, flags); handles.add(fd); return fd; },
    fstat: fd => { assertClaimedContext(deadline); if (!handles.has(fd)) throw new Error("unowned-descriptor"); return backend.fstat(fd); },
    fsync: fd => { assertClaimedContext(deadline); if (!handles.has(fd)) throw new Error("unowned-descriptor"); backend.fsync(fd); },
    close: fd => { assertOwner(); if (!handles.delete(fd)) throw new Error("unowned-descriptor"); backend.close(fd); }
  };
}
export function fixtureCacheParentIO(context: RootContext, backend: Backend, deadline: ExistingLocalDeadline, assertClaim: () => void): CacheParentIO {
  const local = relative(join(HOSTROOT, S2), resolve(context.operationRoot));
  if (!/^fullverification-[1-9][0-9]*\/fixtures\/[a-zA-Z0-9_-]+$/.test(local) || context.readRoot !== HOSTROOT || context.observerRoot !== join(context.operationRoot, "observer")) throw new Error("cache-adapter-fixture-context-required");
  return claimBoundIO(assertClaim, deadline, backend);
}
function identity(stat: fs.BigIntStats): DirectoryIdentity {
  return { kind: stat.isSymbolicLink() ? "symlink" : stat.isDirectory() ? "directory" : "other", dev: stat.dev, ino: stat.ino };
}
export function bindExclusiveCacheClaim(context: RootContext, marker: Claim, deadline: ExistingLocalDeadline, expected: fs.BigIntStats): Capability {
  assertProductionContext(context); deadline.assertActive();
  if (!expected.isDirectory() || expected.isSymbolicLink() || marker.supervisorPid !== process.pid || marker.workDeadline !== marker.origin + 108000 || marker.operationDeadline !== marker.origin + 120000) throw new Error("new-exclusive-claim-required");
  const capability = Object.freeze({ marker: Object.freeze({ ...marker }) });
  claims.set(capability, { context, deadline, dev: expected.dev, ino: expected.ino });
  return capability;
}
export async function prepareClaimedCacheParent(capability: Capability, deadline: ExistingLocalDeadline): Promise<"CREATED" | "EXISTING_DIRECTORY"> {
  const state = claims.get(capability);
  if (!state || state.deadline !== deadline) throw new Error("new-exclusive-claim-capability-required");
  const assertClaimedContext = (supplied: ExistingLocalDeadline): void => {
    if (supplied !== deadline || claims.get(capability) !== state) throw new Error("new-exclusive-claim-capability-required");
    assertProductionContext(state.context); deadline.assertActive();
  };
  assertClaimedContext(deadline);
  const path = join(state.context.operationRoot, R2, "acquisition-execution-1");
  const current = fs.lstatSync(path, { bigint: true });
  if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== state.dev || current.ino !== state.ino) throw new Error("exclusive-claim-identity-drift");
  const fd = fs.openSync(join(path, "attempt.json"), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 4096) throw new Error("exclusive-marker-bound");
    const bytes = Buffer.alloc(stat.size + 1), n = fs.readSync(fd, bytes, 0, bytes.length, 0);
    if (n !== stat.size) throw new Error("exclusive-marker-drift");
    const marker = JSON.parse(bytes.subarray(0, n).toString("utf8")) as Record<string, unknown>;
    if (marker["grantId"] !== "reference-two-package-source-acquisition-2" || marker["combinedAttemptsConsumed"] !== 1 || marker["remainingCombinedAttempts"] !== 0 || !Object.entries(capability.marker).every(([key, value]) => marker[key] === value)) throw new Error("exclusive-marker-binding");
  } finally { fs.closeSync(fd); }
  const assertOwner = (): void => {
    if (claims.get(capability) !== state) throw new Error("new-exclusive-claim-capability-required");
    assertProductionContext(state.context);
  };
  const io = claimBoundIO(assertOwner, deadline, {
    lstat: path => identity(fs.lstatSync(path, { bigint: true })),
    mkdirCacheParent: (path, options) => { fs.mkdirSync(path, options); },
    openDirectory: (path, flags) => fs.openSync(path, flags),
    fstat: fd => identity(fs.fstatSync(fd, { bigint: true })),
    fsync: fd => { fs.fsyncSync(fd); }, close: fd => { fs.closeSync(fd); }
  });
  try { return await prepareFixedCacheParent(io, deadline); }
  finally { claims.delete(capability); }
}
