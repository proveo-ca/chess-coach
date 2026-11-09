// SPEC: _spec/gpu-cooperative-policy.md
import { expect, test } from "bun:test";
import { CooperativeGpuPolicy, type CooperativePolicy, type GpuPolicyDecision, type GpuPolicyFailure, type GpuSample } from "../../../tooling/runtime/gpu-policy";

const UUID = "GPU-12345678-1234-1234-1234-123456789abc";
const I64_MAX = 9_223_372_036_854_775_807n;
const CLEANUP_NS = 300_000_000_000n;

function configuration(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { selectedUuid: UUID, startupMinFreeBytes: 1000n, runningStopBelowFreeBytes: 500n, samplePeriodNs: 100n, maxSampleAgeNs: 200n, ...overrides };
}

function sample(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { uuid: UUID, freeBytes: 1000n, totalBytes: 2000n, observedBoottimeNs: 0n, ...overrides };
}

function failure(kind: "reject" | "abort-owned" | "terminal", reason: GpuPolicyFailure, origin = 0n): GpuPolicyDecision {
  return kind === "abort-owned" ? { kind, reason, cleanupDeadlineNs: origin + CLEANUP_NS } : { kind, reason };
}

function invalidShapes(base: Record<string, unknown>): [string, unknown][] {
  const entries: [string, unknown][] = [
    ["undefined", undefined], ["null", null], ["number", 1], ["bigint", 1n], ["boolean", true], ["string", "object"],
    ["symbol", Symbol("object")], ["function", () => base], ["array", []], ["array with fields", Object.assign([], base)],
    ["date with fields", Object.assign(new Date(0), base)], ["boxed string with fields", Object.assign(new String(""), base)],
    ["custom prototype", Object.assign(Object.create({}), base)],
    ["inherited fields", Object.create(base)], ["empty", {}], ["unknown", { ...base, extra: true }],
    ["hidden unknown", Object.defineProperty({ ...base }, "extra", { value: true })], ["symbol key", { ...base, [Symbol("extra")]: true }],
  ];
  for (const key of Object.keys(base)) {
    const missing = { ...base };
    delete missing[key];
    entries.push([`missing ${key}`, missing]);
    entries.push([`inherited ${key}`, Object.assign(Object.create({ [key]: base[key] }), missing)]);
    entries.push([`accessor ${key}`, Object.defineProperty({ ...base }, key, { get() { throw Error("GETTER_EXECUTED"); } })]);
    entries.push([`setter ${key}`, Object.defineProperty({ ...base }, key, { set(_value: unknown) { throw Error("SETTER_EXECUTED"); } })]);
  }
  for (const [label, input] of [...entries]) {
    if (typeof input === "object" && input !== null && Object.getPrototypeOf(input) === Object.prototype) {
      entries.push([`null prototype ${label}`, Object.create(null, Object.getOwnPropertyDescriptors(input))]);
    }
  }
  return entries;
}

test.each(invalidShapes(configuration()))("configuration rejects exact-object violation: %s", (_name, input) => {
  const policy = new CooperativeGpuPolicy(input, -1n);
  expect(policy.admit(-1n, null)).toEqual(failure("reject", "CONFIGURATION"));
  expect(policy.check(0n)).toEqual(failure("terminal", "CONFIGURATION"));
});

test.each(invalidShapes(sample()))("telemetry rejects exact-object violation: %s", (_name, input) => {
  const policy = new CooperativeGpuPolicy(configuration(), 0n);
  expect(policy.admit(0n, input)).toEqual(failure("reject", "TELEMETRY"));
  expect(policy.admit(0n, sample())).toEqual(failure("terminal", "TELEMETRY"));
});

const invalidIntegerValues: unknown[] = [-1n, I64_MAX + 1n, 1, 1.5, NaN, Infinity, "1", null, undefined, true, {}, Object(1n)];
for (const key of ["startupMinFreeBytes", "runningStopBelowFreeBytes", "samplePeriodNs", "maxSampleAgeNs"]) {
  test.each(invalidIntegerValues.map((value, index) => [String(index), value] as const))(`configuration ${key} rejects invalid integer %s`, (_name, value) => {
    const policy = new CooperativeGpuPolicy(configuration({ [key]: value }), 0n);
    expect(policy.check(0n)).toEqual(failure("reject", "CONFIGURATION"));
  });
}

