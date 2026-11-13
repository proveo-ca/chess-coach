// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import {
  constructFloat64Hex, constructRef, requireFloat64Hex, requireRef, type OwnedByteRef, type OwnedFloat64Hex,
} from "../economic/ownedKernel";
import { decodeOwnedNumber, encodeOwnedNumber, equalOwnedRefs } from "../economic/ownedScalars";
import type { Ref, Side } from "../economic/contracts";
import type {
  ActiveStreamState, EpisodeStartStreams, Master, OriginalEpisodeRequestV2, PrivateEconomicRequestV2, ScheduleDescriptor,
} from "./episodeContracts";
import {
  checkPersistentEpisodeStream, computeEpisodeRootTable, constructActiveStreamState, constructEpisodeStartStreams,
  constructUnusedEnvironmentState, deriveEpisodeRoot, equalEpisodeStreamStates, reconstructStartedSelection,
  requireActiveStreamState, requireEpisodeInteger, requireEpisodeMaster, requireEpisodeStartStreams,
} from "./episodeRng";
import {
  requireRegisteredBytes, type ByteRole, type RegisteredByteReader, type RegisteredByteStore,
} from "./registeredBytes";

const freeze = Object.freeze;
const floor = Math.floor;
const abs = Math.abs;
const MAX = Number.MAX_SAFE_INTEGER;
const codeAt = Function.prototype.call.bind(String.prototype.charCodeAt) as (text: string, index: number) => number;
const fromCode = String.fromCharCode;
const join = Function.prototype.call.bind(Array.prototype.join) as (parts: readonly string[], separator: string) => string;
const integerText = Function.prototype.call.bind(Number.prototype.toString) as (value: number, radix: number) => string;
const FixedBytes = Uint8Array;
type Role = "corpus" | "live" | "request" | "wrapper" | "started" | "master-start";
const roles = new WeakMap<object, Role>();
const lookup = WeakMap.prototype.get.bind(roles);
const register = WeakMap.prototype.set.bind(roles);
export const EPISODE_WEIGHTS_BYTE_LENGTH = 11287;
export const EPISODE_REQUEST_BYTE_CAP = 4096;

export class EpisodeRequestError extends Error {
  override readonly name = "EpisodeRequestError";
  constructor(readonly code: "PROVENANCE" | "ATTEMPT" | "SIDE" | "SCHEDULE" | "STARTED" | "BASELINE" |
    "REF" | "RNG" | "CANONICAL" | "LIMIT" | "WEIGHTS") { super(code); }
}
const reject = (code: EpisodeRequestError["code"]): never => { throw new EpisodeRequestError(code); };
const publish = <T extends object>(value: T, role: Role): Readonly<T> => {
  freeze(value);
  register(value, role);
  return value;
};
const requireRole = <T>(value: unknown, role: Role): T => {
  if (value === null || typeof value !== "object" || lookup(value) !== role) return reject("PROVENANCE");
  return value as T;
};
const identifierByte = (byte: number): boolean => byte >= 65 && byte <= 90 || byte >= 97 && byte <= 122 ||
  byte >= 48 && byte <= 57 || byte === 95 || byte === 45;
export const requireEpisodeAttemptId = (value: unknown): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > 64) return reject("ATTEMPT");
  for (let index = 0; index < value.length; index++) if (!identifierByte(codeAt(value, index))) return reject("ATTEMPT");
  return value;
};
const requireSide = (value: unknown): Side => {
  if (value !== "w" && value !== "b") return reject("SIDE");
  return value;
};
export const constructCorpusSchedule = (caseIndex: number): ScheduleDescriptor =>
  publish({ suite: "corpus", candidateSide: "b", caseIndex: requireEpisodeInteger(caseIndex, 0, 17) } as const, "corpus");
export const constructLiveSchedule = (candidateSide: Side): ScheduleDescriptor =>
  publish({ suite: "live-strategic", candidateSide: requireSide(candidateSide) } as const, "live");
