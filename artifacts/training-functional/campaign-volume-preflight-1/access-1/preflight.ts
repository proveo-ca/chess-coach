// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { isDeepStrictEqual as same } from "node:util";

export type AccessPlan = { version: "chess-coach.campaign-host-preflight.v1"; host: string; cachedBun: string; runsParent: string;
  requestSha256: string; minimumUsableBytes: string; minimumFreeEntries: string; freshRoots: string[];
  retained: { path: string; kind: "directory" | "executable" }[]; inspection: "READ_ONLY_ACCESS_METADATA_V1"; completionSha256: string };
export type Node = { kind: "directory" | "file" | "symlink" | "other"; mode: number; uid: string; gid: string; bytes: string };
export type Identity = { uid: number; euid: number; gid: number; egid: number; groups: number[] };
export type LabelResult = { exitCode: number; stdout: Uint8Array; stderr: Uint8Array };
export type MetadataIO = { now(): number; alarm(ms: number, callback: () => void): () => void; identity(): Identity;
  lstat(path: string): Promise<Node>; realpath(path: string): Promise<string>; access(path: string, mode: "read" | "write" | "execute"): Promise<void>;
  context(path: string): Promise<Uint8Array>; labels(paths: string[]): Promise<LabelResult> };
export const VOLUME = "/var/lib/chess-coach/training-volume-1";
export const ANCESTORS = ["/", "/var", "/var/lib", "/var/lib/chess-coach", VOLUME];
export const CONTEXT_PATHS = ["/sys/fs/selinux/enforce", "/proc/self/attr/current"];
export function accessPlan(): AccessPlan {
  const host = "/home/gu1lty/Projects/proveo/chess-coach", work = `${host}/_work/gpu-owner-recovery`, cachedBun = `${work}/cache/host-gpu-native-build-1/bun`,
    inputs = `${work}/runs/training-qualification-inputs-1`, gpu = `${work}/cache/host-gpu-native-build-1/native/target-gpu/x86_64-unknown-linux-gnu/release`;
  return { version: "chess-coach.campaign-host-preflight.v1", host, cachedBun, runsParent: VOLUME,
    requestSha256: "70ba4aadc079cab314cf9dd6f4dc2354ab3c1739e035131b1b067302241b0322", minimumUsableBytes: "283467841536", minimumFreeEntries: "835600",
    freshRoots: ["training-campaign-delivery-2", "training-campaign-inputs-2", "training-campaign-2"].map(name => `${VOLUME}/${name}`),
    retained: [{ path: VOLUME, kind: "directory" }, ...["app", "reference", "qualification-inputs"].map(name => ({ path: `${inputs}/${name}`, kind: "directory" as const })),
      ...["score", "channel"].map(name => ({ path: `${inputs}/app/artifacts/training-functional/qualification-policy-${name}.ts`, kind: "executable" as const })),
      ...[cachedBun, `${gpu}/policy-score`, `${gpu}/policy-channel`, `${work}/cache/host-cpu39-1/native/target-cpu/x86_64-unknown-linux-gnu/release/policy-initialize`]
        .map(path => ({ path, kind: "executable" as const })),
      ...[`${work}/cache/host-receive-2/context/gpu-build/llvm`, `${work}/cache/host-receive-2/context/gpu-runtime/rootfs/usr/local/cuda`].map(path => ({ path, kind: "directory" as const }))],
    inspection: "READ_ONLY_ACCESS_METADATA_V1", completionSha256: "23b5e67c58d644d8398ffbf70df0557dabede08e62a5658a7b5e32480ae30d4b" };
}
function requireValue(value: unknown, code: string): asserts value { if (!value) throw Object.assign(new Error(`HOST access metadata: ${code}`), { code }); }
function errorCode(error: unknown): string {
  const code = error && typeof error === "object" ? Reflect.get(error, "code") : null;
  return typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code) ? code : "METADATA_ERROR";
}
function validNode(value: Node): Node {
  requireValue(value && ["directory", "file", "symlink", "other"].includes(value.kind) && Number.isInteger(value.mode) && value.mode >= 0 && value.mode <= 4095 &&
    [value.uid, value.gid, value.bytes].every(n => typeof n === "string" && /^[0-9]{1,20}$/.test(n)), "NODE_METADATA"); return value;
}
export async function inspect(io: MetadataIO, plan: AccessPlan) {
  requireValue(same(plan, accessPlan()), "FROZEN_ACCESS_ALLOWLIST");
  const identity = io.identity(); requireValue(identity && [identity.uid, identity.euid, identity.gid, identity.egid, ...identity.groups].every(n => Number.isSafeInteger(n) && n >= 0) && identity.groups.length <= 64, "CALLER_IDENTITY");
  let last = io.now(); requireValue(Number.isFinite(last) && last >= 0, "CLOCK"); const deadline = last + 30000;
  function now() { const value = io.now(); requireValue(Number.isFinite(value) && value >= last, "CLOCK"); last = value; return value; }
  async function observe<T>(action: () => Promise<T>): Promise<T> {
    requireValue(now() < deadline, "METADATA_DEADLINE"); let cancel = () => {};
    try { const value = await Promise.race([action(), new Promise<never>((_, reject) => { cancel = io.alarm(Math.min(1000, deadline - now()),
      () => reject(Object.assign(new Error("METADATA_TIMEOUT"), { code: "METADATA_TIMEOUT" }))); })]); requireValue(now() < deadline, "METADATA_DEADLINE"); return value; }
    finally { cancel(); }
  }
  async function attempt<T>(action: () => Promise<T>): Promise<{ value: T | null; error: string | null }> {
    try { return { value: await observe(action), error: null }; } catch (error) { return { value: null, error: errorCode(error) }; }
  }
  async function access(path: string, mode: "read" | "write" | "execute") {
    const result = await attempt(() => io.access(path, mode)); return { allowed: result.error === null ? true : ["EACCES", "EPERM"].includes(result.error) ? false : null, error: result.error };
  }
  const ancestors = [];
  for (const path of ANCESTORS) ancestors.push({ path, metadata: await attempt(async () => validNode(await io.lstat(path))),
    realpath: await attempt(async () => { const value = await io.realpath(path); requireValue(typeof value === "string" && value.startsWith("/") && value.length <= 1024, "REALPATH"); return value; }),
    search: await access(path, "execute") });
  const volumeAccess = { read: await access(VOLUME, "read"), write: await access(VOLUME, "write"), search: await access(VOLUME, "execute") };
  const freshRoots = [];
  for (const path of plan.freshRoots) {
    const result = await attempt(async () => validNode(await io.lstat(path)));
    freshRoots.push({ path, observation: result.value !== null ? "EXISTS" : result.error === "ENOENT" ? "ABSENT" : "UNKNOWN", ...result });
  }
  const retained = [];
  for (const target of plan.retained.slice(1)) {
    const metadata = await attempt(async () => validNode(await io.lstat(target.path)));
    retained.push({ ...target, metadata, kindAndModeMatch: metadata.value === null ? null : target.kind === "directory" ? metadata.value.kind === "directory" : metadata.value.kind === "file" && (metadata.value.mode & 0o111) !== 0,
      read: await access(target.path, "read"), searchOrExecute: await access(target.path, "execute") });
  }
  const context = [];
  for (const path of CONTEXT_PATHS) context.push({ path, ...await attempt(async () => { const bytes = await io.context(path);
    requireValue(bytes instanceof Uint8Array && bytes.byteLength <= 1024, "CONTEXT_BOUND"); return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }) });
  const labelPaths = [...new Set([...ancestors.filter(row => row.metadata.value !== null).map(row => row.path), ...retained.filter(row => row.metadata.value !== null).map(row => row.path),
    ...freshRoots.filter(row => row.value !== null).map(row => row.path)])];
  const labels = labelPaths.length ? await attempt(async () => {
    const value = await io.labels(labelPaths); requireValue(Number.isSafeInteger(value.exitCode) && value.stdout.byteLength <= 8192 && value.stderr.byteLength <= 8192, "LABEL_RESULT_BOUND");
    return { argv: ["/usr/bin/ls", "-Zd", "--", ...labelPaths], exitCode: value.exitCode,
      stdout: new TextDecoder("utf-8", { fatal: true }).decode(value.stdout), stderr: new TextDecoder("utf-8", { fatal: true }).decode(value.stderr) };
  }) : { value: null, error: "NO_OBSERVED_LABEL_TARGETS" };
  const failures = [...(ancestors.some(row => row.metadata.value?.kind !== "directory" || row.realpath.value !== row.path || row.search.allowed !== true) ? ["ANCESTOR_SEARCH_UNKNOWN_OR_DENIED"] : []),
    ...(Object.values(volumeAccess).some(value => value.allowed !== true) ? ["VOLUME_CALLER_ACCESS_UNKNOWN_OR_DENIED"] : []),
    ...(freshRoots.some(row => row.observation !== "ABSENT") ? ["PROPOSED_ROOT_NOT_PROVED_ABSENT"] : []),
    ...(retained.some(row => row.kindAndModeMatch !== true || row.read.allowed !== true || row.searchOrExecute.allowed !== true) ? ["RETAINED_METADATA_OR_CALLER_ACCESS_UNVERIFIED"] : [])];
  const report = { version: "chess-coach.campaign-access-observation.v1", scope: "READ_ONLY_CALLER_METADATA_NOT_FUTURE_CONTAINER_ACCESS_OR_PREPARATION_OR_TRAINING",
    status: failures.length ? "BLOCKED_METADATA_PRECONDITIONS" : "PASS_METADATA_PRECONDITIONS", requestSha256: plan.requestSha256, completionSha256: plan.completionSha256,
    identity, ancestors, volumeAccess, freshRoots, retained, selinux: { context, labels, compatibilityVerified: false }, failures,
    capacityQueried: false, writeProbeExecuted: false, retainedPayloadContentsRead: false, retainedNativeToolsExecuted: false, directoryContentsListed: false,
    futureContainerAccessVerified: false, readinessFlagsChanged: false, preparationExecuted: false, permissionOrSelinuxChangesExecuted: false,
    nativeGpuDockerCommandsExecuted: false, trainingExecuted: false, trainingExecutionAuthorized: false };
  requireValue(Buffer.byteLength(JSON.stringify(report)) <= 32768, "OUTPUT_BOUND"); return report;
}
export function metadataIO(): MetadataIO {
  const plan = accessPlan(), allowed = new Set([...ANCESTORS, ...plan.freshRoots, ...plan.retained.map(row => row.path)]);
  const target = (path: string) => requireValue(allowed.has(path), "METADATA_TARGET");
  return { now: () => performance.now(), alarm: (ms, callback) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); },
    identity: () => ({ uid: process.getuid!(), euid: process.geteuid!(), gid: process.getgid!(), egid: process.getegid!(), groups: process.getgroups!() }),
    lstat: async path => { target(path); const value = await fs.lstat(path, { bigint: true }); return { kind: value.isSymbolicLink() ? "symlink" : value.isDirectory() ? "directory" : value.isFile() ? "file" : "other",
      mode: Number(value.mode & 4095n), uid: String(value.uid), gid: String(value.gid), bytes: String(value.size) }; },
    realpath: async path => { requireValue(ANCESTORS.includes(path), "ANCESTOR_TARGET"); return fs.realpath(path); },
    access: async (path, mode) => { target(path); requireValue(["read", "write", "execute"].includes(mode), "ACCESS_MODE"); await fs.access(path, mode === "read" ? constants.R_OK : mode === "write" ? constants.W_OK : constants.X_OK); },
    context: async path => { requireValue(CONTEXT_PATHS.includes(path), "CONTEXT_TARGET"); const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try { const bytes = Buffer.alloc(1025); let count = 0; while (count < bytes.length) { const result = await handle.read(bytes, count, bytes.length - count, null); if (!result.bytesRead) break; count += result.bytesRead; }
        requireValue(count <= 1024, "CONTEXT_BOUND"); return bytes.subarray(0, count); } finally { await handle.close(); } },
    labels: async paths => { requireValue(paths.length > 0 && paths.length <= 24 && new Set(paths).size === paths.length, "LABEL_TARGETS"); paths.forEach(target);
      const result = Bun.spawnSync(["/usr/bin/ls", "-Zd", "--", ...paths], { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 1000, maxBuffer: 8192,
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", TERM: "dumb" } });
      requireValue(result.signalCode === null && result.exitCode >= 0, "LABEL_QUERY_EXIT"); return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }; } };
}
