// SPEC: _spec/gpu-cooperative-policy.md
import { expect, test } from "bun:test";
import { CooperativeGpuPolicy, type GpuPolicyDecision } from "../../../tooling/runtime/gpu-policy";
import fixture from "../../../tooling/runtime/fixtures/gpu-policy-traces.json";

type TraceCall = {
  method: "admit" | "observe" | "check";
  nowNs: unknown;
  sample?: unknown;
  expected: Record<string, unknown>;
};
type TraceCase = {
  name: string;
  group: "policy" | "range" | "clock";
  configuration: unknown;
  originalS0Ns: unknown;
  calls: TraceCall[];
};

const traces = fixture as unknown as { version: string; cases: TraceCase[] };
const configurationIntegers = ["startupMinFreeBytes", "runningStopBelowFreeBytes", "samplePeriodNs", "maxSampleAgeNs"];
const sampleIntegers = ["freeBytes", "totalBytes", "observedBoottimeNs"];

function integer(value: unknown): unknown {
  return typeof value === "string" && /^-?[0-9]+$/.test(value) ? BigInt(value) : value;
}

function fields(value: unknown, integers: readonly string[]): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, integers.includes(key) ? integer(field) : field]));
}

function project(decision: GpuPolicyDecision): unknown {
  return JSON.parse(JSON.stringify(decision, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value));
}

test("shared fixture has 33 unique closed traces with the portable v1 schema", () => {
  expect(Object.keys(traces).sort()).toEqual(["cases", "version"]);
  expect(traces.version).toBe("chess-coach.gpu-policy-conformance.v1");
  expect(traces.cases).toHaveLength(33);
  expect(new Set(traces.cases.map(trace => trace.name)).size).toBe(33);
  expect([...new Set(traces.cases.map(trace => trace.group))].sort()).toEqual(["clock", "policy", "range"]);
  for (const trace of traces.cases) {
    expect(Object.keys(trace).sort()).toEqual(["calls", "configuration", "group", "name", "originalS0Ns"]);
    expect(trace.name).toMatch(/^[a-z][a-z0-9_]+$/);
    expect(trace.calls.length).toBeGreaterThan(0);
    for (const call of trace.calls) {
      expect(Object.keys(call).sort()).toEqual("sample" in call ? ["expected", "method", "nowNs", "sample"] : ["expected", "method", "nowNs"]);
      expect(["admit", "observe", "check"]).toContain(call.method);
      const expectedKeys = call.expected.kind === "admit" || call.expected.kind === "continue" ? ["kind", "nextCheckNs"]
        : call.expected.kind === "abort-owned" ? ["cleanupDeadlineNs", "kind", "reason"] : ["kind", "reason"];
      expect(Object.keys(call.expected).sort()).toEqual(expectedKeys);
      const kind = call.expected.kind;
      if (typeof kind !== "string") throw Error("EXPECTED_DECISION_KIND");
      expect(["admit", "continue", "reject", "abort-owned", "terminal"]).toContain(kind);
      for (const key of ["nextCheckNs", "cleanupDeadlineNs"]) if (key in call.expected) expect(call.expected[key]).toMatch(/^[0-9]+$/);
    }
  }
});

test("portable conversion preserves raw numbers, invalid values, and unknown fields", () => {
  for (const value of [0, -1, 100, null, true, "1.0", "1e2", " 1", "", "0x10", "--1"]) expect(integer(value)).toBe(value);
  expect(integer("-1")).toBe(-1n);
  expect(integer("9223372036854775808")).toBe(9_223_372_036_854_775_808n);
  expect(fields({ freeBytes: "-1", totalBytes: "0", observedBoottimeNs: "9223372036854775808" }, sampleIntegers))
    .toEqual({ freeBytes: -1n, totalBytes: 0n, observedBoottimeNs: 9_223_372_036_854_775_808n });
  expect(fields({ freeBytes: "1", totalBytes: 2, observedBoottimeNs: "-1", uuid: "123", extra: "3" }, sampleIntegers))
    .toEqual({ freeBytes: 1n, totalBytes: 2, observedBoottimeNs: -1n, uuid: "123", extra: "3" });
  expect(fields(null, sampleIntegers)).toBeNull();
  expect(fields(["1"], sampleIntegers)).toEqual(["1"]);
});

for (const trace of traces.cases) {
  test(`shared ${trace.group}: ${trace.name}`, () => {
    const policy = new CooperativeGpuPolicy(fields(trace.configuration, configurationIntegers), integer(trace.originalS0Ns) as bigint);
    let admissions = 0, aborts = 0;
    for (const call of trace.calls) {
      const nowNs = integer(call.nowNs) as bigint;
      const decision = call.method === "check" ? policy.check(nowNs)
        : policy[call.method](nowNs, fields(call.sample, sampleIntegers));
      expect(project(decision)).toEqual(call.expected);
      expect(Object.isFrozen(decision)).toBe(true);
      if (decision.kind === "admit") admissions++;
      if (decision.kind === "abort-owned") aborts++;
    }
    expect(admissions).toBeLessThanOrEqual(1);
    expect(aborts).toBeLessThanOrEqual(1);
    expect(aborts).toBeLessThanOrEqual(admissions);
  });
}