export const requireEpisodeSchedule = (value: unknown): ScheduleDescriptor => {
  if (value === null || typeof value !== "object") return reject("PROVENANCE");
  const role = lookup(value);
  if (role !== "corpus" && role !== "live") return reject("PROVENANCE");
  return value as ScheduleDescriptor;
};
export const requireEpisodeRequest = (value: unknown): OriginalEpisodeRequestV2 => requireRole(value, "request");
export const requireEconomicEpisodeRequest = (value: unknown): PrivateEconomicRequestV2 => requireRole(value, "wrapper");

export const constructEpisodeRequest = (
  attemptId: string, master: Master, startedOrdinal: number, weightsRef: Ref, manifestRef: Ref,
  baseline: OwnedFloat64Hex, schedule: ScheduleDescriptor, streams: EpisodeStartStreams,
): OriginalEpisodeRequestV2 => {
  const weights = requireRef(weightsRef), manifest = requireRef(manifestRef), b = requireFloat64Hex(baseline);
  const selected = requireEpisodeSchedule(schedule), rng = requireEpisodeStartStreams(streams);
  const id = requireEpisodeAttemptId(attemptId), m = requireEpisodeMaster(master), a = requireEpisodeInteger(startedOrdinal, 0, 999);
  if (weights.byteLength !== EPISODE_WEIGHTS_BYTE_LENGTH) return reject("WEIGHTS");
  const baselineNumber = decodeOwnedNumber(b);
  if (baselineNumber < -1 || baselineNumber > 1) return reject("BASELINE");
  return publish({ version: "starchess-training-episode-v2", attemptId: id, master: m, startedOrdinal: a,
    weightsRef: weights, manifestRef: manifest, baseline: b, schedule: selected, streams: rng } as const, "request");
};
export const constructEconomicEpisodeRequest = (originalRequest: OriginalEpisodeRequestV2, economicPinRef: Ref): PrivateEconomicRequestV2 => {
  const original = requireEpisodeRequest(originalRequest), pin = requireRef(economicPinRef);
  return publish({ version: "starchess-training-economic-request-v2", originalRequest: original, economicPinRef: pin } as const, "wrapper");
};

