// SPEC: _spec/gpu-feasibility.puml
import { expect, test } from "bun:test";
import { feasibilityPlan, feasibilitySelectors } from "./plan";
import { progressWatchdog } from "./watchdog";
import { captureDockerResult, journalWatcher } from "./runtime";

const p = await feasibilityPlan();
function events() {
  let sequence = 0, text = "";
  return { add: (kind: string, data = {}) => text += JSON.stringify({ version: "chess-coach.gpu-feasibility-event.v1", runId: p.runId, sequence: ++sequence, kind, ...data }) + "\n", get: () => text };
}
const sample = { uuid: p.selectedUuid, freeBytes: 3221225472, totalBytes: 8589934592, queryStartedMs: 0 };

test("the independent watchdog accepts exactly two ordered attempts and a drained guard", () => {
  let clock = 0; const e = events(), g = progressWatchdog(p, () => clock);
  e.add("guard-start"); e.add("sample", sample); g.read(e.get()); clock = 2000; e.add("sample", { ...sample, freeBytes: 2147483648 }); g.read(e.get());
  for (const id of feasibilitySelectors) { e.add("attempt-start", { id }); e.add("attempt-finish", { id }); }
  e.add("done"); expect(g.finish(e.get()).guardComplete).toBe(true);
});

test("a replacement cannot rejuvenate stale progress at the exact age boundary", () => {
  let clock = 0; const e = events(), g = progressWatchdog(p, () => clock);
  e.add("guard-start"); e.add("sample", sample); g.read(e.get()); clock = 4000; e.add("sample", sample);
  expect(() => g.read(e.get())).toThrow("GPU_SAMPLE_PROGRESS_STALE"); clock = 4001; expect(() => g.read(e.get())).toThrow("GPU_SAMPLE_PROGRESS_STALE");
});

for (const [name, mutate] of [
  ["wrong UUID", (e: any) => { e.uuid = "GPU-other"; }], ["low startup headroom", (e: any) => { e.freeBytes--; }],
  ["invalid total", (e: any) => { e.totalBytes = 1; }], ["fractional bytes", (e: any) => { e.freeBytes += 0.5; }],
] as const) test("watchdog rejects " + name, () => {
  const e = events(), g = progressWatchdog(p, () => 0), row = { ...sample }; mutate(row);
  e.add("guard-start"); e.add("sample", row); expect(() => g.read(e.get())).toThrow();
});

test("journal identity, prefix, partial lines, completion and abort stay fail closed", () => {
  const e = events(), g = progressWatchdog(p, () => 0); e.add("guard-start"); g.read(e.get() + '{"sequence":');
  expect(() => g.read(e.get().replace(p.runId, "foreign"))).toThrow();
  const h = progressWatchdog(p, () => 0); expect(() => h.finish(e.get())).toThrow("COMPLETE_DRAINED");
  const a = events(), abort = progressWatchdog(p, () => 0); a.add("guard-start"); a.add("abort", { reason: "MOCK_QUERY_FAILED" });
  expect(() => abort.read(a.get())).toThrow("DRIVER_ABORT:MOCK_QUERY_FAILED");
});

test("the runtime watcher drains its last read and turns a late abort into owned-stop intent", async () => {
  const e = events(), stops: string[] = []; e.add("guard-start"); e.add("sample", sample);
  let closed = false;
  const watcher = journalWatcher(p, { now: () => 0, text: async () => e.get(), abort: async reason => { stops.push(reason); } }, { every: () => 0 as any, cancel: () => { closed = true; } });
  await watcher.scan(); e.add("abort", { reason: "MOCK_LATE_FAILURE" }); await expect(watcher.close()).rejects.toThrow("DRIVER_ABORT");
  expect(stops).toContain("DRIVER_ABORT:MOCK_LATE_FAILURE"); expect(closed).toBe(true);
});

test("capture failure preserves the original Docker result, primary cause and partial metadata", async () => {
  for (const original of [{ status: "PASS" as const, exitCode: 0, failure: null }, { status: "FAIL" as const, exitCode: 125, failure: "MOCK_PRIMARY_DEADLINE" }]) {
    const out = await captureDockerResult({ ...original, stdoutBytes: 2, stderrBytes: 3 }, "/source-only-mock", (async (path: string) => {
      if (path.endsWith("stdout")) throw Error("MOCK_CAPTURE_READ"); return Buffer.from("err");
    }) as any);
    expect(out.status).toBe("FAIL"); expect(out.exitCode).toBe(original.exitCode); expect(out.supervisorResult).toEqual(original);
    expect(out.failure).toBe(original.failure ?? "HOST_CAPTURE_FAILED"); expect(out.captureFailures).toHaveLength(1); expect(out.streams).toHaveLength(1);
  }
});
