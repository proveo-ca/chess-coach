// SPEC: _spec/gpu-cooperative-policy.md
import { types } from "node:util";

export type CooperativePolicy = Readonly<{
  selectedUuid: string;
  startupMinFreeBytes: bigint;
  runningStopBelowFreeBytes: bigint;
  samplePeriodNs: bigint;
  maxSampleAgeNs: bigint;
}>;

export type GpuSample = Readonly<{
  uuid: string;
  freeBytes: bigint;
  totalBytes: bigint;
  observedBoottimeNs: bigint;
}>;

export type GpuPolicyFailure = "CONFIGURATION" | "ORIGIN" | "CLOCK" | "NOT_ADMITTED" | "ALREADY_ADMITTED"
  | "COLD_DEADLINE" | "WORK_DEADLINE" | "TELEMETRY" | "DEVICE" | "CAPACITY" | "SAMPLE_TIME"
  | "SAMPLE_ORDER" | "STALE_SAMPLE" | "MISSED_SAMPLE" | "HEADROOM";

export type GpuPolicyDecision = Readonly<
  | { kind: "admit" | "continue"; nextCheckNs: bigint }
  | { kind: "reject" | "terminal"; reason: GpuPolicyFailure }
  | { kind: "abort-owned"; reason: GpuPolicyFailure; cleanupDeadlineNs: bigint }
>;

const I64_MAX = 9_223_372_036_854_775_807n;
const COLD_NS = 10_000_000_000n;
const WORK_NS = 297_000_000_000n;
const CLEANUP_NS = 300_000_000_000n;
const UUID = /^GPU-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const CONFIGURATION_KEYS = ["selectedUuid", "startupMinFreeBytes", "runningStopBelowFreeBytes", "samplePeriodNs", "maxSampleAgeNs"];
const SAMPLE_KEYS = ["uuid", "freeBytes", "totalBytes", "observedBoottimeNs"];

function snapshot(value: unknown, keys: readonly string[]): Readonly<Record<string, unknown>> | undefined {
  if (types.isProxy(value)) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) return undefined;
  const copy: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) return undefined;
    copy[key] = descriptor.value;
  }
  return Object.freeze(copy);
}

function unsignedI64(value: unknown): value is bigint {
  return typeof value === "bigint" && value >= 0n && value <= I64_MAX;
}

function configurationSnapshot(value: unknown): CooperativePolicy | undefined {
  const copy = snapshot(value, CONFIGURATION_KEYS);
  if (!copy || typeof copy.selectedUuid !== "string" || copy.selectedUuid.length !== 40 || !UUID.test(copy.selectedUuid)
    || !unsignedI64(copy.startupMinFreeBytes) || !unsignedI64(copy.runningStopBelowFreeBytes)
    || !unsignedI64(copy.samplePeriodNs) || !unsignedI64(copy.maxSampleAgeNs)
    || copy.runningStopBelowFreeBytes <= 0n || copy.runningStopBelowFreeBytes > copy.startupMinFreeBytes
    || copy.samplePeriodNs <= 0n || copy.samplePeriodNs > copy.maxSampleAgeNs) return undefined;
  return copy as CooperativePolicy;
}

function sampleSnapshot(value: unknown): GpuSample | undefined {
  const copy = snapshot(value, SAMPLE_KEYS);
  if (!copy || typeof copy.uuid !== "string" || copy.uuid.length !== 40 || !UUID.test(copy.uuid)
    || !unsignedI64(copy.freeBytes) || !unsignedI64(copy.totalBytes) || !unsignedI64(copy.observedBoottimeNs)
    || copy.totalBytes === 0n || copy.freeBytes > copy.totalBytes) return undefined;
  return copy as GpuSample;
}

export class CooperativeGpuPolicy {
  readonly #configuration: CooperativePolicy | undefined;
  readonly #originalS0Ns: bigint;
  readonly #initialFailure: GpuPolicyFailure | undefined;
  #state: "awaiting" | "running" | "terminal" = "awaiting";
  #firstFailure: GpuPolicyFailure | undefined;
  #lastNowNs: bigint | undefined;
  #sample: GpuSample | undefined;

  constructor(configuration: unknown, originalS0Ns: bigint) {
    this.#configuration = configurationSnapshot(configuration);
    this.#originalS0Ns = originalS0Ns;
    this.#initialFailure = !this.#configuration ? "CONFIGURATION"
      : !unsignedI64(originalS0Ns) || originalS0Ns > I64_MAX - CLEANUP_NS ? "ORIGIN" : undefined;
  }

