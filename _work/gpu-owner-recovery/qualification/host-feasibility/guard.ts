// SPEC: _spec/gpu-feasibility.puml
import type { FeasibilityPlan } from "./plan";

export type DriverEvent = {
  version: "chess-coach.gpu-feasibility-event.v1";
  runId: string;
  sequence: number;
  kind: "guard-start" | "sample" | "attempt-start" | "attempt-finish" | "abort" | "done";
  [field: string]: unknown;
};
export type MemorySample = { uuid: string; freeBytes: number; totalBytes: number };
export type AcceptedSample = MemorySample & { query: number; queryStartedAtMs: number; observedAtMs: number };
type GuardPlan = Pick<FeasibilityPlan, "selectedUuid" | "guard" | "limits">;

export function telemetryArgv(p: Pick<FeasibilityPlan, "selectedUuid">): string[] {
  return ["nvidia-smi", "--id=" + p.selectedUuid, "--query-gpu=uuid,memory.free,memory.total", "--format=csv,noheader,nounits"];
}

export function parseSample(csv: string, uuid: string): MemorySample {
  const row = csv.replace(/\r?\n$/, "");
  if (!row || /[\r\n]/.test(row)) throw Error("TELEMETRY_EXACTLY_ONE_ROW_REQUIRED");
  const cells = row.split(",").map(cell => cell.trim());
  if (cells.length !== 3 || cells[0] !== uuid || !/^\d+$/.test(cells[1]!) || !/^\d+$/.test(cells[2]!)) {
    throw Error("TELEMETRY_UUID_INTEGER_MIB_REQUIRED");
  }
  const freeBytes = Number(cells[1]) * 1048576, totalBytes = Number(cells[2]) * 1048576;
  if (!Number.isSafeInteger(freeBytes) || !Number.isSafeInteger(totalBytes) || totalBytes <= 0 || freeBytes > totalBytes) {
    throw Error("TELEMETRY_MEMORY_RANGE");
  }
  return { uuid, freeBytes, totalBytes };
}

export function makeProgressGuard(p: GuardPlan, now: () => number) {
  let failure: string | null = null, sample: AcceptedSample | null = null;
  let pending: { query: number; queryStartedAtMs: number } | null = null;
  let queries = 0, lastQueryStartedAtMs: number | null = null, lastClock = -Infinity;
  const latch = (reason: string) => { failure ??= reason; return failure; };
  const reject = (reason: string): never => { throw Error(latch(reason)); };
  const clock = () => {
    const value = now();
    if (!Number.isFinite(value) || value < lastClock) return reject("GUARD_MONOTONIC_CLOCK_REQUIRED");
    lastClock = value;
    return value;
  };
  const check = () => {
    if (failure) throw Error(failure);
    const time = clock();
    if (sample && time - sample.queryStartedAtMs >= p.guard.maxSampleAgeMs) reject("TELEMETRY_SAMPLE_STALE");
    if (pending && time - pending.queryStartedAtMs > p.guard.queryTimeoutMs) reject("TELEMETRY_QUERY_DEADLINE");
    return time;
  };
  return {
    latch,
    check,
    startQuery() {
      const time = check();
      if (pending) reject("TELEMETRY_SINGLE_FLIGHT_REQUIRED");
      if (lastQueryStartedAtMs !== null && time - lastQueryStartedAtMs < p.guard.sampleIntervalMs) reject("TELEMETRY_QUERY_CADENCE");
      if (queries >= p.limits.telemetryQueries) reject("TELEMETRY_QUERY_COUNT_BOUND");
      pending = { query: ++queries, queryStartedAtMs: time };
      lastQueryStartedAtMs = time;
      return { ...pending };
    },
    accept(csv: string): AcceptedSample {
      const time = check();
      if (!pending) reject("TELEMETRY_QUERY_REQUIRED");
      let parsed: MemorySample;
      try { parsed = parseSample(csv, p.selectedUuid); } catch (error) { return reject(String(error)); }
      if (sample && parsed.totalBytes !== sample.totalBytes) reject("TELEMETRY_TOTAL_CHANGED");
      if (!sample && parsed.freeBytes < p.guard.startupMinFreeBytes) reject("TELEMETRY_STARTUP_HEADROOM");
      if (sample && parsed.freeBytes < p.guard.runningStopBelowFreeBytes) reject("TELEMETRY_RUNNING_HEADROOM");
      sample = { ...parsed, ...pending!, observedAtMs: time };
      pending = null;
      return { ...sample };
    },
    snapshot() { return { failure, sample: sample && { ...sample }, pending: pending && { ...pending }, queries, lastQueryStartedAtMs }; },
  };
}