export type DurableStartedEpisode = Readonly<{
  attemptId: string; master: Master; startedOrdinal: number; schedule: ScheduleDescriptor; streams: EpisodeStartStreams;
}>;
export type SerialMasterEpisodeStart = Readonly<{
  master: Master; consumedStartedCount: number; baselineSum: number; baselineCount: number;
  weightsRef: Ref; manifestRef: Ref; policySampling: ActiveStreamState; opponent: ActiveStreamState;
}>;
const checkStartedSchedule = (master: Master, ordinal: number, schedule: ScheduleDescriptor, streams: EpisodeStartStreams): void => {
  const reconstruction = reconstructStartedSelection(master, ordinal);
  if (!equalEpisodeStreamStates(streams.selection, reconstruction.selection)) return reject("RNG");
  const environment = streams["environment-settlement"];
  if (environment.root !== deriveEpisodeRoot(master, "environment-settlement")) return reject("RNG");
  checkPersistentEpisodeStream(streams["policy-sampling"], deriveEpisodeRoot(master, "policy-sampling"));
  checkPersistentEpisodeStream(streams.opponent, deriveEpisodeRoot(master, "opponent"));
  if (ordinal % 2 === 0) {
    if (schedule.suite !== "corpus" || schedule.candidateSide !== "b" ||
        schedule.caseIndex !== reconstruction.permutation[(ordinal / 2) % 18]) return reject("SCHEDULE");
  } else {
    const side = floor(ordinal / 2) % 2 === 0 ? "w" : "b";
    if (schedule.suite !== "live-strategic" || schedule.candidateSide !== side) return reject("SCHEDULE");
  }
};
export const constructDurableStartedEpisode = (
  attemptId: string, master: Master, startedOrdinal: number, schedule: ScheduleDescriptor, streams: EpisodeStartStreams,
): DurableStartedEpisode => {
  const selected = requireEpisodeSchedule(schedule), rng = requireEpisodeStartStreams(streams);
  const id = requireEpisodeAttemptId(attemptId), m = requireEpisodeMaster(master), a = requireEpisodeInteger(startedOrdinal, 0, 999);
  checkStartedSchedule(m, a, selected, rng);
  return publish({ attemptId: id, master: m, startedOrdinal: a, schedule: selected, streams: rng }, "started");
};
export const constructSerialMasterEpisodeStart = (
  master: Master, consumedStartedCount: number, baselineSum: number, baselineCount: number,
  weightsRef: Ref, manifestRef: Ref, policySampling: ActiveStreamState, opponent: ActiveStreamState,
): SerialMasterEpisodeStart => {
  const weights = requireRef(weightsRef), manifest = requireRef(manifestRef);
  const policy = requireActiveStreamState(policySampling), enemy = requireActiveStreamState(opponent);
  const m = requireEpisodeMaster(master), consumed = requireEpisodeInteger(consumedStartedCount, 1, 1000);
  const sum = requireEpisodeInteger(baselineSum, -1000, 1000), count = requireEpisodeInteger(baselineCount, 0, consumed - 1);
  if (abs(sum) > count) return reject("BASELINE");
  if (weights.byteLength !== EPISODE_WEIGHTS_BYTE_LENGTH) return reject("WEIGHTS");
  checkPersistentEpisodeStream(policy, deriveEpisodeRoot(m, "policy-sampling"));
  checkPersistentEpisodeStream(enemy, deriveEpisodeRoot(m, "opponent"));
  if (consumed === 1 && (policy.drawCount !== 0 || enemy.drawCount !== 0)) return reject("RNG");
  return publish({ master: m, consumedStartedCount: consumed, baselineSum: sum, baselineCount: count,
    weightsRef: weights, manifestRef: manifest, policySampling: policy, opponent: enemy }, "master-start");
};