test.each([
  { startupMinFreeBytes: 0n }, { runningStopBelowFreeBytes: 0n }, { samplePeriodNs: 0n }, { maxSampleAgeNs: 0n },
  { runningStopBelowFreeBytes: 1001n }, { samplePeriodNs: 201n },
])("configuration rejects zero and inconsistent positive bounds: %p", overrides => {
  expect(new CooperativeGpuPolicy(configuration(overrides), 0n).admit(0n, sample())).toEqual(failure("reject", "CONFIGURATION"));
});

test.each(["", "GPU-0", UUID.toLowerCase(), UUID.slice(0, -1), UUID + "0", UUID + "\n", " " + UUID, UUID.replace("abc", "abg"), 1, null])
  ("configuration rejects noncanonical GPU identity: %p", selectedUuid => {
    expect(new CooperativeGpuPolicy(configuration({ selectedUuid }), 0n).admit(0n, sample())).toEqual(failure("reject", "CONFIGURATION"));
  });

test.each([UUID, UUID.toUpperCase(), "GPU-aBcDeF12-3456-7890-aBcD-1234567890aB"])("UUID accepts hex case without normalization: %s", selectedUuid => {
  expect(new CooperativeGpuPolicy(configuration({ selectedUuid }), 0n).admit(0n, sample({ uuid: selectedUuid }))).toEqual({ kind: "admit", nextCheckNs: 100n });
  expect(new CooperativeGpuPolicy(configuration({ selectedUuid }), 0n).admit(0n, sample({ uuid: "GPU-00000000-0000-0000-0000-000000000000" })))
    .toEqual(failure("reject", "DEVICE"));
});

test.each(["", "GPU-0", UUID.toLowerCase(), UUID.slice(0, -1), UUID + "0", UUID + "\n", " " + UUID, UUID.replace("abc", "abg")])
  ("sample shape rejects noncanonical GPU identity before device comparison: %p", uuid => {
    expect(new CooperativeGpuPolicy(configuration(), 0n).admit(0n, sample({ uuid }))).toEqual(failure("reject", "TELEMETRY"));
  });

for (const [label, decorate] of [
  ["null prototype", (value: Record<string, unknown>) => Object.assign(Object.create(null), value)],
  ["frozen", (value: Record<string, unknown>) => Object.freeze(value)],
  ["sealed", (value: Record<string, unknown>) => Object.seal(value)],
  ["nonenumerable data", (value: Record<string, unknown>) => Object.defineProperties({}, Object.fromEntries(Object.entries(value).map(([key, field]) => [key, { value: field }])))]
] as const) {
  test(`plain ${label} inputs retain valid own data fields`, () => {
    const policy = new CooperativeGpuPolicy(decorate(configuration()), 0n);
    expect(policy.admit(0n, decorate(sample()))).toEqual({ kind: "admit", nextCheckNs: 100n });
  });
}

test.each([
  ["ordinary configuration and ordinary samples", false, false],
  ["null-prototype configuration and ordinary samples", true, false],
  ["ordinary configuration and null-prototype samples", false, true],
  ["null-prototype configuration and null-prototype samples", true, true],
] as const)("exact data fields admit and refresh with copied snapshots: %s", (_label, nullConfiguration, nullSamples) => {
  const input = nullConfiguration ? Object.assign(Object.create(null), configuration()) : configuration();
  const initial = nullSamples ? Object.assign(Object.create(null), sample()) : sample();
  const policy = new CooperativeGpuPolicy(input, 0n);
  input.samplePeriodNs = 1n;
  input.selectedUuid = "wrong";
  expect(policy.admit(0n, initial)).toEqual({ kind: "admit", nextCheckNs: 100n });
  initial.observedBoottimeNs = I64_MAX;
  initial.totalBytes = 0n;
  const replacement = sample({ freeBytes: 500n, observedBoottimeNs: 99n });
  const observed = policy.observe(99n, nullSamples ? Object.assign(Object.create(null), replacement) : replacement);
  expect(observed).toEqual({ kind: "continue", nextCheckNs: 199n });
  expect(Object.isFrozen(observed)).toBe(true);
  expect(policy.check(198n)).toEqual({ kind: "continue", nextCheckNs: 199n });
  expect(policy.check(199n)).toEqual(failure("abort-owned", "MISSED_SAMPLE"));
});

