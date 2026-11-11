// SPEC: _spec/gpu-feasibility.puml
import { expect, test } from "bun:test";
import { feasibilityPlan } from "./plan";
import { makeProgressGuard, parseSample, telemetryArgv } from "./guard";

const p = await feasibilityPlan(), uuid = p.selectedUuid;
const csv = (free = 3072, total = 8192) => `${uuid}, ${free}, ${total}\n`;

test("strict raw CSV and fixed selected-device argv", () => {
  expect(parseSample(csv(), uuid)).toEqual({ uuid, freeBytes: 3221225472, totalBytes: 8589934592 });
  expect(telemetryArgv(p)).toEqual(["nvidia-smi", `--id=${uuid}`, "--query-gpu=uuid,memory.free,memory.total", "--format=csv,noheader,nounits"]);
});

test("rejects fractions, units, negatives, wrong UUID, extra rows, and unsafe memory", () => {
  for (const raw of ["", csv() + csv(), csv() + "\n", csv().replace(uuid, "GPU-other"), csv().replace("3072", "3072.0"),
    csv().replace("3072", "-1"), csv().replace("3072", "3 GiB"), csv().replace("3072", "1e3"), csv(8193), csv(0, 0),
    csv().replace("8192", "9007199254740991"), csv().replace("3072", "Infinity"), `${uuid},3072,8192,1`]) {
    expect(() => parseSample(raw, uuid)).toThrow();
  }
});

test("startup and running equality pass; running below 2 GiB latches", () => {
  let time = 0;
  const guard = makeProgressGuard(p, () => time);
  guard.startQuery(); expect(guard.accept(csv()).freeBytes).toBe(p.guard.startupMinFreeBytes);
  time = 2000; guard.startQuery(); expect(guard.accept(csv(2048)).freeBytes).toBe(p.guard.runningStopBelowFreeBytes);
  time = 4000; guard.startQuery(); expect(() => guard.accept(csv(2047))).toThrow("TELEMETRY_RUNNING_HEADROOM");
  expect(() => guard.startQuery()).toThrow("TELEMETRY_RUNNING_HEADROOM");
});

test("startup below 3 GiB and unstable total fail closed", () => {
  const initial = makeProgressGuard(p, () => 0);
  initial.startQuery(); expect(() => initial.accept(csv(3071))).toThrow("TELEMETRY_STARTUP_HEADROOM");
  let time = 0;
  const guard = makeProgressGuard(p, () => time);
  guard.startQuery(); guard.accept(csv());
  time = 2000; guard.startQuery(); expect(() => guard.accept(csv(3072, 8193))).toThrow("TELEMETRY_TOTAL_CHANGED");
});

test("timestamps use query start and stale equality fails before a late replacement", () => {
  let time = 0;
  const guard = makeProgressGuard(p, () => time);
  guard.startQuery(); time = 1000;
  expect(guard.accept(csv()).queryStartedAtMs).toBe(0);
  time = 3000; guard.startQuery(); time = 4000;
  expect(() => guard.accept(csv())).toThrow("TELEMETRY_SAMPLE_STALE");
  expect(guard.snapshot().sample!.queryStartedAtMs).toBe(0);
});

test("cadence, one in-flight query, query deadline and 150-query cap", () => {
  const single = makeProgressGuard(p, () => 0);
  single.startQuery(); expect(() => single.startQuery()).toThrow("TELEMETRY_SINGLE_FLIGHT_REQUIRED");
  let time = 0;
  const cadence = makeProgressGuard(p, () => time);
  cadence.startQuery(); cadence.accept(csv()); time = 1999;
  expect(() => cadence.startQuery()).toThrow("TELEMETRY_QUERY_CADENCE");
  time = 0;
  const deadline = makeProgressGuard(p, () => time);
  deadline.startQuery(); time = 1001;
  expect(() => deadline.accept(csv())).toThrow("TELEMETRY_QUERY_DEADLINE");
  time = 0;
  const bounded = makeProgressGuard(p, () => time);
  for (let index = 0; index < 150; index++) { time = index * 2000; bounded.startQuery(); bounded.accept(csv()); }
  time += 2000; expect(() => bounded.startQuery()).toThrow("TELEMETRY_QUERY_COUNT_BOUND");
});

test("clock regression fails and a prior failure never clears", () => {
  let time = 10;
  const guard = makeProgressGuard(p, () => time);
  guard.startQuery(); time = 9;
  expect(() => guard.check()).toThrow("GUARD_MONOTONIC_CLOCK_REQUIRED");
  time = 10; expect(() => guard.accept(csv())).toThrow("GUARD_MONOTONIC_CLOCK_REQUIRED");
});