declare const expectedBrand: unique symbol;
export type TrustedExpectedEpisodeBindings = Readonly<{ [expectedBrand]: "parent-episode-bindings" }>;
export type LogicalExpectedEpisodeBindings = TrustedExpectedEpisodeBindings;
type Expected = Readonly<{ started: DurableStartedEpisode; serial: SerialMasterEpisodeStart; baseline: OwnedFloat64Hex; economicPinRef: OwnedByteRef }>;
const expectations = new WeakMap<object, Expected>();
const lookupExpected = WeakMap.prototype.get.bind(expectations);
const registerExpected = WeakMap.prototype.set.bind(expectations);
const requireExpected = (value: unknown): Expected => {
  if (value === null || typeof value !== "object") return reject("PROVENANCE");
  const expected = lookupExpected(value);
  if (!expected) return reject("PROVENANCE");
  return expected;
};
export const constructLogicalExpectedEpisodeBindings = (
  durableStarted: DurableStartedEpisode, serialMaster: SerialMasterEpisodeStart, economicPinRef: Ref,
  trainingRecipeManifestRef: Ref, provenanceManifestRef: Ref, pinFeatureManifestRef: Ref,
): TrustedExpectedEpisodeBindings => {
  const started = requireRole<DurableStartedEpisode>(durableStarted, "started");
  const serial = requireRole<SerialMasterEpisodeStart>(serialMaster, "master-start");
  const pin = requireRef(economicPinRef), recipe = requireRef(trainingRecipeManifestRef);
  const provenance = requireRef(provenanceManifestRef), pinManifest = requireRef(pinFeatureManifestRef);
  if (started.master !== serial.master || started.startedOrdinal + 1 !== serial.consumedStartedCount) return reject("STARTED");
  if (!equalEpisodeStreamStates(started.streams["policy-sampling"], serial.policySampling) ||
      !equalEpisodeStreamStates(started.streams.opponent, serial.opponent)) return reject("RNG");
  if (!equalOwnedRefs(serial.manifestRef, recipe) || !equalOwnedRefs(serial.manifestRef, provenance) ||
      !equalOwnedRefs(serial.manifestRef, pinManifest)) return reject("REF");
  computeEpisodeRootTable();
  const baseline = encodeOwnedNumber(serial.baselineCount === 0 ? 0 : serial.baselineSum / serial.baselineCount);
  const token = freeze({}) as TrustedExpectedEpisodeBindings;
  registerExpected(token, freeze({ started, serial, baseline, economicPinRef: pin }));
  return token;
};
const compareRequest = (request: OriginalEpisodeRequestV2, expected: Expected): void => {
  const started = expected.started, serial = expected.serial;
  if (request.attemptId !== started.attemptId || request.master !== started.master ||
      request.startedOrdinal !== started.startedOrdinal) return reject("STARTED");
  if (!equalOwnedRefs(request.weightsRef, serial.weightsRef) || !equalOwnedRefs(request.manifestRef, serial.manifestRef)) return reject("REF");
  if (request.baseline.hex !== expected.baseline.hex) return reject("BASELINE");
  const schedule = request.schedule, selected = started.schedule;
  if (schedule.suite !== selected.suite || schedule.candidateSide !== selected.candidateSide ||
      schedule.suite === "corpus" && (selected.suite !== "corpus" || schedule.caseIndex !== selected.caseIndex)) return reject("SCHEDULE");
  const a = request.streams, b = started.streams;
  if (!equalEpisodeStreamStates(a.selection, b.selection) || !equalEpisodeStreamStates(a["environment-settlement"], b["environment-settlement"]) ||
      !equalEpisodeStreamStates(a["policy-sampling"], b["policy-sampling"]) || !equalEpisodeStreamStates(a.opponent, b.opponent)) return reject("RNG");
};