test("configuration and samples are copied without freezing or retaining caller objects", () => {
  const input = configuration(), initial = sample();
  const policy = new CooperativeGpuPolicy(input, 0n);
  input.selectedUuid = "wrong";
  input.runningStopBelowFreeBytes = I64_MAX;
  input.samplePeriodNs = 1n;
  const admitted = policy.admit(0n, initial);
  expect(admitted).toEqual({ kind: "admit", nextCheckNs: 100n });
  initial.totalBytes = 1n;
  initial.observedBoottimeNs = I64_MAX;
  expect(policy.check(99n)).toEqual({ kind: "continue", nextCheckNs: 100n });
  const replacement = sample({ freeBytes: 500n, observedBoottimeNs: 99n });
  expect(policy.observe(99n, replacement)).toEqual({ kind: "continue", nextCheckNs: 199n });
  replacement.totalBytes = 1n;
  replacement.observedBoottimeNs = 0n;
  expect(policy.check(198n)).toEqual({ kind: "continue", nextCheckNs: 199n });
  expect(policy.observe(198n, sample({ freeBytes: 500n, observedBoottimeNs: 198n }))).toEqual({ kind: "continue", nextCheckNs: 298n });
  expect(Object.isFrozen(input)).toBe(false);
  expect(Object.isFrozen(initial)).toBe(false);
  expect(Object.isFrozen(replacement)).toBe(false);
  expect(Object.isFrozen(admitted)).toBe(true);
  expect(Reflect.set(admitted, "kind", "terminal")).toBe(false);
});

test.each([undefined, null, -1n, I64_MAX - CLEANUP_NS + 1n, I64_MAX + 1n, 0, NaN, "0", {}])("invalid origin precedes clock and method: %p", origin => {
  const policy = new CooperativeGpuPolicy(configuration(), origin as bigint);
  expect(policy.observe(-1n, null)).toEqual(failure("reject", "ORIGIN"));
  expect(policy.admit(0n, sample())).toEqual(failure("terminal", "ORIGIN"));
});

test.each([undefined, null, -1n, I64_MAX + 1n, 0, 0.5, NaN, Infinity, "0", {}, Object(0n)])("invalid now rejects before method or telemetry: %p", nowNs => {
  const policy = new CooperativeGpuPolicy(configuration(), 0n);
  expect(policy.observe(nowNs as bigint, null)).toEqual(failure("reject", "CLOCK"));
  expect(policy.check(0n)).toEqual(failure("terminal", "CLOCK"));
});

test.each([undefined, null, -1n, I64_MAX + 1n, 0, 0.5, NaN, Infinity, "0", {}, Object(0n)])("running invalid now aborts once: %p", nowNs => {
  const policy = new CooperativeGpuPolicy(configuration(), 0n);
  expect(policy.admit(0n, sample()).kind).toBe("admit");
  expect(policy.observe(nowNs as bigint, null)).toEqual(failure("abort-owned", "CLOCK"));
  expect(policy.observe(1n, sample({ observedBoottimeNs: 1n }))).toEqual(failure("terminal", "CLOCK"));
});

for (const key of ["uuid", "freeBytes", "totalBytes", "observedBoottimeNs"]) {
  const values = key === "uuid" ? [null, undefined, 1, {}, Object(UUID)] : [null, undefined, 1, 1.5, NaN, Infinity, "1", {}, Object(1n)];
  test.each(values.map((value, index) => [String(index), value] as const))(`sample ${key} rejects nonprimitive or wrong type %s`, (_name, value) => {
    expect(new CooperativeGpuPolicy(configuration(), 0n).admit(0n, sample({ [key]: value }))).toEqual(failure("reject", "TELEMETRY"));
  });
}

test.each([
  { totalBytes: 0n }, { totalBytes: -1n }, { totalBytes: I64_MAX + 1n }, { freeBytes: -1n },
  { freeBytes: I64_MAX + 1n }, { freeBytes: 2001n },
])("telemetry shape rejects invalid capacity range or consistency: %p", overrides => {
  expect(new CooperativeGpuPolicy(configuration(), 0n).admit(0n, sample(overrides))).toEqual(failure("reject", "TELEMETRY"));
});

