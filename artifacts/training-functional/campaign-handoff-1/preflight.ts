// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs/promises";

export type FrozenPlan = { version: "chess-coach.campaign-host-preflight.v1"; host: string; cachedBun: string; runsParent: string;
  requestSha256: string; minimumUsableBytes: string; minimumFreeEntries: string; freshRoots: string[];
  retained: { path: string; kind: "directory" | "executable" }[] };
export type NodeMetadata = { kind: "directory" | "file" | "symlink" | "other"; mode: number };
export type MetadataIO = { statfs(path: string): Promise<{ usableBytes: bigint | null; freeEntries: bigint | null }>;
  lstat(path: string): Promise<NodeMetadata>; now(): number; alarm(ms: number, callback: () => void): () => void };
const OUTPUT_CAP = 32768;
function requireValue(value: unknown, code: string): asserts value { if (!value) throw new Error(`HOST metadata: ${code}`); }
function path(value: string, host: string): boolean {
  return typeof value === "string" && value.length <= 512 && value.startsWith(host + "/_work/gpu-owner-recovery/") &&
    !/[\0\\]/.test(value) && value.split("/").slice(1).every(p => p && p !== "." && p !== "..");
}
function validate(plan: FrozenPlan): void {
  requireValue(plan?.version === "chess-coach.campaign-host-preflight.v1" && plan.host === "/home/gu1lty/Projects/proveo/chess-coach" &&
    plan.runsParent === `${plan.host}/_work/gpu-owner-recovery/runs` && /^[a-f0-9]{64}$/.test(plan.requestSha256), "PLAN_IDENTITY");
  requireValue(plan.minimumUsableBytes === "283467841536" && plan.minimumFreeEntries === "835600", "SELECTED_THRESHOLDS");
  const roots = ["training-campaign-delivery-1", "training-campaign-inputs-1", "training-campaign-1"].map(name => `${plan.runsParent}/${name}`);
  requireValue(JSON.stringify(plan.freshRoots) === JSON.stringify(roots), "FRESH_ROOTS");
  requireValue(plan.retained.length > 0 && plan.retained.length <= 24 && new Set(plan.retained.map(r => r.path)).size === plan.retained.length &&
    plan.retained.every(r => path(r.path, plan.host) && (r.kind === "directory" || r.kind === "executable")) &&
    plan.retained.some(r => r.path === plan.cachedBun && r.kind === "executable") && path(plan.cachedBun, plan.host), "RETAINED_ALLOWLIST");
  requireValue(plan.retained[0]!.path === plan.runsParent && plan.retained[0]!.kind === "directory", "PARENT_FIRST");
}
function code(error: unknown): string {
  const value = error && typeof error === "object" ? Reflect.get(error, "code") : null;
  return typeof value === "string" && /^[A-Z0-9_]{1,40}$/.test(value) ? value : "METADATA_ERROR";
}
export async function inspect(io: MetadataIO, plan: FrozenPlan) {
  validate(plan);
  const started = io.now(); requireValue(Number.isFinite(started) && started >= 0, "CLOCK"); let last = started;
  const now = () => { const value = io.now(); requireValue(Number.isFinite(value) && value >= last, "CLOCK"); last = value; return value; };
  const deadline = started + 30000;
  async function observe<T>(action: () => Promise<T>): Promise<T> {
    requireValue(now() < deadline, "DEADLINE"); let cancel = () => {};
    try { const result = await Promise.race([action(), new Promise<never>((_, reject) => { cancel = io.alarm(Math.max(0, Math.min(2000, deadline - now())),
      () => reject(Object.assign(new Error("METADATA_TIMEOUT"), { code: "METADATA_TIMEOUT" }))); })]); requireValue(now() < deadline, "DEADLINE"); return result; }
    finally { cancel(); }
  }
  const failures: string[] = [], freshRoots: { path: string; observation: "ABSENT" | "EXISTS" | "UNKNOWN"; error: string | null }[] = [];
  const retained: { path: string; expected: string; observed: NodeMetadata | null; matches: boolean; error: string | null }[] = [];
  let parentKnown = false;
  try { const observed = await observe(() => io.lstat(plan.runsParent)); parentKnown = observed.kind === "directory";
    retained.push({ path: plan.runsParent, expected: "directory", observed, matches: parentKnown, error: null }); }
  catch (error) { retained.push({ path: plan.runsParent, expected: "directory", observed: null, matches: false, error: code(error) }); }
  if (!parentKnown) failures.push("RUNS_PARENT_UNKNOWN_OR_WRONG_KIND");
  let capacity: { path: string; usableBytes: string | null; freeEntries: string | null; bytesSufficient: boolean; entriesSufficient: boolean; error: string | null };
  try {
    if (!parentKnown) throw Object.assign(new Error("PARENT_UNVERIFIED"), { code: "PARENT_UNVERIFIED" });
    const result = await observe(() => io.statfs(plan.runsParent));
    const usable = typeof result.usableBytes === "bigint" && result.usableBytes >= 0n ? result.usableBytes : null;
    const entries = typeof result.freeEntries === "bigint" && result.freeEntries >= 0n ? result.freeEntries : null;
    capacity = { path: plan.runsParent, usableBytes: usable?.toString() ?? null, freeEntries: entries?.toString() ?? null,
      bytesSufficient: usable !== null && usable >= BigInt(plan.minimumUsableBytes), entriesSufficient: entries !== null && entries >= BigInt(plan.minimumFreeEntries), error: null };
    if (!capacity.bytesSufficient) failures.push(usable === null ? "USABLE_BYTES_UNKNOWN" : "USABLE_BYTES_INSUFFICIENT");
    if (!capacity.entriesSufficient) failures.push(entries === null ? "FREE_ENTRIES_UNKNOWN" : "FREE_ENTRIES_INSUFFICIENT");
  } catch (error) { capacity = { path: plan.runsParent, usableBytes: null, freeEntries: null, bytesSufficient: false, entriesSufficient: false, error: code(error) }; failures.push("CAPACITY_UNKNOWN"); }
  for (const root of plan.freshRoots) {
    if (!parentKnown) { freshRoots.push({ path: root, observation: "UNKNOWN", error: "PARENT_UNVERIFIED" }); continue; }
    try { await observe(() => io.lstat(root)); freshRoots.push({ path: root, observation: "EXISTS", error: null }); failures.push("FRESH_ROOT_OCCUPIED"); }
    catch (error) { const errorCode = code(error); freshRoots.push({ path: root, observation: errorCode === "ENOENT" ? "ABSENT" : "UNKNOWN", error: errorCode });
      if (errorCode !== "ENOENT") failures.push("FRESH_ROOT_UNKNOWN"); }
  }
  for (const node of plan.retained.slice(1)) {
    try {
      const observed = await observe(() => io.lstat(node.path));
      const matches = observed && Number.isInteger(observed.mode) && observed.mode >= 0 && observed.mode <= 4095 &&
        (node.kind === "directory" ? observed.kind === "directory" : observed.kind === "file" && (observed.mode & 0o111) !== 0);
      retained.push({ path: node.path, expected: node.kind, observed, matches: !!matches, error: null }); if (!matches) failures.push("RETAINED_KIND_OR_MODE");
    } catch (error) { retained.push({ path: node.path, expected: node.kind, observed: null, matches: false, error: code(error) }); failures.push("RETAINED_METADATA_UNKNOWN"); }
  }
  const report = { version: "chess-coach.campaign-host-preflight-observation.v1", scope: "HOST_FILESYSTEM_METADATA_ONLY_NOT_PREPARATION_OR_TRAINING",
    status: failures.length === 0 ? "PASS_METADATA_PRECONDITIONS" : "BLOCKED_METADATA_PRECONDITIONS", requestSha256: plan.requestSha256,
    thresholds: { usableBytes: plan.minimumUsableBytes, freeEntries: plan.minimumFreeEntries }, capacity, freshRoots, retained, failures,
    reservationCreated: false, quotaVerified: false, toolUsabilityVerified: false, payloadContentsRead: false, readinessFlagsChanged: false,
    preparationExecuted: false, nativeGpuDockerCommandsExecuted: false, trainingExecuted: false, trainingExecutionAuthorized: false };
  requireValue(Buffer.byteLength(JSON.stringify(report)) <= OUTPUT_CAP, "OUTPUT_BOUND"); return report;
}
export function metadataIO(): MetadataIO {
  return { now: () => performance.now(), alarm: (ms, callback) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); },
    statfs: async path => { const value = await fs.statfs(path, { bigint: true }); return { usableBytes: value.bavail >= 0n && value.bsize > 0n ? value.bavail * value.bsize : null,
      freeEntries: value.ffree >= 0n && !(value.ffree === 0n && value.files === 0n) ? value.ffree : null }; },
    lstat: async path => { const value = await fs.lstat(path); return { kind: value.isSymbolicLink() ? "symlink" : value.isDirectory() ? "directory" : value.isFile() ? "file" : "other", mode: value.mode & 0o7777 }; } };
}