class Cursor {
  private offset = 0;
  constructor(private readonly reader: RegisteredByteReader) {}
  private peek(): number { return this.offset < this.reader.length ? this.reader.readByte(this.offset) : -1; }
  literal(text: string): void {
    for (let index = 0; index < text.length; index++) {
      if (this.peek() !== codeAt(text, index)) return reject("CANONICAL");
      this.offset++;
    }
  }
  integer(): number {
    let value = 0, digits = 0;
    const first = this.peek();
    while (this.peek() >= 48 && this.peek() <= 57) {
      if (digits === 16 || digits > 0 && first === 48) return reject("CANONICAL");
      const digit = this.peek() - 48;
      if (value > floor((MAX - digit) / 10)) return reject("CANONICAL");
      value = value * 10 + digit;
      digits++;
      this.offset++;
    }
    if (digits === 0) return reject("CANONICAL");
    return value;
  }
  hex(length: 16 | 64): string {
    const characters: string[] = [];
    for (let index = 0; index < length; index++) {
      const byte = this.peek();
      if (!(byte >= 48 && byte <= 57 || byte >= 97 && byte <= 102)) return reject("CANONICAL");
      characters.push(fromCode(byte));
      this.offset++;
    }
    return join(characters, "");
  }
  attempt(): string {
    const characters: string[] = [];
    while (this.peek() !== 34) {
      const byte = this.peek();
      if (characters.length === 64 || !identifierByte(byte)) return reject("CANONICAL");
      characters.push(fromCode(byte));
      this.offset++;
    }
    return requireEpisodeAttemptId(join(characters, ""));
  }
  h(): OwnedFloat64Hex {
    this.literal('{"hex":"');
    const hex = this.hex(16);
    this.literal('"}');
    return constructFloat64Hex(hex);
  }
  ref(): OwnedByteRef {
    this.literal('{"byteLength":');
    const length = this.integer();
    this.literal(',"sha256":"');
    const sha256 = this.hex(64);
    this.literal('"}');
    return constructRef(length, sha256);
  }
  stream(unused: boolean): ActiveStreamState | ReturnType<typeof constructUnusedEnvironmentState> {
    this.literal('{"drawCount":');
    const count = this.integer();
    this.literal(',"root":');
    const root = this.integer();
    this.literal(',"state":');
    const state = this.integer();
    this.literal(unused ? ',"status":"unused"}' : ',"status":"active"}');
    if (unused) {
      if (count !== 0 || state !== root) return reject("RNG");
      return constructUnusedEnvironmentState(root);
    }
    return constructActiveStreamState(root, state, count);
  }
  streams(): EpisodeStartStreams {
    this.literal('{"environment-settlement":');
    const environment = this.stream(true) as ReturnType<typeof constructUnusedEnvironmentState>;
    this.literal(',"opponent":');
    const opponent = this.stream(false) as ActiveStreamState;
    this.literal(',"policy-sampling":');
    const sampling = this.stream(false) as ActiveStreamState;
    this.literal(',"selection":');
    const selection = this.stream(false) as ActiveStreamState;
    this.literal('}');
    return constructEpisodeStartStreams(selection, environment, sampling, opponent);
  }
  schedule(): ScheduleDescriptor {
    this.literal('{"candidateSide":"');
    const byte = this.peek();
    if (byte !== 119 && byte !== 98) return reject("SIDE");
    this.offset++;
    this.literal('",');
    if (this.peek() !== 34) return reject("CANONICAL");
    this.literal('"');
    if (this.peek() === 99) {
      this.literal('caseIndex":');
      const caseIndex = this.integer();
      this.literal(',"suite":"corpus"}');
      if (byte !== 98) return reject("SCHEDULE");
      return constructCorpusSchedule(caseIndex);
    }
    this.literal('suite":"live-strategic"}');
    return constructLiveSchedule(byte === 119 ? "w" : "b");
  }
  request(): OriginalEpisodeRequestV2 {
    this.literal('{"attemptId":"');
    const attempt = this.attempt();
    this.literal('","baseline":');
    const baseline = this.h();
    this.literal(',"manifestRef":');
    const manifest = this.ref();
    this.literal(',"master":');
    const master = requireEpisodeMaster(this.integer());
    this.literal(',"schedule":');
    const schedule = this.schedule();
    this.literal(',"startedOrdinal":');
    const ordinal = this.integer();
    this.literal(',"streams":');
    const streams = this.streams();
    this.literal(',"version":"starchess-training-episode-v2","weightsRef":');
    const weights = this.ref();
    this.literal('}');
    return constructEpisodeRequest(attempt, master, ordinal, weights, manifest, baseline, schedule, streams);
  }
  finish(): void { if (this.offset !== this.reader.length) return reject("CANONICAL"); }
}