test("valid-shaped capacity below startup threshold fails capacity before headroom", () => {
  expect(new CooperativeGpuPolicy(configuration(), 0n).admit(0n, sample({ freeBytes: 999n, totalBytes: 999n })))
    .toEqual(failure("reject", "CAPACITY"));
});

test.each([-1n, I64_MAX + 1n])("telemetry shape rejects out-of-range sample time: %p", observedBoottimeNs => {
  expect(new CooperativeGpuPolicy(configuration(), 0n).admit(0n, sample({ observedBoottimeNs, totalBytes: 0n })))
    .toEqual(failure("reject", "TELEMETRY"));
});

test("valid-shaped future sample time precedes capacity", () => {
  expect(new CooperativeGpuPolicy(configuration(), 0n).admit(0n, sample({ observedBoottimeNs: 1n, freeBytes: 999n, totalBytes: 999n })))
    .toEqual(failure("reject", "SAMPLE_TIME"));
});

const mixedInvalidSamples: [string, Record<string, unknown>][] = [
  ["negative free before device and future time", { uuid: "GPU-00000000-0000-0000-0000-000000000000", freeBytes: -1n, observedBoottimeNs: 2n }],
  ["free above total before future time", { freeBytes: 2001n, observedBoottimeNs: 2n }],
  ["zero total before device", { uuid: "GPU-00000000-0000-0000-0000-000000000000", totalBytes: 0n, freeBytes: 0n, observedBoottimeNs: 1n }],
  ["negative total before future time", { totalBytes: -1n, freeBytes: 0n, observedBoottimeNs: 2n }],
  ["out-of-i64 total before device", { uuid: "GPU-00000000-0000-0000-0000-000000000000", totalBytes: I64_MAX + 1n, observedBoottimeNs: 1n }],
  ["out-of-i64 free before future time", { freeBytes: I64_MAX + 1n, totalBytes: I64_MAX, observedBoottimeNs: 2n }],
  ["negative time before device and threshold capacity", { uuid: "GPU-00000000-0000-0000-0000-000000000000", observedBoottimeNs: -1n, freeBytes: 999n, totalBytes: 999n }],
  ["out-of-i64 time before device and threshold capacity", { uuid: "GPU-00000000-0000-0000-0000-000000000000", observedBoottimeNs: I64_MAX + 1n, freeBytes: 999n, totalBytes: 999n }],
  ["malformed UUID before future time and capacity", { uuid: "wrong", observedBoottimeNs: 2n, freeBytes: 999n, totalBytes: 999n }],
  ["lowercase prefix before sample order and capacity", { uuid: UUID.toLowerCase(), observedBoottimeNs: 0n, freeBytes: 999n, totalBytes: 999n }],
  ["trailing UUID newline before future time and capacity", { uuid: UUID + "\n", observedBoottimeNs: 2n, freeBytes: 999n, totalBytes: 999n }],
  ["invalid capacity before sample order", { freeBytes: 1n, totalBytes: 0n, observedBoottimeNs: 0n }],
];

for (const state of ["awaiting", "running"] as const) {
  test.each(mixedInvalidSamples)(`${state} telemetry shape precedes mixed invalidity: %s`, (_label, overrides) => {
    const policy = new CooperativeGpuPolicy(configuration(), 0n);
    if (state === "running") expect(policy.admit(0n, sample()).kind).toBe("admit");
    const decision = state === "running" ? policy.observe(1n, sample(overrides)) : policy.admit(1n, sample(overrides));
    expect(decision).toEqual(failure(state === "running" ? "abort-owned" : "reject", "TELEMETRY"));
    expect(policy.admit(0n, sample())).toEqual(failure("terminal", "TELEMETRY"));
    expect(policy.check(-1n)).toEqual(failure("terminal", "TELEMETRY"));
  });

  test(`${state} valid-shaped different device precedes sample time and capacity`, () => {
    const policy = new CooperativeGpuPolicy(configuration(), 0n);
    if (state === "running") expect(policy.admit(0n, sample()).kind).toBe("admit");
    const input = sample({ uuid: "GPU-00000000-0000-0000-0000-000000000000", observedBoottimeNs: 2n, freeBytes: 999n, totalBytes: 999n });
    const decision = state === "running" ? policy.observe(1n, input) : policy.admit(1n, input);
    expect(decision).toEqual(failure(state === "running" ? "abort-owned" : "reject", "DEVICE"));
  });
}

