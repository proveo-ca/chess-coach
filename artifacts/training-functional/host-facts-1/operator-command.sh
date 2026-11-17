#!/usr/bin/env bash
# SPEC: _spec/runtime-protocol.puml
bun --no-env-file --no-install --eval '// SPEC: _spec/runtime-protocol.puml
import { access, open, realpath, stat, statfs } from "node:fs/promises";
import { constants } from "node:fs";

export const HOST = "/home/gu1lty/Projects/proveo/chess-coach", CACHE = `${HOST}/_work/gpu-owner-recovery/cache`;
export const IMAGE = "docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb";
export const GPU = "GPU-713c95e0-6952-a576-794b-9ef1fb527ff0", CACHED_BUN = `${CACHE}/host-gpu-native-build-1/bun`;
export const CHILD_ENV = Object.freeze({ PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", DOCKER_CONFIG: "/nonexistent" });
export type Query = Readonly<{ name: string; kind: "command" | "metadata" | "json" | "disk"; paths: readonly string[]; argv: readonly string[]; layout?: string }>;
const query = (name: string, kind: Query["kind"], paths: string[] = [], argv: string[] = [], layout?: string): Query =>
  Object.freeze({ name, kind, paths: Object.freeze(paths), argv: Object.freeze(argv), ...(layout ? { layout } : {}) });
export const QUERIES: readonly Query[] = Object.freeze([
  query("docker-image", "command", [], ["docker", "--host=unix:///var/run/docker.sock", "image", "inspect", "--format", "{{json .Id}}", IMAGE]),
  query("cached-bun-version", "command", [], [CACHED_BUN, "--version"]),
  query("gpu-memory-snapshot", "command", [], ["nvidia-smi", "--id", GPU, "--query-gpu=uuid,memory.free,memory.total", "--format=csv,noheader,nounits"]),
  query("cached-bun-metadata", "metadata", [CACHED_BUN]),
  ...["policy-score", "policy-channel"].map(name => query(`${name}-metadata`, "metadata", [`${CACHE}/host-gpu-native-build-1/native/target-gpu/x86_64-unknown-linux-gnu/release/${name}`])),
  query("cpu-initializer-metadata", "metadata", [`${CACHE}/host-cpu39-1/native/target-cpu/x86_64-unknown-linux-gnu/release/policy-initialize`], [], "INFERRED_TARGET_LAYOUT_NOT_AN_EXISTENCE_CLAIM"),
  query("llvm-root-metadata", "metadata", [`${CACHE}/host-receive-2/context/gpu-build/llvm`]),
  query("cuda-root-metadata", "metadata", [`${CACHE}/host-receive-2/context/gpu-runtime/rootfs/usr/local/cuda`]),
  query("runtime-zod-packages", "json", [`${HOST}/node_modules/zod/package.json`, `${HOST}/packages/contracts/node_modules/zod/package.json`, `${HOST}/node_modules/.pnpm/zod@4.6.7/node_modules/zod/package.json`]),
  query("runs-disk-snapshot", "disk", [`${HOST}/_work/gpu-owner-recovery/runs`]),
]);
export type ChildFact = { spawned: boolean; exited: boolean; reaped: boolean; exitCode: number | null; signalCode: string | null;
  stdoutEOF: boolean; stderrEOF: boolean; killRequested: boolean; timedOut: boolean; error?: string };
export type Fact = { ok: boolean; data?: unknown; child?: ChildFact; rawBytes: number; retainedBytes: number; truncated: boolean; error?: string };
export type Budget = { deadlineMs: number; cleanupDeadlineMs: number };
export type HostFactsIO = { originMs?: number; now(): number; alarm(ms: number, fire: () => void): () => void;
  context(): Promise<{ cwd: string; realpath: string | null }>; query(query: Query, budget: Budget): Promise<Fact> };
export type Result = Fact & { name: string; status: "OK" | "ERROR" | "DEADLINE" | "SKIPPED"; target: readonly string[]; layout?: string };
export type Report = { status: "FULL" | "PARTIAL" | "DEADLINE"; availability: "UNKNOWN"; context: "ACCEPTED" | "REJECTED" | "UNKNOWN";
  originMs: number; elapsedMs: number; queryGroups: number; results: Result[]; errors: string[]; truncated: boolean;
  limits: { controlledMainMs: number; queryPhaseMs: number; commandMs: number; streamBytes: number; jsonFileBytes: number; finalBytes: number };
  byteCounts: { rawObserved: number; rawRetained: number; serialized: number }; scope: string };
const STREAM = 2048, JSON_FILE = 32768, FINAL = 128 * 1024;
const capped = (value: unknown, bytes = 160): string => Buffer.from(String(value).slice(0, bytes)).subarray(0, bytes).toString("utf8");
export const acceptsHostContext = (value: { cwd: string; realpath: string | null }): boolean => value.cwd === HOST && value.realpath === HOST;
export const isHostFactsEntry = (main: boolean, argv: readonly string[]): boolean => main && argv.length === 2 && argv[1] === "--run";
async function within<T>(io: Pick<HostFactsIO, "now" | "alarm">, promise: Promise<T>, end: number): Promise<T> {
  let cancel = () => {};
  try { return await Promise.race([promise, new Promise<T>((_, reject) => { cancel = io.alarm(Math.max(0, end - io.now()), () => reject(new Error("DEADLINE"))); })]); }
  finally { cancel(); }
}
export function serializeHostFacts(report: Report): string {
  let text = "";
  for (let i = 0; i < 8; i++) {
    text = JSON.stringify(report) + "\n";
    const bytes = Buffer.byteLength(text);
    if (bytes > FINAL) {
      const selected = [...report.results].reverse().find(result => result.data !== undefined);
      if (!selected) throw new Error("REPORT_BOUND");
      delete selected.data; selected.truncated = true; selected.status = "ERROR"; selected.retainedBytes = 0; report.truncated = true;
      if (report.status === "FULL") report.status = "PARTIAL";
      report.byteCounts.rawRetained = report.results.reduce((sum, result) => sum + result.retainedBytes, 0); i = -1; continue;
    }
    if (report.byteCounts.serialized === bytes) return text;
    report.byteCounts.serialized = bytes;
  }
  throw new Error("REPORT_SERIALIZATION");
}
export async function collectHostFacts(io: HostFactsIO): Promise<Report> {
  const origin = io.originMs ?? io.now(); let last = origin, clockFault = false;
  const now = () => { const value = io.now(); if (clockFault || !Number.isFinite(value) || value < last) { clockFault = true; throw new Error("CLOCK_NON_MONOTONIC"); } last = value; return value; };
  const phase = origin + 27000, hardEnd = origin + 30000;
  const report: Report = { status: "FULL", availability: "UNKNOWN", context: "UNKNOWN", originMs: Number.isFinite(origin) ? origin : 0, elapsedMs: 0,
    queryGroups: 0, results: [], errors: [], truncated: false, limits: { controlledMainMs: 30000, queryPhaseMs: 27000, commandMs: 5000, streamBytes: STREAM, jsonFileBytes: JSON_FILE, finalBytes: FINAL },
    byteCounts: { rawObserved: 0, rawRetained: 0, serialized: 0 }, scope: "Read-only snapshots; no readiness qualification, reservation, or registry manifest observation. Ordinary watchdog; excludes interpreter/shell startup; no strict OS bound." };
  const clockIO = { now, alarm: io.alarm.bind(io) };
  try {
    if (!Number.isFinite(origin) || origin < 0) throw new Error("CLOCK_ORIGIN");
    if (now() >= phase) throw new Error("DEADLINE");
    const context = await within(clockIO, io.context(), phase);
    if (now() >= phase) throw new Error("DEADLINE");
    if (!acceptsHostContext(context)) { report.context = "REJECTED"; throw new Error("WRONG_HOST_CONTEXT"); }
    report.context = "ACCEPTED";
    for (const selected of QUERIES) {
      const started = now(); if (started >= phase) throw new Error("DEADLINE");
      const deadlineMs = selected.kind === "command" ? Math.min(started + 5000, phase) : phase;
      const cleanupDeadlineMs = selected.kind === "command" ? Math.min(deadlineMs + 500, origin + 29000) : phase;
      report.queryGroups++;
      let fact: Fact;
      try { fact = await within(clockIO, io.query(selected, { deadlineMs, cleanupDeadlineMs }), cleanupDeadlineMs); }
      catch (error) { fact = { ok: false, rawBytes: 0, retainedBytes: 0, truncated: false, error: capped(error) }; }
      const childOK = selected.kind !== "command" || !!fact.child && fact.child.spawned && fact.child.exited && fact.child.reaped && fact.child.stdoutEOF && fact.child.stderrEOF && fact.child.exitCode === 0 && !fact.child.timedOut && !fact.child.error;
      const status = fact.ok && childOK && !fact.truncated ? "OK" : "ERROR";
      report.results.push({ ...fact, error: fact.error === undefined ? undefined : capped(fact.error), name: selected.name, status, target: selected.kind === "command" ? selected.argv : selected.paths, ...(selected.layout ? { layout: selected.layout } : {}) });
      if (status !== "OK") report.status = "PARTIAL";
      report.truncated ||= fact.truncated;
      if (now() >= phase) throw new Error("DEADLINE");
    }
  } catch (error) { const text = capped(error); report.errors.push(text); report.status = text.includes("DEADLINE") ? "DEADLINE" : "PARTIAL"; }
  for (const selected of QUERIES.slice(report.results.length)) report.results.push({ name: selected.name, status: "SKIPPED", target: selected.kind === "command" ? selected.argv : selected.paths,
    ...(selected.layout ? { layout: selected.layout } : {}), ok: false, rawBytes: 0, retainedBytes: 0, truncated: false });
  report.byteCounts.rawObserved = report.results.reduce((sum, result) => sum + result.rawBytes, 0);
  report.byteCounts.rawRetained = report.results.reduce((sum, result) => sum + result.retainedBytes, 0);
  try { report.elapsedMs = Math.max(0, now() - origin); } catch (error) { report.errors.push(capped(error)); report.status = "PARTIAL"; }
  serializeHostFacts(report);
  try { report.elapsedMs = Math.max(report.elapsedMs, now() - origin); if (last >= hardEnd) report.status = "DEADLINE"; }
  catch { report.status = "PARTIAL"; }
  serializeHostFacts(report); return report;
}
const timerIO = { now: () => performance.now(), alarm: (ms: number, fire: () => void) => { const timer = setTimeout(fire, ms); return () => clearTimeout(timer); } };
async function commandFact(selected: Query, budget: Budget): Promise<Fact> {
  const child: ChildFact = { spawned: false, exited: false, reaped: false, exitCode: null, signalCode: null, stdoutEOF: false, stderrEOF: false, killRequested: false, timedOut: false };
  const streams = [0, 1].map(() => ({ chunks: [] as Uint8Array[], bytes: 0, retained: 0, eof: false }));
  try {
    const proc = Bun.spawn([...selected.argv], { env: { ...CHILD_ENV }, cwd: HOST, stdin: "ignore", stdout: "pipe", stderr: "pipe", detached: true }); child.spawned = true;
    const kill = () => { child.killRequested = true; try { process.kill(-proc.pid, "SIGKILL"); } catch (error) { try { proc.kill("SIGKILL"); } catch { child.error = capped(error); } } };
    const readers = [proc.stdout.getReader(), proc.stderr.getReader()];
    const drains = readers.map(async (reader, index) => { const out = streams[index]!;
      try { for (;;) { const next = await reader.read(); if (next.done) { out.eof = true; return; } out.bytes += next.value.byteLength;
        const take = Math.min(STREAM - out.retained, next.value.byteLength); if (take) { out.chunks.push(Uint8Array.from(next.value.subarray(0, take))); out.retained += take; } } }
      catch (error) { child.error = capped(error); }
    });
    const exit = proc.exited.then(code => { child.exited = true; child.reaped = true; child.exitCode = code; child.signalCode = proc.signalCode === null ? null : String(proc.signalCode); }, error => { child.error = capped(error); });
    const cancel = timerIO.alarm(Math.max(0, budget.deadlineMs - timerIO.now()), () => { child.timedOut = true; kill(); });
    try { await within(timerIO, Promise.all([exit, ...drains]), budget.cleanupDeadlineMs); }
    catch { child.timedOut = true; kill(); }
    finally { cancel(); for (const reader of readers) void reader.cancel().catch(() => {}); proc.unref(); }
  } catch (error) { child.error = capped(error); }
  child.stdoutEOF = streams[0]!.eof; child.stderrEOF = streams[1]!.eof;
  const stdout = Buffer.concat(streams[0]!.chunks).toString("utf8"), stderr = Buffer.concat(streams[1]!.chunks).toString("utf8");
  const data: Record<string, unknown> = { stdout, stderr, streams: streams.map(stream => ({ observedBytes: stream.bytes, retainedBytes: stream.retained, truncated: stream.bytes > stream.retained, eof: stream.eof })) };
  if (selected.name === "docker-image") { let id: unknown; try { id = JSON.parse(stdout); } catch {} data.requestedRef = IMAGE;
    data.observedConfigId = typeof id === "string" && /^sha256:[a-f0-9]{64}$/.test(id) ? id : null; data.idMeaning = "DOCKER_IMAGE_CONFIGURATION_ID_NOT_REGISTRY_MANIFEST_DIGEST"; }
  const truncated = streams.some(stream => stream.bytes > stream.retained);
  return { ok: child.exited && child.reaped && child.exitCode === 0 && child.stdoutEOF && child.stderrEOF && !child.timedOut && !child.error && (selected.name !== "docker-image" || data.observedConfigId !== null),
    child: { ...child }, data, rawBytes: streams.reduce((sum, stream) => sum + stream.bytes, 0), retainedBytes: streams.reduce((sum, stream) => sum + stream.retained, 0), truncated };
}
export function parseZodPackage(bytes: Uint8Array): { name: "zod"; version: string; truncated: boolean } {
  if (bytes.byteLength > JSON_FILE) throw new Error("JSON_FILE_LIMIT");
  const value: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value) || !("name" in value) || value.name !== "zod" || !("version" in value) || typeof value.version !== "string") throw new Error("INVALID_PACKAGE_JSON");
  return { name: "zod", version: capped(value.version, 256), truncated: Buffer.byteLength(value.version) > 256 };
}
async function jsonPackage(path: string): Promise<Record<string, unknown>> {
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const info = await stat(path); if (!info.isFile()) throw new Error("NOT_REGULAR_JSON_FILE");
    file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
    if (!(await file.stat()).isFile()) throw new Error("NOT_REGULAR_JSON_FILE");
    const bytes = Buffer.alloc(JSON_FILE + 1); let length = 0;
    while (length < bytes.length) { const read = await file.read(bytes, length, bytes.length - length, length); if (!read.bytesRead) break; length += read.bytesRead; }
    if (length > JSON_FILE) return { path, ok: false, bytesRead: length, truncated: true, error: "JSON_FILE_LIMIT" };
    return { path, ok: true, bytesRead: length, ...parseZodPackage(bytes.subarray(0, length)) };
  } catch (error) { return { path, ok: false, error: capped(error) }; }
  finally { if (file) await file.close(); }
}
function productionIO(originMs: number): HostFactsIO {
  return { ...timerIO, originMs, async context() { const cwd = process.cwd(); return { cwd, realpath: cwd === HOST ? await realpath(cwd) : null }; },
    async query(selected, budget) {
      if (!QUERIES.includes(selected)) throw new Error("QUERY_ALLOWLIST");
      if (timerIO.now() >= budget.deadlineMs) throw new Error("DEADLINE");
      if (selected.kind === "command") return commandFact(selected, budget);
      let data: unknown, truncated = false, ok = true;
      if (selected.kind === "json") { const rows = await Promise.all(selected.paths.map(jsonPackage)); data = rows; ok = rows.every(row => row.ok === true); truncated = rows.some(row => row.truncated === true); }
      else if (selected.kind === "metadata") {
        const path = selected.paths[0]!, [info, resolved, readable, executable] = await Promise.all([stat(path), realpath(path), access(path, constants.R_OK).then(() => true, () => false), access(path, constants.X_OK).then(() => true, () => false)]);
        truncated = Buffer.byteLength(resolved) > 1024; data = { path, realpath: capped(resolved, 1024), file: info.isFile(), directory: info.isDirectory(), size: String(info.size), mode: info.mode, readable, executable };
      } else { const info = await statfs(selected.paths[0]!, { bigint: true }); data = { path: selected.paths[0], freeBytes: String(info.bavail * info.bsize), totalBytes: String(info.blocks * info.bsize), reservation: false }; }
      const bytes = Buffer.byteLength(JSON.stringify(data)); return { ok, data, rawBytes: bytes, retainedBytes: bytes, truncated };
    } };
}
export async function runHostFacts(io: HostFactsIO, emit: (json: string) => Promise<void>): Promise<number> {
  const report = await collectHostFacts(io); await emit(serializeHostFacts(report)); return report.status === "FULL" ? 0 : 1;
}
if (isHostFactsEntry(import.meta.main, Bun.argv)) {
  const originMs = performance.now();
  const code = await runHostFacts(productionIO(originMs), async json => { await Bun.write(Bun.stdout, json); });
  process.exit(code);
}
' -- --run
