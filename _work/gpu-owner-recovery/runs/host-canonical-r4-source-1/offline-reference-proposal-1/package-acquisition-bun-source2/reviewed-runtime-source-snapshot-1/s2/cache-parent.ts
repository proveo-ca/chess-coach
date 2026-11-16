// SPEC: _spec/runtime-protocol.puml
import { constants } from "node:fs";

export const ROOT = "/home/gu1lty/Projects/proveo/chess-coach";
export const FIXED_CACHE_PARENT = `${ROOT}/_work/gpu-owner-recovery/cache` as const;
export const FIXED_CONTAINER = `${ROOT}/_work/gpu-owner-recovery` as const;
export const FIXED_ANCESTORS = ["/", "/home", "/home/gu1lty", "/home/gu1lty/Projects", "/home/gu1lty/Projects/proveo", ROOT, `${ROOT}/_work`, FIXED_CONTAINER] as const;
export const DIRECTORY_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
type FixedMetadataPath = typeof FIXED_ANCESTORS[number] | typeof FIXED_CACHE_PARENT;
type FixedDescriptorPath = typeof FIXED_CONTAINER | typeof FIXED_CACHE_PARENT;
export interface DirectoryIdentity { kind: "directory" | "symlink" | "other"; dev: bigint; ino: bigint }
export interface ExistingLocalDeadline { assertActive(): void }
export interface CacheParentIO {
  assertClaimedContext(deadline: ExistingLocalDeadline): void;
  lstat(path: FixedMetadataPath): DirectoryIdentity;
  mkdirCacheParent(path: typeof FIXED_CACHE_PARENT, options: { mode: 0o700; recursive: false }): void;
  openDirectory(path: FixedDescriptorPath, flags: number): number;
  fstat(fd: number): DirectoryIdentity;
  fsync(fd: number): void;
  close(fd: number): void;
}
function requireDirectory(value: DirectoryIdentity): void {
  if (value.kind !== "directory") throw new Error("fixed-parent-not-nonsymlink-directory");
}
function sameDirectory(actual: DirectoryIdentity, expected: DirectoryIdentity): void {
  requireDirectory(actual);
  if (actual.dev !== expected.dev || actual.ino !== expected.ino) throw new Error("fixed-parent-directory-identity-drift");
}
export async function prepareFixedCacheParent(io: CacheParentIO, deadline: ExistingLocalDeadline): Promise<"CREATED" | "EXISTING_DIRECTORY"> {
  const descriptors: number[] = [], failures: unknown[] = [];
  let result: "CREATED" | "EXISTING_DIRECTORY" = "EXISTING_DIRECTORY";
  const check = (): void => { io.assertClaimedContext(deadline); deadline.assertActive(); };
  const step = <T>(action: () => T): T => { check(); const value = action(); check(); return value; };
  const open = (path: FixedDescriptorPath, expected: DirectoryIdentity): number => {
    check();
    const fd = io.openDirectory(path, DIRECTORY_FLAGS);
    descriptors.push(fd);
    check();
    sameDirectory(step(() => io.fstat(fd)), expected);
    return fd;
  };
  try {
    check();
    let container: DirectoryIdentity | undefined;
    for (const path of FIXED_ANCESTORS) {
      const identity = step(() => io.lstat(path));
      requireDirectory(identity);
      if (path === FIXED_CONTAINER) container = identity;
    }
    let target = step(() => {
      try { return io.lstat(FIXED_CACHE_PARENT); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
    });
    let containerFd: number | undefined;
    if (target === undefined) {
      if (container === undefined) throw new Error("fixed-parent-container-missing");
      containerFd = open(FIXED_CONTAINER, container);
      step(() => io.mkdirCacheParent(FIXED_CACHE_PARENT, { mode: 0o700, recursive: false }));
      result = "CREATED";
      target = step(() => io.lstat(FIXED_CACHE_PARENT));
    }
    requireDirectory(target);
    const targetFd = open(FIXED_CACHE_PARENT, target);
    if (containerFd !== undefined) {
      step(() => io.fsync(targetFd));
      step(() => io.fsync(containerFd));
    }
    check();
  } catch (error) { failures.push(error); }
  finally {
    for (const fd of descriptors.reverse()) {
      try { check(); } catch (error) { failures.push(error); }
      try { io.close(fd); } catch (error) { failures.push(error); }
      try { check(); } catch (error) { failures.push(error); }
    }
  }
  try { check(); } catch (error) { failures.push(error); }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "fixed-cache-parent-failed");
  return result;
}