test("running valid-shaped future time precedes stable-total capacity", () => {
  const policy = new CooperativeGpuPolicy(configuration(), 0n);
  expect(policy.admit(0n, sample()).kind).toBe("admit");
  expect(policy.observe(1n, sample({ observedBoottimeNs: 2n, freeBytes: 999n, totalBytes: 999n }))).toEqual(failure("abort-owned", "SAMPLE_TIME"));
});

test("valid-shaped below-origin time precedes capacity", () => {
  expect(new CooperativeGpuPolicy(configuration(), 100n).admit(100n, sample({ observedBoottimeNs: 99n, freeBytes: 999n, totalBytes: 999n })))
    .toEqual(failure("reject", "SAMPLE_TIME"));
});

test("valid-shaped threshold capacity precedes freshness and cadence", () => {
  expect(new CooperativeGpuPolicy(configuration(), 0n).admit(200n, sample({ freeBytes: 999n, totalBytes: 999n })))
    .toEqual(failure("reject", "CAPACITY"));
});

test("minimum positive and maximum signed-i64 capacity boundaries pass", () => {
  const minimum: CooperativePolicy = { selectedUuid: UUID, startupMinFreeBytes: 1n, runningStopBelowFreeBytes: 1n, samplePeriodNs: 1n, maxSampleAgeNs: 1n };
  const initial: GpuSample = { uuid: UUID, freeBytes: 1n, totalBytes: 1n, observedBoottimeNs: 0n };
  expect(new CooperativeGpuPolicy(minimum, 0n).admit(0n, initial)).toEqual({ kind: "admit", nextCheckNs: 1n });
  expect(new CooperativeGpuPolicy(configuration({ startupMinFreeBytes: I64_MAX, runningStopBelowFreeBytes: I64_MAX }), 0n)
    .admit(0n, sample({ freeBytes: I64_MAX, totalBytes: I64_MAX }))).toEqual({ kind: "admit", nextCheckNs: 100n });
});

test("zero free bytes is valid capacity but fails positive headroom", () => {
  expect(new CooperativeGpuPolicy(configuration(), 0n).admit(0n, sample({ freeBytes: 0n }))).toEqual(failure("reject", "HEADROOM"));
});

test.each([10n, 9n])("running repeated or regressed sample fails before capacity: %p", observedBoottimeNs => {
  const policy = new CooperativeGpuPolicy(configuration(), 0n);
  expect(policy.admit(10n, sample({ observedBoottimeNs: 10n })).kind).toBe("admit");
  expect(policy.observe(11n, sample({ observedBoottimeNs, freeBytes: 999n, totalBytes: 999n }))).toEqual(failure("abort-owned", "SAMPLE_ORDER"));
});

test("unchanged caller time permits a strictly increasing delayed sample", () => {
  const policy = new CooperativeGpuPolicy(configuration(), 0n);
  expect(policy.admit(10n, sample()).kind).toBe("admit");
  expect(policy.observe(10n, sample({ observedBoottimeNs: 1n }))).toEqual({ kind: "continue", nextCheckNs: 101n });
  expect(policy.check(10n)).toEqual({ kind: "continue", nextCheckNs: 101n });
  expect(policy.observe(9n, sample({ observedBoottimeNs: 2n }))).toEqual(failure("abort-owned", "CLOCK"));
});

test.each([1999n, 2001n])("accepted total cannot change up or down: %p", totalBytes => {
  const policy = new CooperativeGpuPolicy(configuration(), 0n);
  expect(policy.admit(0n, sample()).kind).toBe("admit");
  expect(policy.observe(1n, sample({ totalBytes, observedBoottimeNs: 1n }))).toEqual(failure("abort-owned", "CAPACITY"));
});

