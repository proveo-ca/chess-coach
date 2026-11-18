// SPEC: _spec/gpu-full-qualification.puml
import { expect, test } from "bun:test";
import { fullPlan, fullSelectors } from "./plan";
import { progressWatchdog } from "./watchdog";

const p = await fullPlan();
function events() {
  let sequence = 0, text = "";
  return { add: (kind: string, data = {}) => text += JSON.stringify({ version: "chess-coach.gpu-full-event.v1", runId: p.runId, sequence: ++sequence, kind, ...data }) + "\n", get: () => text };
}
const sample = { uuid: p.selectedUuid, freeBytes: 3221225472, totalBytes: 8589934592, queryStartedMs: 0, query: 1 };
const accepted = { status: "PASS", accepted: true };
function attempts(e: ReturnType<typeof events>, ids: readonly string[] = fullSelectors) {
  for (const id of ids) { e.add("attempt-start", { id }); e.add("attempt-finish", { id, ...accepted }); }
}

test("independent full watchdog accepts exactly six ordered accepted attempts and a drained guard", () => {
  let clock = 0; const e = events(), g = progressWatchdog(p, () => clock);
  e.add("guard-start"); e.add("sample", sample); g.read(e.get()); clock = 2000;
  e.add("sample", { ...sample, query: 2, queryStartedMs: 2000, freeBytes: 2147483648 }); g.read(e.get());
  attempts(e); e.add("done");
  expect(g.finish(e.get())).toEqual({ guardComplete: true, events: 16, samplesTotalBytes: 8589934592 });
});

test("full completion cannot substitute the previous pair for six attempts", () => {
  const e = events(), g = progressWatchdog(p, () => 0);
  e.add("guard-start"); e.add("sample", sample); attempts(e, fullSelectors.slice(0, 2)); e.add("done");
  expect(() => g.finish(e.get())).toThrow("JOURNAL_COMPLETE_SIX_REQUIRED");
});

test("a replacement cannot rejuvenate stale progress at the exact age boundary", () => {
  let clock = 0; const e = events(), g = progressWatchdog(p, () => clock);
  e.add("guard-start"); e.add("sample", sample); g.read(e.get()); clock = 4000;
  e.add("sample", { ...sample, query: 2, queryStartedMs: 4000 });
  expect(() => g.read(e.get())).toThrow("GPU_SAMPLE_PROGRESS_STALE"); clock = 4001;
  expect(() => g.read(e.get())).toThrow("GPU_SAMPLE_PROGRESS_STALE");
});

for (const [name, mutate] of [
  ["wrong UUID", (e: any) => { e.uuid = "GPU-other"; }], ["low startup headroom", (e: any) => { e.freeBytes--; }],
  ["invalid total", (e: any) => { e.totalBytes = 1; }], ["fractional bytes", (e: any) => { e.freeBytes += 0.5; }],
  ["nonfinite start", (e: any) => { e.queryStartedMs = NaN; }], ["negative start", (e: any) => { e.queryStartedMs = -1; }],
  ["skipped query", (e: any) => { e.query = 2; }],
] as const) test("watchdog rejects " + name, () => {
  const e = events(), g = progressWatchdog(p, () => 0), row = { ...sample }; mutate(row);
  e.add("guard-start"); e.add("sample", row); expect(() => g.read(e.get())).toThrow();
});

test("watchdog rejects changed capacity, low running headroom and replayed or early replacement queries", () => {
  for (const change of [{ totalBytes: 8589934593 }, { freeBytes: 2147483647 }, { query: 1 }, { queryStartedMs: 1999 }]) {
    const e = events(), g = progressWatchdog(p, () => 0);
    e.add("guard-start"); e.add("sample", sample); e.add("sample", { ...sample, query: 2, queryStartedMs: 2000, ...change });
    expect(() => g.read(e.get())).toThrow();
  }
});

test("out-of-order, overlapping, duplicate or unfinished attempts never complete", () => {
  for (const mode of ["wrong-first", "overlap", "wrong-finish", "duplicate", "unfinished"]) {
    const e = events(), g = progressWatchdog(p, () => 0); e.add("guard-start"); e.add("sample", sample);
    if (mode === "wrong-first") e.add("attempt-start", { id: fullSelectors[2] });
    if (mode === "overlap") { e.add("attempt-start", { id: fullSelectors[0] }); e.add("attempt-start", { id: fullSelectors[1] }); }
    if (mode === "wrong-finish") { e.add("attempt-start", { id: fullSelectors[0] }); e.add("attempt-finish", { id: fullSelectors[1], ...accepted }); }
    if (mode === "duplicate") { attempts(e, fullSelectors.slice(0, 1)); e.add("attempt-finish", { id: fullSelectors[0], ...accepted }); }
    if (mode === "unfinished") { attempts(e, fullSelectors.slice(0, 5)); e.add("attempt-start", { id: fullSelectors[5] }); e.add("done"); }
    expect(() => g.finish(e.get())).toThrow();
  }
});

test("a failed or unaccepted finish latches failure even if later data claims all six passed", () => {
  for (const result of [{ status: "FAIL", accepted: false }, { status: "PASS", accepted: false }, { status: "FAIL", accepted: true }, { status: "PASS" }]) {
    const e = events(), g = progressWatchdog(p, () => 0); e.add("guard-start"); e.add("sample", sample);
    e.add("attempt-start", { id: fullSelectors[0] }); e.add("attempt-finish", { id: fullSelectors[0], ...result });
    expect(() => g.read(e.get())).toThrow("JOURNAL_ATTEMPT_NOT_ACCEPTED");
    attempts(e, fullSelectors.slice(1)); e.add("done"); expect(() => g.finish(e.get())).toThrow("JOURNAL_ATTEMPT_NOT_ACCEPTED");
  }
});

