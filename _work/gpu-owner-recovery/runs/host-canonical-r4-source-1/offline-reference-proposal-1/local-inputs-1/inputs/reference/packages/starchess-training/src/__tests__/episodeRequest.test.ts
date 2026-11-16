// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as request from "../coordinator/episodeRequest";
import * as rng from "../coordinator/episodeRng";
import type {
  CompactSampleJournalEntry, CompletePayload, DecisionId, EpisodeCommonHeader, EpisodeMessageKind,
  EpisodeRequestV2, Master, OppPrivateJournal, OriginalEpisodeRequestV2, PlanPermit, PrivateEconomicRequestV2,
} from "../coordinator/episodeContracts";
import { constructCanonicalOpening, constructRef } from "../economic/ownedKernel";
import { decodeOwnedNumber, encodeOwnedNumber } from "../economic/ownedScalars";
import { createRegisteredByteStore } from "../coordinator/registeredBytes";

const encoder = new TextEncoder(), decoder = new TextDecoder();
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const refFor = (bytes: Uint8Array) => constructRef(bytes.length, hash(bytes));
const canonical = (value: unknown): string => JSON.stringify(value, (_key, child: unknown) => {
  if (child !== null && typeof child === "object" && !Array.isArray(child)) {
    return Object.fromEntries(Object.entries(child).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  }
  return child;
});
const coefficients = (value = 0): Uint8Array => encoder.encode(canonical(Array.from({ length: 418 }, () => encodeOwnedNumber(value))));
const hostile = (target: object = {}) => {
  const trap = vi.fn(() => { throw new Error("trap"); });
  return { value: new Proxy(target, { get: trap, ownKeys: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap }), trap };
};
const activeAfter = (master: Master, label: "policy-sampling" | "opponent", count: number) => {
  const root = rng.deriveEpisodeRoot(master, label), cursor = rng.restoreEpisodeRng(rng.constructActiveStreamState(root, root, 0));
  for (let draw = 0; draw < count; draw++) rng.drawEpisodeRng(cursor);
  return rng.snapshotEpisodeRng(cursor);
};
const fixture = (ordinal = 0, master: Master = 101, policyDraws = 0, opponentDraws = 0, sum = 0, count = 0, value = 0) => {
  const weightsBytes = coefficients(value), weightsRef = refFor(weightsBytes);
  const manifestBytes = encoder.encode('"independently verified feature-manifest fixture"'), manifestRef = refFor(manifestBytes);
  const pinBytes = encoder.encode(canonical({ version: "starchess-economic-pin-v1", featureManifestRef: manifestRef })), pinRef = refFor(pinBytes);
  const selection = rng.reconstructStartedSelection(master, ordinal);
  const policy = activeAfter(master, "policy-sampling", policyDraws), opponent = activeAfter(master, "opponent", opponentDraws);
  const environment = rng.constructUnusedEnvironmentState(rng.deriveEpisodeRoot(master, "environment-settlement"));
  const streams = rng.constructEpisodeStartStreams(selection.selection, environment, policy, opponent);
  const schedule = ordinal % 2 === 0 ? request.constructCorpusSchedule(selection.permutation[(ordinal / 2) % 18]!) :
    request.constructLiveSchedule(Math.floor(ordinal / 2) % 2 === 0 ? "w" : "b");
  const attemptId = `attempt_${master}_${ordinal}`;
  const started = request.constructDurableStartedEpisode(attemptId, master, ordinal, schedule, streams);
  const serial = request.constructSerialMasterEpisodeStart(master, ordinal + 1, sum, count, weightsRef, manifestRef, policy, opponent);
  const expected = request.constructLogicalExpectedEpisodeBindings(started, serial, pinRef, manifestRef, manifestRef, manifestRef);
  const baseline = encodeOwnedNumber(count === 0 ? 0 : sum / count);
  const original = request.constructEpisodeRequest(attemptId, master, ordinal, weightsRef, manifestRef, baseline, schedule, streams);
  const wrapper = request.constructEconomicEpisodeRequest(original, pinRef);
  const storeFor = (transportBytes = request.encodeEpisodeRequest(original), actualWeights = weightsBytes,
    actualManifest = manifestBytes, actualPin = pinBytes) => {
    const owner = createRegisteredByteStore();
    const transportRef = refFor(transportBytes);
    owner.register("hostConfiguration", transportRef, transportBytes);
    owner.register("episodeWeights", refFor(actualWeights), actualWeights);
    owner.register("featureManifest", refFor(actualManifest), actualManifest);
    owner.register("economicPin", refFor(actualPin), actualPin);
    const store = owner.seal();
    const binding = request.constructEpisodeRequestByteBinding(store, "hostConfiguration", transportRef);
    return { store, binding };
  };
  return { master, ordinal, attemptId, weightsBytes, weightsRef, manifestBytes, manifestRef, pinBytes, pinRef, policy, opponent,
    selection, streams, schedule, started, serial, expected, baseline, original, wrapper, storeFor };
};
const replaceRequest = (f: ReturnType<typeof fixture>, changes: Partial<OriginalEpisodeRequestV2>) => request.constructEpisodeRequest(
  changes.attemptId ?? f.attemptId, changes.master ?? f.master, changes.startedOrdinal ?? f.ordinal,
  changes.weightsRef ?? f.weightsRef, changes.manifestRef ?? f.manifestRef, changes.baseline ?? f.baseline,
  changes.schedule ?? f.schedule, changes.streams ?? f.streams,
);
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type Contracts = [
  Assert<Equal<EpisodeRequestV2, OriginalEpisodeRequestV2>>,
  Assert<Equal<keyof EpisodeRequestV2, "version" | "attemptId" | "master" | "startedOrdinal" | "weightsRef" | "manifestRef" | "baseline" | "schedule" | "streams">>,
  Assert<Equal<keyof PrivateEconomicRequestV2, "version" | "originalRequest" | "economicPinRef">>,
  Assert<Equal<keyof EpisodeCommonHeader, "version" | "attemptId" | "messageOrdinal" | "kind">>,
  Assert<Equal<EpisodeMessageKind, "ready" | "turn-open-result" | "turn-open-accepted" | "decision-result" | "decision-accepted" | "settlement" | "complete">>,
  Assert<Equal<keyof DecisionId, "planningOrdinal" | "side">>,
  Assert<Equal<keyof PlanPermit, "permitId" | "planningOrdinal" | "turn" | "side" | "role">>,
  Assert<Equal<keyof CompactSampleJournalEntry, "decisionId" | "permitId" | "historyDigest" | "manifestDigest" | "generatorVersion" |
    "orderedCandidateKeysDigest" | "selectedIndex" | "selectedKey" | "actions" | "requestedSpend" | "uniform" |
    "selectedLogProbability" | "samplingBefore" | "samplingAfter">>,
  Assert<Equal<CompactSampleJournalEntry["generatorVersion"], "challenge-composition-v3">>,
  Assert<Equal<keyof OppPrivateJournal, "decisionId" | "permitId" | "actions" | "reportedMinSpend" | "opponentBefore" | "opponentAfter">>,
  Assert<Equal<keyof CompletePayload, "acceptedCandidateDecisionIds" | "acceptedOpponentDecisionIds" | "scoreAccumulator" | "rngSummaries" | "stopProof">>,
  Assert<Equal<CompletePayload["scoreAccumulator"]["length"], 418>>,
];

describe("closed private episode-v2 request", () => {
  it("constructs the exact nine-key original and three-key separate economic wrapper", () => {
    const f = fixture();
    expect(Object.keys(f.original)).toHaveLength(9);
    expect(Object.keys(f.wrapper).sort()).toEqual(["economicPinRef", "originalRequest", "version"]);
    expect(f.wrapper.originalRequest).toBe(f.original);
    expect(Object.isFrozen(f.original)).toBe(true);
    expect(Object.getPrototypeOf(f.original)).toBe(Object.prototype);
    expect(Object.isFrozen(f.original.schedule)).toBe(true);
    expect(Object.isFrozen(f.original.streams)).toBe(true);
    expect(Object.keys(f.original.schedule).sort()).toEqual(["candidateSide", "caseIndex", "suite"]);
    expect(Object.keys(fixture(1).schedule).sort()).toEqual(["candidateSide", "suite"]);
    expect(Object.keys(f.original.streams).sort()).toEqual(["environment-settlement", "opponent", "policy-sampling", "selection"]);
    expect(Object.keys(f.original.streams.selection).sort()).toEqual(["drawCount", "root", "state", "status"]);
  });

  it.each([0, 1, 2, 3, 35, 36, 37, 72, 998, 999])("roundtrips canonical registered bytes at STARTED slot %s", ordinal => {
    const f = fixture(ordinal), encoded = request.encodeEpisodeRequest(f.original);
    expect(decoder.decode(encoded)).toBe(canonical(f.original));
    const { store, binding } = f.storeFor(encoded);
    const received = request.decodeRegisteredEpisodeRequest(binding, f.expected);
    expect(received).toEqual(f.original);
    expect(received).not.toBe(f.original);
    expect(received.schedule).not.toBe(f.schedule);
    expect(received.streams).not.toBe(f.streams);
    expect(request.requireEpisodeRequest(received)).toBe(received);
    const checked = request.validateEpisodeRequestStartup(received, f.expected, store);
    expect(checked).toHaveLength(418);
    expect(Object.isFrozen(checked)).toBe(true);
    expect(checked.map(decodeOwnedNumber)).toEqual(Array(418).fill(0));
    expect(received.streams.selection.drawCount).toBe(17 * (Math.floor((Math.ceil((ordinal + 1) / 2) - 1) / 18) + 1));
  });

  it("roundtrips the exact wrapper and joins economic pin independently", () => {
    const f = fixture(3, 104, 11, 7, -1, 2), encoded = request.encodeEconomicEpisodeRequest(f.wrapper);
    expect(decoder.decode(encoded)).toBe(canonical(f.wrapper));
    const { store, binding } = f.storeFor(encoded);
    expect(request.decodeRegisteredEconomicEpisodeRequest(binding, f.expected)).toEqual(f.wrapper);
    expect(request.validateEconomicEpisodeRequestStartup(f.wrapper, f.expected, store)).toHaveLength(418);
    const wrong = request.constructEconomicEpisodeRequest(f.original, constructRef(f.pinRef.byteLength, "a".repeat(64)));
    expect(() => request.validateEconomicEpisodeRequestStartup(wrong, f.expected, store)).toThrow("REF");
  });

  it("validates all primitives and requires owned H/ref/schedule/streams before property access", () => {
    const f = fixture(), poisoned = hostile(), value = poisoned.value as never;
    const calls = [
      () => request.constructEpisodeRequest(value, 101, 0, f.weightsRef, f.manifestRef, f.baseline, f.schedule, f.streams),
      () => request.constructEpisodeRequest(f.attemptId, value, 0, f.weightsRef, f.manifestRef, f.baseline, f.schedule, f.streams),
      () => request.constructEpisodeRequest(f.attemptId, 101, value, f.weightsRef, f.manifestRef, f.baseline, f.schedule, f.streams),
      () => request.constructEpisodeRequest(f.attemptId, 101, 0, value, f.manifestRef, f.baseline, f.schedule, f.streams),
      () => request.constructEpisodeRequest(f.attemptId, 101, 0, f.weightsRef, value, f.baseline, f.schedule, f.streams),
      () => request.constructEpisodeRequest(f.attemptId, 101, 0, f.weightsRef, f.manifestRef, value, f.schedule, f.streams),
      () => request.constructEpisodeRequest(f.attemptId, 101, 0, f.weightsRef, f.manifestRef, f.baseline, value, f.streams),
      () => request.constructEpisodeRequest(f.attemptId, 101, 0, f.weightsRef, f.manifestRef, f.baseline, f.schedule, value),
      () => request.constructCorpusSchedule(value), () => request.constructLiveSchedule(value),
    ];
    for (const call of calls) expect(call).toThrow();
    expect(poisoned.trap).not.toHaveBeenCalled();
    for (const id of ["", "x".repeat(65), "a:b", "a/b", "a b", "a\n", "é", "\u0000"]) expect(() => request.requireEpisodeAttemptId(id)).toThrow("ATTEMPT");
    expect(request.requireEpisodeAttemptId("Abc_012-xyz")).toBe("Abc_012-xyz");
    for (const ordinal of [-0, -1, 1000, 1.5, Number.MAX_SAFE_INTEGER + 1]) expect(() => replaceRequest(f, { startedOrdinal: ordinal })).toThrow("INTEGER");
    for (const baseline of [encodeOwnedNumber(-1.01), encodeOwnedNumber(1.01)]) expect(() => replaceRequest(f, { baseline })).toThrow("BASELINE");
    expect(() => replaceRequest(f, { weightsRef: constructRef(11286, f.weightsRef.sha256) })).toThrow("WEIGHTS");
  });

  it("requires independent durable STARTED, current serial master and every trusted reference join", () => {
    const f = fixture(3, 101, 10, 5, -1, 2), { store } = f.storeFor();
    for (const expected of [undefined, null, {}, Object.freeze({}), structuredClone(f.expected), f.original, f.started, f.serial]) {
      expect(() => request.validateEpisodeRequestStartup(f.original, expected as request.TrustedExpectedEpisodeBindings, store)).toThrow("PROVENANCE");
    }
    for (const changes of [{ attemptId: "different" }, { master: 102 as Master }, { startedOrdinal: 4 }]) {
      expect(() => request.validateEpisodeRequestStartup(replaceRequest(f, changes), f.expected, store)).toThrow("STARTED");
    }
    const otherSerial = request.constructSerialMasterEpisodeStart(101, 5, 0, 0, f.weightsRef, f.manifestRef, f.policy, f.opponent);
    expect(() => request.constructLogicalExpectedEpisodeBindings(f.started, otherSerial, f.pinRef, f.manifestRef, f.manifestRef, f.manifestRef)).toThrow("STARTED");
    const other = fixture(3, 102, 10, 5, -1, 2);
    expect(() => request.constructLogicalExpectedEpisodeBindings(f.started, other.serial, f.pinRef, f.manifestRef, f.manifestRef, f.manifestRef)).toThrow("STARTED");
    for (const index of [0, 1, 2]) {
      const joins = [f.manifestRef, f.manifestRef, f.manifestRef];
      joins[index] = constructRef(f.manifestRef.byteLength, "b".repeat(64));
      expect(() => request.constructLogicalExpectedEpisodeBindings(f.started, f.serial, f.pinRef, joins[0]!, joins[1]!, joins[2]!)).toThrow("REF");
    }
    for (const sum of [-3, 3]) expect(() => request.constructSerialMasterEpisodeStart(101, 4, sum, 2,
      f.weightsRef, f.manifestRef, f.policy, f.opponent)).toThrow("BASELINE");
    expect(() => request.constructSerialMasterEpisodeStart(101, 4, 0, 4, f.weightsRef, f.manifestRef, f.policy, f.opponent)).toThrow("INTEGER");
    expect(() => request.validateEpisodeRequestStartup(replaceRequest(f, { baseline: encodeOwnedNumber(.5) }), f.expected, store)).toThrow("BASELINE");
    const zero = fixture(), zeroStore = zero.storeFor().store;
    expect(() => request.validateEpisodeRequestStartup(replaceRequest(zero, { baseline: encodeOwnedNumber(-0) }), zero.expected, zeroStore)).toThrow("BASELINE");
  });

  it("rejects worker-consistent substitutions of weights, manifest, schedule and every stream field", () => {
    const f = fixture(3, 103, 7, 5, 1, 2), { store } = f.storeFor();
    for (const changes of [
      { weightsRef: constructRef(11287, "a".repeat(64)) },
      { manifestRef: constructRef(f.manifestRef.byteLength, "b".repeat(64)) },
      { schedule: request.constructLiveSchedule("w") }, { schedule: request.constructCorpusSchedule(0) },
    ]) expect(() => request.validateEpisodeRequestStartup(replaceRequest(f, changes), f.expected, store)).toThrow();
    for (const label of ["selection", "policy-sampling", "opponent"] as const) {
      const original = f.streams[label];
      const variants = [
        rng.constructActiveStreamState((original.root + 1) >>> 0, original.state, original.drawCount),
        rng.constructActiveStreamState(original.root, (original.state + 1) >>> 0, original.drawCount),
        rng.constructActiveStreamState(original.root, original.state, original.drawCount + 1),
      ];
      for (const changed of variants) {
        const streams = rng.constructEpisodeStartStreams(label === "selection" ? changed : f.streams.selection,
          f.streams["environment-settlement"], label === "policy-sampling" ? changed : f.policy, label === "opponent" ? changed : f.opponent);
        expect(() => request.validateEpisodeRequestStartup(replaceRequest(f, { streams }), f.expected, store)).toThrow("RNG");
      }
    }
    const environment = rng.constructUnusedEnvironmentState((f.streams["environment-settlement"].root + 1) >>> 0);
    const wrongEnvironment = rng.constructEpisodeStartStreams(f.streams.selection, environment, f.policy, f.opponent);
    expect(() => request.validateEpisodeRequestStartup(replaceRequest(f, { streams: wrongEnvironment }), f.expected, store)).toThrow("RNG");
    const reset = rng.constructEpisodeStartStreams(f.streams.selection, f.streams["environment-settlement"], activeAfter(103, "policy-sampling", 0), f.opponent);
    expect(() => request.validateEpisodeRequestStartup(replaceRequest(f, { streams: reset }), f.expected, store)).toThrow("RNG");
    expect(() => request.constructDurableStartedEpisode(f.attemptId, f.master, f.ordinal, request.constructLiveSchedule("w"), f.streams)).toThrow("SCHEDULE");
    expect(() => request.constructDurableStartedEpisode(f.attemptId, f.master, f.ordinal, f.schedule, reset)).not.toThrow();
    const wrongStarted = request.constructDurableStartedEpisode(f.attemptId, f.master, f.ordinal, f.schedule, reset);
    expect(() => request.constructLogicalExpectedEpisodeBindings(wrongStarted, f.serial, f.pinRef, f.manifestRef, f.manifestRef, f.manifestRef)).toThrow("RNG");
    const corpus = fixture(36), caseIndex = corpus.schedule.suite === "corpus" ? corpus.schedule.caseIndex : -1;
    expect(() => request.constructDurableStartedEpisode(corpus.attemptId, 101, 36, request.constructCorpusSchedule((caseIndex + 1) % 18), corpus.streams)).toThrow("SCHEDULE");
  });

  it("checks the same registered physical weights and preserves all 418 finite bits without padding", () => {
    const f = fixture(5, 105, 19, 8, 1, 3, -0);
    expect(f.weightsBytes.byteLength).toBe(418 * 26 + 417 + 2);
    expect(f.weightsBytes.byteLength).toBe(request.EPISODE_WEIGHTS_BYTE_LENGTH);
    const { store } = f.storeFor();
    const weights = request.validateEpisodeRequestStartup(f.original, f.expected, store);
    expect(weights.every(value => Object.is(decodeOwnedNumber(value), -0))).toBe(true);
    expect(() => request.validateEpisodeRequestStartup(f.original, f.expected, f.storeFor(undefined, coefficients(1)).store)).toThrow("MISMATCH");
    expect(() => request.validateEpisodeRequestStartup(f.original, f.expected, f.storeFor(undefined, undefined, encoder.encode('"other"')).store)).toThrow("MISMATCH");
    const badText = decoder.decode(f.weightsBytes).replace("8000000000000000", "7ff0000000000000");
    const badBytes = encoder.encode(badText), badRef = refFor(badBytes);
    const serial = request.constructSerialMasterEpisodeStart(105, 6, 1, 3, badRef, f.manifestRef, f.policy, f.opponent);
    const expected = request.constructLogicalExpectedEpisodeBindings(f.started, serial, f.pinRef, f.manifestRef, f.manifestRef, f.manifestRef);
    const badOriginal = replaceRequest(f, { weightsRef: badRef });
    expect(() => request.validateEpisodeRequestStartup(badOriginal, expected, f.storeFor(undefined, badBytes).store)).toThrow("FLOAT64");
    const first = fixture(0, 101, 0, 0, 0, 0, 1);
    expect(() => request.validateEpisodeRequestStartup(first.original, first.expected, first.storeFor().store)).toThrow("WEIGHTS");
    const malformed = encoder.encode(decoder.decode(f.weightsBytes).replace('{"hex":"8000000000000000"}', '{"HEX":"8000000000000000"}'));
    const malformedRef = refFor(malformed), malformedSerial = request.constructSerialMasterEpisodeStart(105, 6, 1, 3, malformedRef, f.manifestRef, f.policy, f.opponent);
    const malformedExpected = request.constructLogicalExpectedEpisodeBindings(f.started, malformedSerial, f.pinRef, f.manifestRef, f.manifestRef, f.manifestRef);
    expect(() => request.validateEpisodeRequestStartup(replaceRequest(f, { weightsRef: malformedRef }), malformedExpected,
      f.storeFor(undefined, malformed).store)).toThrow("CANONICAL");
  });

  it("rejects duplicate, missing, unknown, wrong-variant, malformed UTF8 and noncanonical request bytes", () => {
    const f = fixture(), text = decoder.decode(request.encodeEpisodeRequest(f.original));
    const mutations = [
      text.replace('{"attemptId":', '{"attemptId":"duplicate","attemptId":'),
      text.replace('"master":101,', ''), text.replace('"master":101', '"master":101,"unknown":0'),
      text.replace('"master":101', '"master":0101'), text.replace('"master":101', '"master":101.0'),
      text.replace('"startedOrdinal":0', '"startedOrdinal":-0'), text.replace('"startedOrdinal":0', '"startedOrdinal":1000'),
      text.replace('"startedOrdinal":0', '"startedOrdinal":9007199254740992'),
      text.replace('"starchess-training-episode-v2"', '"starchess-training-episode-v1"'),
      text.replace('"candidateSide":"b"', '"candidateSide":"w"'),
      text.replace('"suite":"corpus"', '"suite":"live-strategic"'),
      text.replace('"suite":"corpus"', '"arenaSeed":0,"suite":"corpus"'),
      text.replace('"suite":"corpus"', '"arenaSeedSlot":0,"suite":"corpus"'),
      text.replace('"suite":"corpus"', '"inferenceSeed":0,"suite":"corpus"'),
      text.replace('"selection":', '"generator":{"status":"unused"},"selection":'),
      text.replace('"status":"unused"', '"status":"active"'),
      text.replace('"status":"active"', '"status":"unused"'),
      text.replace('"drawCount":0', '"drawCount":1'),
      text.replace('"drawCount":0', '"drawCount":9007199254740992'),
      text.replace('"hex":"0000000000000000"', '"hex":"7ff0000000000000"'),
      text.replace(f.attemptId, 'bad\\u005fescape'),
      ` ${text}`, `${text}\n`, `\ufeff${text}`, text.replace('"baseline":', '"baseline" :'),
      text.replace('{"hex":', '{"unknown":0,"hex":'),
      text.replace('{"byteLength":', '{"unknown":0,"byteLength":'),
      text.replace('"sha256":"', '"sha256":"G'), text.slice(0, -1),
      `${text}${text}`, text.replace('"baseline":', '"baseline":['),
    ];
    for (const mutation of mutations) {
      const { binding } = f.storeFor(encoder.encode(mutation));
      expect(() => request.decodeRegisteredEpisodeRequest(binding, f.expected), mutation).toThrow();
    }
    const invalidUtf8 = request.encodeEpisodeRequest(f.original);
    invalidUtf8[2] = 0xff;
    expect(() => request.decodeRegisteredEpisodeRequest(f.storeFor(invalidUtf8).binding, f.expected)).toThrow("CANONICAL");
    const live = fixture(1), liveText = decoder.decode(request.encodeEpisodeRequest(live.original));
    for (const extra of ['"caseIndex":0,', '"arenaSeedSlot":0,', '"arenaSeed":0,', '"inferenceSeed":0,']) {
      const bytes = encoder.encode(liveText.replace('"suite":"live-strategic"', `${extra}"suite":"live-strategic"`));
      expect(() => request.decodeRegisteredEpisodeRequest(live.storeFor(bytes).binding, live.expected)).toThrow();
    }
  });

  it("rejects incorrect wrapper production and economic IPC additions", () => {
    const f = fixture(), text = decoder.decode(request.encodeEconomicEpisodeRequest(f.wrapper));
    for (const mutation of [
      text.replace('"originalRequest":', '"extra":0,"originalRequest":'),
      text.replace('"originalRequest":', '"economicPinRef":{},"originalRequest":'),
      text.replace('"starchess-training-economic-request-v2"', '"starchess-training-economic-request-v1"'),
      text.replace('"master":101', '"master":101,"economicPinRef":{}'),
    ]) expect(() => request.decodeRegisteredEconomicEpisodeRequest(f.storeFor(encoder.encode(mutation)).binding, f.expected)).toThrow();
  });

  it("accepts only locally owned requests or private tokens backed by verified registered readers", async () => {
    const f = fixture(), { store, binding } = f.storeFor(), poisoned = hostile(f.original), other = hostile();
    const getter = vi.fn(() => { throw new Error("getter"); });
    const wide = Object.create(null);
    for (let index = 0; index < 8192; index++) {
      Object.defineProperty(wide, `hidden${index}`, { value: index });
      Object.defineProperty(wide, Symbol(), { get: getter });
    }
    Object.defineProperty(wide, "attemptId", { get: getter });
    const revoked = Proxy.revocable(f.original, {}); revoked.revoke();
    const bad = [undefined, null, {}, Object.freeze({ ...f.original }), structuredClone(f.original), poisoned.value, other.value,
      wide, revoked.proxy, f.wrapper, f.started, f.serial, f.expected, binding, constructCanonicalOpening()];
    for (const value of bad) {
      expect(() => request.requireEpisodeRequest(value)).toThrow("PROVENANCE");
      expect(() => request.encodeEpisodeRequest(value as EpisodeRequestV2)).toThrow("PROVENANCE");
      expect(() => request.validateEpisodeRequestStartup(value as EpisodeRequestV2, f.expected, store)).toThrow("PROVENANCE");
    }
    for (const value of [undefined, null, {}, f.original, { ...f.wrapper }, poisoned.value, wide]) {
      expect(() => request.requireEconomicEpisodeRequest(value)).toThrow("PROVENANCE");
      expect(() => request.encodeEconomicEpisodeRequest(value as PrivateEconomicRequestV2)).toThrow("PROVENANCE");
    }
    for (const value of [undefined, null, {}, poisoned.value, f.original, f.streams, wide]) {
      expect(() => request.requireEpisodeSchedule(value)).toThrow("PROVENANCE");
    }
    const counterfeitReader = Object.freeze({ length: 10, readByte: getter });
    for (const value of [undefined, null, {}, f.expected, counterfeitReader, poisoned.value, wide]) {
      expect(() => request.decodeRegisteredEpisodeRequest(value as request.EpisodeRequestByteBinding, f.expected)).toThrow("PROVENANCE");
      expect(() => request.decodeRegisteredEconomicEpisodeRequest(value as request.EpisodeRequestByteBinding, f.expected)).toThrow("PROVENANCE");
    }
    for (const value of [undefined, null, {}, f.original, poisoned.value, wide]) {
      expect(() => request.decodeRegisteredEpisodeRequest(binding, value as request.TrustedExpectedEpisodeBindings)).toThrow("PROVENANCE");
    }
    const modulePath = "../coordinator/episodeRequest?foreign-private-roles";
    const foreign: typeof request = await import(modulePath);
    const foreignOriginal = foreign.constructEpisodeRequest(f.attemptId, f.master, f.ordinal, f.weightsRef, f.manifestRef, f.baseline,
      foreign.constructCorpusSchedule(f.schedule.suite === "corpus" ? f.schedule.caseIndex : 0), f.streams);
    expect(() => request.requireEpisodeRequest(foreignOriginal)).toThrow("PROVENANCE");
    expect(() => foreign.decodeRegisteredEpisodeRequest(binding, f.expected)).toThrow("PROVENANCE");
    expect(getter).not.toHaveBeenCalled();
    expect(poisoned.trap).not.toHaveBeenCalled();
    expect(other.trap).not.toHaveBeenCalled();
  });

  it("checks trusted-parent constructors without enumerating any caller records", () => {
    const f = fixture(), poisoned = hostile(), bad = poisoned.value as never;
    for (const call of [
      () => request.constructDurableStartedEpisode(f.attemptId, 101, 0, bad, f.streams),
      () => request.constructDurableStartedEpisode(f.attemptId, 101, 0, f.schedule, bad),
      () => request.constructSerialMasterEpisodeStart(101, 1, 0, 0, bad, f.manifestRef, f.policy, f.opponent),
      () => request.constructSerialMasterEpisodeStart(101, 1, 0, 0, f.weightsRef, f.manifestRef, bad, f.opponent),
      () => request.constructLogicalExpectedEpisodeBindings(bad, f.serial, f.pinRef, f.manifestRef, f.manifestRef, f.manifestRef),
      () => request.constructLogicalExpectedEpisodeBindings(f.started, bad, f.pinRef, f.manifestRef, f.manifestRef, f.manifestRef),
      () => request.constructLogicalExpectedEpisodeBindings(f.started, f.serial, bad, f.manifestRef, f.manifestRef, f.manifestRef),
      () => request.constructLogicalExpectedEpisodeBindings(f.started, f.serial, f.pinRef, bad, f.manifestRef, f.manifestRef),
      () => request.constructEpisodeRequestByteBinding(bad, "hostConfiguration", f.pinRef),
      () => request.constructEconomicEpisodeRequest(bad, f.pinRef),
      () => request.constructEconomicEpisodeRequest(f.original, bad),
    ]) expect(call).toThrow("PROVENANCE");
    expect(poisoned.trap).not.toHaveBeenCalled();
  });

  it("bounds physical request bytes and requires the independent transport ref and store identity", () => {
    const f = fixture(), bytes = new Uint8Array(request.EPISODE_REQUEST_BYTE_CAP + 1), owner = createRegisteredByteStore();
    owner.register("hostConfiguration", refFor(bytes), bytes);
    const store = owner.seal();
    expect(() => request.constructEpisodeRequestByteBinding(store, "hostConfiguration", refFor(bytes))).toThrow("LIMIT");
    const { store: actual } = f.storeFor();
    expect(() => request.constructEpisodeRequestByteBinding(actual, "hostConfiguration", constructRef(1, "a".repeat(64)))).toThrow("MISMATCH");
    expect(() => request.constructEpisodeRequestByteBinding(actual, "source", refFor(request.encodeEpisodeRequest(f.original)))).toThrow("MISSING");
    expect(() => request.constructEpisodeRequestByteBinding(actual, "hostConfiguration", { ...refFor(request.encodeEpisodeRequest(f.original)) })).toThrow("PROVENANCE");
  });

  it("uses startup-owned finite H functions and leaves protocol, permit and model authority to their owners", () => {
    const source = readFileSync(new URL("../coordinator/episodeRequest.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/JSON\.(parse|stringify)|Reflect|Object\.(keys|entries|values|getOwnProperty|assign)|\.\.\.request\b|\.\.\.value\b/);
    expect(source).not.toMatch(/acceptedPermit|new Meter|spawn|arenaSeed|inferenceSeed|history|Math\.random/);
    expect(source).toContain("encodeOwnedNumber(serial.baselineCount");
    expect(source).toContain("decodeOwnedNumber(coefficient)");
    const contracts = readFileSync(new URL("../coordinator/episodeContracts.ts", import.meta.url), "utf8");
    expect(contracts).not.toContain("matchKey");
    expect(contracts).not.toContain("OriginalEpisodeRequestV2 extends");
  });
});