for (const [age, at, reason] of [[200n, 100n, "MISSED_SAMPLE"], [100n, 100n, "STALE_SAMPLE"], [200n, 200n, "STALE_SAMPLE"]] as const) {
  test(`old expiry ${reason} at ${at} wins over replacement inspection`, () => {
    let traps = 0;
    const input = new Proxy({}, { getPrototypeOf() { traps++; throw Error("TRAP"); } });
    const policy = new CooperativeGpuPolicy(configuration({ maxSampleAgeNs: age }), 0n);
    expect(policy.admit(0n, sample()).kind).toBe("admit");
    expect(policy.observe(at, input)).toEqual(failure("abort-owned", reason));
    expect(policy.observe(at, sample({ observedBoottimeNs: at }))).toEqual(failure("terminal", reason));
    expect(traps).toBe(0);
  });
}

test("old lease remains authoritative when new sample has a better deadline", () => {
  const policy = new CooperativeGpuPolicy(configuration(), 0n);
  expect(policy.admit(0n, sample()).kind).toBe("admit");
  expect(policy.observe(100n, sample({ observedBoottimeNs: 100n }))).toEqual(failure("abort-owned", "MISSED_SAMPLE"));
});

test("absolute deadlines retain the nonzero original origin and wide arithmetic", () => {
  const origin = I64_MAX - CLEANUP_NS;
  const policy = new CooperativeGpuPolicy(configuration({ samplePeriodNs: I64_MAX, maxSampleAgeNs: I64_MAX }), origin);
  expect(policy.admit(origin + 9_999_999_999n, sample({ observedBoottimeNs: origin }))).toEqual({ kind: "admit", nextCheckNs: I64_MAX - 3_000_000_000n });
  expect(policy.observe(I64_MAX - 3_000_000_001n, sample({ observedBoottimeNs: I64_MAX - 3_000_000_001n })))
    .toEqual({ kind: "continue", nextCheckNs: I64_MAX - 3_000_000_000n });
  expect(policy.check(I64_MAX - 3_000_000_000n)).toEqual({ kind: "abort-owned", reason: "WORK_DEADLINE", cleanupDeadlineNs: I64_MAX });
});

test("nonzero-origin cold equality rejects without renewing admission", () => {
  const policy = new CooperativeGpuPolicy(configuration(), 99n);
  expect(policy.admit(10_000_000_099n, null)).toEqual(failure("reject", "COLD_DEADLINE"));
  expect(policy.admit(99n, sample({ observedBoottimeNs: 99n }))).toEqual(failure("terminal", "COLD_DEADLINE"));
});

function trapCanary(target: object, onTrap: () => void): object {
  const hit = () => { onTrap(); throw Error("PROXY_TRAP_EXECUTED"); };
  return new Proxy(target, { get: hit, getPrototypeOf: hit, ownKeys: hit, getOwnPropertyDescriptor: hit, has: hit,
    isExtensible: hit, preventExtensions: hit, set: hit, defineProperty: hit, deleteProperty: hit, setPrototypeOf: hit });
}

test.each(["object", "null prototype", "array", "function"])("native Proxy rejection precedes every configuration trap: %s", shape => {
  let traps = 0;
  const target = shape === "array" ? [] : shape === "function" ? () => {}
    : shape === "null prototype" ? Object.assign(Object.create(null), configuration()) : configuration();
  const policy = new CooperativeGpuPolicy(trapCanary(target, () => { traps++; }), -1n);
  expect(policy.admit(-1n, null)).toEqual(failure("reject", "CONFIGURATION"));
  expect(policy.check(0n)).toEqual(failure("terminal", "CONFIGURATION"));
  expect(traps).toBe(0);
});

test("revoked proxies reject without reflection or exceptions at both boundaries", () => {
  const configProxy = Proxy.revocable(configuration(), {}), sampleProxy = Proxy.revocable(sample(), {});
  configProxy.revoke(); sampleProxy.revoke();
  expect(new CooperativeGpuPolicy(configProxy.proxy, 0n).check(0n)).toEqual(failure("reject", "CONFIGURATION"));
  const policy = new CooperativeGpuPolicy(configuration(), 0n);
  expect(policy.admit(0n, sampleProxy.proxy)).toEqual(failure("reject", "TELEMETRY"));
  expect(policy.observe(0n, sampleProxy.proxy)).toEqual(failure("terminal", "TELEMETRY"));
  const running = new CooperativeGpuPolicy(configuration(), 0n);
  expect(running.admit(0n, sample()).kind).toBe("admit");
  expect(running.observe(1n, sampleProxy.proxy)).toEqual(failure("abort-owned", "TELEMETRY"));
});