const hSegments = (value: OwnedFloat64Hex): readonly string[] => ['{"hex":"', value.hex, '"}'];
const refSegments = (value: Ref): readonly string[] => ['{"byteLength":', integerText(value.byteLength, 10), ',"sha256":"', value.sha256, '"}'];
const streamSegments = (value: EpisodeStartStreams["selection"] | EpisodeStartStreams["environment-settlement"]): readonly string[] => [
  '{"drawCount":', integerText(value.drawCount, 10), ',"root":', integerText(value.root, 10), ',"state":',
  integerText(value.state, 10), ',"status":"', value.status, '"}',
];
const requestSegments = (request: OriginalEpisodeRequestV2): readonly string[] => {
  const s = request.schedule, streams = request.streams;
  const schedule = s.suite === "corpus" ? ['{"candidateSide":"b","caseIndex":', integerText(s.caseIndex, 10), ',"suite":"corpus"}'] :
    ['{"candidateSide":"', s.candidateSide, '","suite":"live-strategic"}'];
  return ['{"attemptId":"', request.attemptId, '","baseline":', ...hSegments(request.baseline), ',"manifestRef":', ...refSegments(request.manifestRef),
    ',"master":', integerText(request.master, 10), ',"schedule":', ...schedule, ',"startedOrdinal":', integerText(request.startedOrdinal, 10),
    ',"streams":{"environment-settlement":', ...streamSegments(streams["environment-settlement"]), ',"opponent":', ...streamSegments(streams.opponent),
    ',"policy-sampling":', ...streamSegments(streams["policy-sampling"]), ',"selection":', ...streamSegments(streams.selection),
    '},"version":"starchess-training-episode-v2","weightsRef":', ...refSegments(request.weightsRef), '}'];
};
const wrapperSegments = (request: PrivateEconomicRequestV2): readonly string[] => ['{"economicPinRef":', ...refSegments(request.economicPinRef),
  ',"originalRequest":', ...requestSegments(request.originalRequest), ',"version":"starchess-training-economic-request-v2"}'];
const emit = (segments: readonly string[]): Uint8Array => {
  let length = 0;
  for (let index = 0; index < segments.length; index++) length += segments[index]!.length;
  if (length > EPISODE_REQUEST_BYTE_CAP) return reject("LIMIT");
  const bytes = new FixedBytes(length);
  let offset = 0;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!;
    for (let character = 0; character < segment.length; character++) bytes[offset++] = codeAt(segment, character);
  }
  return bytes;
};
const compareCanonical = (reader: RegisteredByteReader, segments: readonly string[]): void => {
  let offset = 0;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!;
    for (let character = 0; character < segment.length; character++) {
      if (offset >= reader.length || reader.readByte(offset++) !== codeAt(segment, character)) return reject("CANONICAL");
    }
  }
  if (offset !== reader.length) return reject("CANONICAL");
};
export const encodeEpisodeRequest = (value: OriginalEpisodeRequestV2): Uint8Array => emit(requestSegments(requireEpisodeRequest(value)));
export const encodeEconomicEpisodeRequest = (value: PrivateEconomicRequestV2): Uint8Array => emit(wrapperSegments(requireEconomicEpisodeRequest(value)));

declare const transportBrand: unique symbol;
export type EpisodeRequestByteBinding = Readonly<{ [transportBrand]: "registered-episode-startup-bytes" }>;
type Transport = Readonly<{ store: RegisteredByteStore; reader: RegisteredByteReader }>;
const transports = new WeakMap<object, Transport>();
const lookupTransport = WeakMap.prototype.get.bind(transports);
const registerTransport = WeakMap.prototype.set.bind(transports);
const requireTransport = (value: unknown): Transport => {
  if (value === null || typeof value !== "object") return reject("PROVENANCE");
  const transport = lookupTransport(value);
  if (!transport) return reject("PROVENANCE");
  return transport;
};
export const constructEpisodeRequestByteBinding = (
  store: RegisteredByteStore, independentlyExpectedRole: ByteRole, independentlyExpectedRef: Ref,
): EpisodeRequestByteBinding => {
  const ref = requireRef(independentlyExpectedRef);
  if (ref.byteLength > EPISODE_REQUEST_BYTE_CAP) return reject("LIMIT");
  const reader = requireRegisteredBytes(store, independentlyExpectedRole, ref);
  const token = freeze({}) as EpisodeRequestByteBinding;
  registerTransport(token, freeze({ store, reader }));
  return token;
};