  admit(nowNs: bigint, input: unknown): GpuPolicyDecision {
    return this.#gate(nowNs, "admit") ?? this.#accept(nowNs, input);
  }

  observe(nowNs: bigint, input: unknown): GpuPolicyDecision {
    return this.#gate(nowNs, "observe") ?? this.#accept(nowNs, input);
  }

  check(nowNs: bigint): GpuPolicyDecision {
    return this.#gate(nowNs, "check") ?? this.#progress("continue");
  }

  #fail(reason: GpuPolicyFailure): GpuPolicyDecision {
    const admitted = this.#state === "running";
    this.#firstFailure = reason;
    this.#state = "terminal";
    return admitted
      ? Object.freeze({ kind: "abort-owned", reason, cleanupDeadlineNs: this.#originalS0Ns + CLEANUP_NS })
      : Object.freeze({ kind: "reject", reason });
  }

  #expiry(nowNs: bigint, sample: GpuSample): GpuPolicyFailure | undefined {
    if (nowNs >= sample.observedBoottimeNs + this.#configuration!.maxSampleAgeNs) return "STALE_SAMPLE";
    if (nowNs >= sample.observedBoottimeNs + this.#configuration!.samplePeriodNs) return "MISSED_SAMPLE";
    return undefined;
  }

  #gate(nowNs: bigint, method: "admit" | "observe" | "check"): GpuPolicyDecision | undefined {
    if (this.#state === "terminal") return Object.freeze({ kind: "terminal", reason: this.#firstFailure! });
    if (this.#initialFailure) return this.#fail(this.#initialFailure);
    if (!unsignedI64(nowNs) || nowNs < this.#originalS0Ns || (this.#lastNowNs !== undefined && nowNs < this.#lastNowNs)) return this.#fail("CLOCK");
    this.#lastNowNs = nowNs;
    if (this.#state === "awaiting") {
      if (method !== "admit") return this.#fail("NOT_ADMITTED");
      if (nowNs >= this.#originalS0Ns + COLD_NS) return this.#fail("COLD_DEADLINE");
    } else {
      if (method === "admit") return this.#fail("ALREADY_ADMITTED");
      if (nowNs >= this.#originalS0Ns + WORK_NS) return this.#fail("WORK_DEADLINE");
      const failure = this.#expiry(nowNs, this.#sample!);
      if (failure) return this.#fail(failure);
    }
    return undefined;
  }

  #accept(nowNs: bigint, input: unknown): GpuPolicyDecision {
    const sample = sampleSnapshot(input);
    if (!sample) return this.#fail("TELEMETRY");
    const configuration = this.#configuration!;
    if (sample.uuid !== configuration.selectedUuid) return this.#fail("DEVICE");
    if (sample.observedBoottimeNs < this.#originalS0Ns || sample.observedBoottimeNs > nowNs) return this.#fail("SAMPLE_TIME");
    if (this.#sample && sample.observedBoottimeNs <= this.#sample.observedBoottimeNs) return this.#fail("SAMPLE_ORDER");
    if (configuration.startupMinFreeBytes > sample.totalBytes
      || (this.#sample && sample.totalBytes !== this.#sample.totalBytes)) return this.#fail("CAPACITY");
    const failure = this.#expiry(nowNs, sample);
    if (failure) return this.#fail(failure);
    const admitting = this.#state === "awaiting";
    if (sample.freeBytes < (admitting ? configuration.startupMinFreeBytes : configuration.runningStopBelowFreeBytes)) return this.#fail("HEADROOM");
    this.#sample = sample;
    this.#state = "running";
    return this.#progress(admitting ? "admit" : "continue");
  }

  #progress(kind: "admit" | "continue"): GpuPolicyDecision {
    const sample = this.#sample!, configuration = this.#configuration!;
    const deadlines = [sample.observedBoottimeNs + configuration.samplePeriodNs,
      sample.observedBoottimeNs + configuration.maxSampleAgeNs, this.#originalS0Ns + WORK_NS];
    const nextCheckNs = deadlines.reduce((minimum, deadline) => deadline < minimum ? deadline : minimum);
    return Object.freeze({ kind, nextCheckNs });
  }
}