test.each(["proxy", "getter"])("startup %s cannot reenter check or admit after rejection", kind => {
  let invocations = 0;
  const nested: GpuPolicyDecision[] = [];
  const policy = new CooperativeGpuPolicy(configuration(), 0n);
  const reenter = () => {
    invocations++;
    nested.push(policy.check(0n));
    nested.push(policy.admit(0n, sample()));
  };
  const input = kind === "proxy" ? trapCanary(sample(), reenter)
    : Object.defineProperty(sample(), "freeBytes", { get() { reenter(); return 1000n; } });
  expect(policy.admit(0n, input)).toEqual(failure("reject", "TELEMETRY"));
  expect(policy.admit(0n, sample())).toEqual(failure("terminal", "TELEMETRY"));
  expect(policy.check(0n)).toEqual(failure("terminal", "TELEMETRY"));
  expect(invocations).toBe(0);
  expect(nested).toEqual([]);
});

test.each(["proxy", "getter"])("running %s cannot consume the only abort action by reentry", kind => {
  let invocations = 0;
  const nested: GpuPolicyDecision[] = [];
  const policy = new CooperativeGpuPolicy(configuration(), 7n);
  expect(policy.admit(7n, sample({ observedBoottimeNs: 7n })).kind).toBe("admit");
  const reenter = () => {
    invocations++;
    nested.push(policy.check(107n));
    nested.push(policy.admit(8n, sample({ observedBoottimeNs: 8n })));
  };
  const input = kind === "proxy" ? trapCanary(sample({ observedBoottimeNs: 8n }), reenter)
    : Object.defineProperty(sample({ observedBoottimeNs: 8n }), "freeBytes", { get() { reenter(); return 1000n; } });
  const decision = policy.observe(8n, input);
  expect(decision).toEqual(failure("abort-owned", "TELEMETRY", 7n));
  expect(Object.isFrozen(decision)).toBe(true);
  expect(policy.check(8n)).toEqual(failure("terminal", "TELEMETRY"));
  expect(policy.observe(8n, sample({ observedBoottimeNs: 8n }))).toEqual(failure("terminal", "TELEMETRY"));
  expect(invocations).toBe(0);
  expect(nested).toEqual([]);
});

test("terminal state and initial failure never inspect clock or telemetry objects", () => {
  let invocations = 0;
  const hostile = trapCanary({}, () => { invocations++; });
  const policy = new CooperativeGpuPolicy(null, hostile as unknown as bigint);
  const rejected = policy.admit(hostile as unknown as bigint, hostile);
  expect(rejected).toEqual(failure("reject", "CONFIGURATION"));
  expect(Object.isFrozen(rejected)).toBe(true);
  for (const decision of [policy.admit(hostile as unknown as bigint, hostile), policy.observe(hostile as unknown as bigint, hostile), policy.check(hostile as unknown as bigint)]) {
    expect(decision).toEqual(failure("terminal", "CONFIGURATION"));
    expect(Object.isFrozen(decision)).toBe(true);
  }
  expect(invocations).toBe(0);
});

test("no bigint or identity validation coerces caller values", () => {
  let invocations = 0;
  const coercible = { [Symbol.toPrimitive]() { invocations++; throw Error("COERCION"); }, toString() { invocations++; throw Error("COERCION"); } };
  expect(new CooperativeGpuPolicy(configuration({ startupMinFreeBytes: coercible }), 0n).check(0n)).toEqual(failure("reject", "CONFIGURATION"));
  expect(new CooperativeGpuPolicy(configuration(), coercible as unknown as bigint).check(0n)).toEqual(failure("reject", "ORIGIN"));
  expect(new CooperativeGpuPolicy(configuration(), 0n).check(coercible as unknown as bigint)).toEqual(failure("reject", "CLOCK"));
  expect(new CooperativeGpuPolicy(configuration(), 0n).admit(0n, sample({ uuid: coercible }))).toEqual(failure("reject", "TELEMETRY"));
  expect(new CooperativeGpuPolicy(configuration(), 0n).admit(0n, sample({ totalBytes: coercible }))).toEqual(failure("reject", "TELEMETRY"));
  expect(invocations).toBe(0);
});
