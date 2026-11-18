// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs/promises";
import type { FrozenPlan } from "../campaign-handoff-1/preflight";

export const HOST_VOLUME = "/var/lib/chess-coach/training-volume-1";
export type NodeMetadata = { kind: "directory" | "file" | "symlink" | "other"; mode: number; uid: string; gid: string };
export type Counters = { type: bigint; bsize: bigint; bavail: bigint; files: bigint; ffree: bigint };
export type MetadataIO = { lstat(path: string): Promise<NodeMetadata>; statfs(path: string): Promise<Counters>;
  now(): number; alarm(ms: number, callback: () => void): () => void };
function requireValue(value: unknown, code: string): asserts value { if (!value) throw new Error(`HOST volume metadata: ${code}`); }
function errorCode(error: unknown): string {
  const code = error && typeof error === "object" ? Reflect.get(error, "code") : null;
  return typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code) ? code : "METADATA_ERROR";
}
export async function inspect(io: MetadataIO, plan: FrozenPlan) {
  requireValue(plan?.minimumUsableBytes === "283467841536" && plan.minimumFreeEntries === "835600" &&
    plan.requestSha256 === "b322483ef22028f31170983ea6f50cb46c61e8481e86cc4e3db9cca922ca4331", "FROZEN_BUDGET_CONTEXT");
  const started = io.now(); requireValue(Number.isFinite(started) && started >= 0, "CLOCK"); let last = started;
  function now() { const value = io.now(); requireValue(Number.isFinite(value) && value >= last, "CLOCK"); last = value; return value; }
  const deadline = started + 5000;
  async function observe<T>(action: () => Promise<T>): Promise<T> {
    requireValue(now() < deadline, "DEADLINE"); let cancel = () => {};
    try {
      const result = await Promise.race([action(), new Promise<never>((_, reject) => { cancel = io.alarm(Math.min(2000, Math.max(0, deadline - now())),
        () => reject(Object.assign(new Error("METADATA_TIMEOUT"), { code: "METADATA_TIMEOUT" }))); })]);
      requireValue(now() < deadline, "DEADLINE"); return result;
    } finally { cancel(); }
  }
  const failures: string[] = [];
  let node: NodeMetadata | null = null, nodeError: string | null = null;
  let raw: { type: string; bsize: string; bavail: string; files: string; ffree: string } | null = null;
  let capacityError: string | null = null, usableBytes: bigint | null = null, freeEntries: bigint | null = null;
  try {
    const value = await observe(() => io.lstat(HOST_VOLUME));
    requireValue(["directory", "file", "symlink", "other"].includes(value.kind) && Number.isInteger(value.mode) && value.mode >= 0 && value.mode <= 4095 &&
      /^\d{1,20}$/.test(value.uid) && /^\d{1,20}$/.test(value.gid), "NODE_METADATA");
    node = value;
    if (node.kind !== "directory") failures.push("VOLUME_PATH_NOT_DIRECTORY");
  } catch (error) { nodeError = errorCode(error); failures.push("VOLUME_PATH_UNKNOWN"); }
  if (node?.kind === "directory") {
    try {
      const value = await observe(() => io.statfs(HOST_VOLUME));
      requireValue([value.type, value.bsize, value.bavail, value.files, value.ffree].every(n => typeof n === "bigint"), "FILESYSTEM_COUNTERS");
      raw = { type: String(value.type), bsize: String(value.bsize), bavail: String(value.bavail), files: String(value.files), ffree: String(value.ffree) };
      usableBytes = value.bsize > 0n && value.bavail >= 0n ? value.bsize * value.bavail : null;
      freeEntries = value.ffree >= 0n && !(value.files === 0n && value.ffree === 0n) ? value.ffree : null;
      if (usableBytes === null) failures.push("USABLE_BYTES_UNKNOWN");
      else if (usableBytes < BigInt(plan.minimumUsableBytes)) failures.push("USABLE_BYTES_INSUFFICIENT");
      if (freeEntries === null) failures.push("FREE_ENTRIES_UNKNOWN");
      else if (freeEntries < BigInt(plan.minimumFreeEntries)) failures.push("FREE_ENTRIES_INSUFFICIENT");
    } catch (error) { capacityError = errorCode(error); failures.push("CAPACITY_UNKNOWN"); }
  }
  const report = { version: "chess-coach.campaign-host-volume-observation.v1", scope: "SELECTED_HOST_DIRECTORY_METADATA_ONLY_NOT_SBX_CAPACITY_OR_PREPARATION_OR_TRAINING",
    status: failures.length === 0 ? "PASS_METADATA_PRECONDITIONS" : "BLOCKED_METADATA_PRECONDITIONS", hostPath: HOST_VOLUME,
    requestSha256: plan.requestSha256, thresholds: { usableBytes: plan.minimumUsableBytes, freeEntries: plan.minimumFreeEntries },
    pathMetadata: { observed: node, error: nodeError }, capacity: { raw, error: capacityError, usableBytes: usableBytes?.toString() ?? null,
      freeEntries: freeEntries?.toString() ?? null, bytesSufficient: usableBytes === null ? null : usableBytes >= BigInt(plan.minimumUsableBytes),
      entriesSufficient: freeEntries === null ? null : freeEntries >= BigInt(plan.minimumFreeEntries) }, failures,
    reservationCreated: false, quotaVerified: false, directoryUsabilityVerified: false, selinuxCompatibilityVerified: false,
    payloadContentsRead: false, readinessFlagsChanged: false, preparationExecuted: false, campaignRootsRelocated: false,
    nativeGpuDockerCommandsExecuted: false, trainingExecuted: false, trainingExecutionAuthorized: false };
  requireValue(Buffer.byteLength(JSON.stringify(report)) <= 8192, "OUTPUT_BOUND"); return report;
}
export function metadataIO(): MetadataIO {
  return { now: () => performance.now(), alarm: (ms, callback) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); },
    lstat: async path => { const value = await fs.lstat(path, { bigint: true }); return { kind: value.isSymbolicLink() ? "symlink" : value.isDirectory() ? "directory" : value.isFile() ? "file" : "other",
      mode: Number(value.mode & 4095n), uid: String(value.uid), gid: String(value.gid) }; },
    statfs: async path => { const value = await fs.statfs(path, { bigint: true }); return { type: value.type, bsize: value.bsize, bavail: value.bavail, files: value.files, ffree: value.ffree }; } };
}