test("foreign feasibility events, run IDs and sequence replacements fail closed", () => {
  for (const change of [{ version: "chess-coach.gpu-feasibility-event.v1" }, { runId: "host-gpu-feasibility-1" }, { sequence: 2 }]) {
    const e = events(), g = progressWatchdog(p, () => 0); e.add("guard-start", change);
    expect(() => g.read(e.get())).toThrow("JOURNAL_EVENT_IDENTITY_OR_ORDER");
  }
  const e = events(), g = progressWatchdog(p, () => 0); e.add("guard-start"); g.read(e.get());
  expect(() => g.read(e.get().replace(p.runId, "foreign"))).toThrow("JOURNAL_BOUND_OR_PREFIX_CHANGED");
});

test("partial lines require final draining and incomplete finalization latches failure", () => {
  const e = events(), g = progressWatchdog(p, () => 0); e.add("guard-start"); g.read(e.get() + '{"sequence":');
  e.add("sample", sample); attempts(e); e.add("done"); expect(g.finish(e.get()).guardComplete).toBe(true);
  const partial = progressWatchdog(p, () => 0); expect(() => partial.finish(e.get() + "{")).toThrow("COMPLETE_DRAINED");
  expect(() => partial.finish(e.get())).toThrow("COMPLETE_DRAINED");
  const missing = events(), incomplete = progressWatchdog(p, () => 0); missing.add("guard-start");
  expect(() => incomplete.finish(missing.get())).toThrow("COMPLETE_DRAINED");
  missing.add("sample", sample); attempts(missing); missing.add("done");
  expect(() => incomplete.finish(missing.get())).toThrow("COMPLETE_DRAINED");
});

test("abort, unknown phases, byte bounds and post-completion events reject the journal", () => {
  const e = events(), aborted = progressWatchdog(p, () => 0); e.add("guard-start"); e.add("abort", { reason: "MOCK_QUERY_FAILED" });
  expect(() => aborted.read(e.get())).toThrow("DRIVER_ABORT:MOCK_QUERY_FAILED");
  for (const kind of ["sample", "attempt-start", "attempt-finish", "done", "unknown"]) {
    const e = events(); e.add(kind, { ...sample, id: fullSelectors[0], ...accepted });
    expect(() => progressWatchdog(p, () => 0).read(e.get())).toThrow();
  }
  const large = events(); large.add("guard-start", { padding: "x".repeat(p.limits.journalBytes) });
  expect(() => progressWatchdog(p, () => 0).read(large.get())).toThrow("JOURNAL_BOUND_OR_PREFIX_CHANGED");
  const complete = events(), g = progressWatchdog(p, () => 0); complete.add("guard-start"); complete.add("sample", sample); attempts(complete); complete.add("done");
  g.finish(complete.get()); complete.add("abort", { reason: "late" }); expect(() => g.read(complete.get())).toThrow("JOURNAL_EVENT_IDENTITY_OR_ORDER");
});

test("watchdog rejects backwards and nonfinite observation clocks", () => {
  for (const next of [-1, NaN]) {
    let clock = 0; const e = events(), g = progressWatchdog(p, () => clock); e.add("guard-start"); g.read(e.get()); clock = next;
    expect(() => g.fresh()).toThrow("WATCHDOG_MONOTONIC_CLOCK_REQUIRED");
  }
});

test("the full runtime watcher drains its last read and reports late abort as owned-stop intent", async () => {
  const { journalWatcher } = await import("./runtime");
  const e = events(), stops: string[] = []; e.add("guard-start"); e.add("sample", sample);
  let closed = false;
  const watcher = journalWatcher(p, { now: () => 0, text: async () => e.get(), abort: async reason => { stops.push(reason); } }, { every: () => 0 as any, cancel: () => { closed = true; } });
  await watcher.scan(); e.add("abort", { reason: "MOCK_LATE_FAILURE" }); await expect(watcher.close()).rejects.toThrow("DRIVER_ABORT");
  expect(stops).toContain("DRIVER_ABORT:MOCK_LATE_FAILURE"); expect(closed).toBe(true);
});

test("reused capture adapter preserves original Docker result and partial metadata without starting a process", async () => {
  const { captureDockerResult } = await import("./runtime");
  for (const original of [{ status: "PASS" as const, exitCode: 0, failure: null }, { status: "FAIL" as const, exitCode: 125, failure: "MOCK_PRIMARY_DEADLINE" }]) {
    const out = await captureDockerResult({ ...original, stdoutBytes: 2, stderrBytes: 3 }, "/source-only-mock", (async (path: string) => {
      if (path.endsWith("stdout")) throw Error("MOCK_CAPTURE_READ"); return Buffer.from("err");
    }) as any);
    expect(out.status).toBe("FAIL"); expect(out.exitCode).toBe(original.exitCode); expect(out.supervisorResult).toEqual(original);
    expect(out.failure).toBe(original.failure ?? "HOST_CAPTURE_FAILED"); expect(out.captureFailures).toHaveLength(1); expect(out.streams).toHaveLength(1);
  }
});