const readWeights = (store: RegisteredByteStore, expected: Expected): readonly OwnedFloat64Hex[] => {
  const reader = requireRegisteredBytes(store, "episodeWeights", expected.serial.weightsRef);
  if (reader.length !== EPISODE_WEIGHTS_BYTE_LENGTH) return reject("WEIGHTS");
  requireRegisteredBytes(store, "featureManifest", expected.serial.manifestRef);
  const cursor = new Cursor(reader), weights: OwnedFloat64Hex[] = [];
  cursor.literal('[');
  for (let index = 0; index < 418; index++) {
    if (index !== 0) cursor.literal(',');
    const coefficient = cursor.h();
    decodeOwnedNumber(coefficient);
    if (expected.started.startedOrdinal === 0 && coefficient.hex !== "0000000000000000") return reject("WEIGHTS");
    weights.push(coefficient);
  }
  cursor.literal(']');
  cursor.finish();
  let offset = 0;
  const compare = (text: string): void => {
    for (let index = 0; index < text.length; index++) if (reader.readByte(offset++) !== codeAt(text, index)) return reject("CANONICAL");
  };
  compare('[');
  for (let index = 0; index < 418; index++) {
    if (index !== 0) compare(',');
    const parts = hSegments(weights[index]!);
    for (let part = 0; part < parts.length; part++) compare(parts[part]!);
  }
  compare(']');
  if (offset !== reader.length) return reject("CANONICAL");
  return freeze(weights);
};
export const validateEpisodeRequestStartup = (
  value: OriginalEpisodeRequestV2, trustedExpectedEpisodeBindings: TrustedExpectedEpisodeBindings, store: RegisteredByteStore,
): readonly OwnedFloat64Hex[] => {
  const expected = requireExpected(trustedExpectedEpisodeBindings), request = requireEpisodeRequest(value);
  compareRequest(request, expected);
  return readWeights(store, expected);
};
export const validateEconomicEpisodeRequestStartup = (
  value: PrivateEconomicRequestV2, trustedExpectedEpisodeBindings: TrustedExpectedEpisodeBindings, store: RegisteredByteStore,
): readonly OwnedFloat64Hex[] => {
  const expected = requireExpected(trustedExpectedEpisodeBindings), wrapper = requireEconomicEpisodeRequest(value);
  if (!equalOwnedRefs(wrapper.economicPinRef, expected.economicPinRef)) return reject("REF");
  requireRegisteredBytes(store, "economicPin", expected.economicPinRef);
  return validateEpisodeRequestStartup(wrapper.originalRequest, trustedExpectedEpisodeBindings, store);
};
export const decodeRegisteredEpisodeRequest = (
  binding: EpisodeRequestByteBinding, trustedExpectedEpisodeBindings: TrustedExpectedEpisodeBindings,
): OriginalEpisodeRequestV2 => {
  const expected = requireExpected(trustedExpectedEpisodeBindings), transport = requireTransport(binding);
  const cursor = new Cursor(transport.reader), request = cursor.request();
  cursor.finish();
  compareCanonical(transport.reader, requestSegments(request));
  compareRequest(request, expected);
  readWeights(transport.store, expected);
  return request;
};
export const decodeRegisteredEconomicEpisodeRequest = (
  binding: EpisodeRequestByteBinding, trustedExpectedEpisodeBindings: TrustedExpectedEpisodeBindings,
): PrivateEconomicRequestV2 => {
  const expected = requireExpected(trustedExpectedEpisodeBindings), transport = requireTransport(binding);
  const cursor = new Cursor(transport.reader);
  cursor.literal('{"economicPinRef":');
  const pin = cursor.ref();
  cursor.literal(',"originalRequest":');
  const request = cursor.request();
  cursor.literal(',"version":"starchess-training-economic-request-v2"}');
  cursor.finish();
  const wrapper = constructEconomicEpisodeRequest(request, pin);
  compareCanonical(transport.reader, wrapperSegments(wrapper));
  if (!equalOwnedRefs(wrapper.economicPinRef, expected.economicPinRef)) return reject("REF");
  validateEconomicEpisodeRequestStartup(wrapper, trustedExpectedEpisodeBindings, transport.store);
  return wrapper;
};
