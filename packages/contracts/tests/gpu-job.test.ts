// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { describe, expect, test } from "bun:test";
import { checkGpuTrainingState, decodeGpuAttemptInput, decodeGpuAttemptProposal, decodeGpuJobReply, decodeGpuJobStart, GPU_JOB_VERSION,
  gpuJobSha256, MAX_GPU_JOB_OUTPUT_BYTES, parseClosedJson } from "../src/gpu-job";
import { initialTrainingState, nextAttempt } from "../../runtime/src/curriculum";
import { bindings, byteRef, syntheticRecord } from "../../runtime/tests/training-fixture";
import { trainingStateShape } from "../src/training-state";

function fixture() {
  const model = syntheticRecord("gpu-contract-fixture"), initial = initialTrainingState(101, model.config.recordSha256, bindings());
  const { descriptor, consumed } = nextAttempt(initial, "attempt-0"), state = structuredClone(consumed);
  state.counters.verifiedCompleted = 1;
  state.historyRefs.push(byteRef("history"));
  state.journalRef = { ...byteRef("journal"), lastRecordOrdinal: 1 };
  const descriptorJson = JSON.stringify(descriptor), descriptorSha256 = gpuJobSha256(descriptorJson);
  const input = { version: "chess-coach.gpu-attempt-input.v1" as const, bindings: initial.bindings, modelConfig: model.config,
    recordRef: { byteLength: model.record.byteLength, sha256: model.config.recordSha256 }, initialStateSha256: gpuJobSha256(JSON.stringify(initial)),
    expectedDescriptorSha256: descriptorSha256, initialModelId: initial.modelId };
  const proposal = { version: "chess-coach.gpu-attempt-proposal.v1" as const, descriptor, initialModelId: initial.modelId, state };
  return { initial, input, descriptor, descriptorJson, descriptorSha256, proposal, state };
}

function zeroIntegerProposal() {
  const f = fixture(), proposal = structuredClone(f.proposal);
  proposal.descriptor.schedule = { kind: "corpus", corpusIndex: 0, candidateSide: "b" };
  proposal.state.control.corpusPermutation = Array.from({ length: 18 }, (_, index) => index);
  proposal.state.control.corpusCursor = 0;
  proposal.state.journalRef = { ...byteRef(""), lastRecordOrdinal: 0 };
  proposal.state.historyRefs[0]!.byteLength = 0;
  for (const label of ["selection", "environment-settlement", "policy-sampling", "opponent"] as const) {
    Object.assign(proposal.state.rng[label], { root: 0, state: 0, drawCount: 0 });
  }
  return proposal;
}

function negativeZeroIntegerLiterals(json: string): string {
  return json.replaceAll(":0,", ":-0,").replaceAll(":0}", ":-0}").replaceAll("[0,", "[-0,")
    .replace('"frozenBaseline":-0', '"frozenBaseline":0');
}

describe("GPU closed boundary", () => {
  test("accepts exact input and outer identities without control frames", () => {
    const f = fixture(), inputJson = JSON.stringify(f.input), inputSha256 = gpuJobSha256(inputJson);
    const start = { version: GPU_JOB_VERSION, sessionId: "a._:-9", operation: "run-attempt", attemptId: "attempt-0", inputJson, inputSha256, ownerElapsedNs: "0" };
    expect(decodeGpuAttemptInput(inputJson, inputSha256)).toEqual(f.input);
    expect(decodeGpuJobStart(JSON.stringify(start)).attemptId).toBe("attempt-0");
    expect(decodeGpuJobReply(JSON.stringify({ version: GPU_JOB_VERSION, sessionId: start.sessionId, kind: "boot" })).kind).toBe("boot");
    expect(MAX_GPU_JOB_OUTPUT_BYTES).toBe(3 * 1048577);
    for (const ownerElapsedNs of ["00", "+1", "-1", "1.0", "9223372036854775808", "1e3"]) expect(() => decodeGpuJobStart(JSON.stringify({ ...start, ownerElapsedNs }))).toThrow();
    for (const attemptId of ["", "a".repeat(33), "a/b"]) expect(() => decodeGpuJobStart(JSON.stringify({ ...start, attemptId }))).toThrow();
    for (const sessionId of ["", "a".repeat(65), "a/b"]) expect(() => decodeGpuJobStart(JSON.stringify({ ...start, sessionId }))).toThrow();
    for (const kind of ["close", "closed", "retry"]) expect(() => decodeGpuJobReply(JSON.stringify({ version: GPU_JOB_VERSION, sessionId: "a", kind }))).toThrow();
    expect(() => decodeGpuJobStart(JSON.stringify({ ...start, close: true }))).toThrow();
    expect(() => decodeGpuJobStart(JSON.stringify({ ...start, inputJson: "é".repeat(32769) }))).toThrow();
  });
  test("binds original input bytes, all model identities and nested closed fields", () => {
    const f = fixture(), json = JSON.stringify(f.input);
    expect(() => decodeGpuAttemptInput(" " + json, gpuJobSha256(json))).toThrow("HASH");
    for (const input of [{ ...f.input, initialModelId: "0".repeat(64) }, { ...f.input, recordRef: { ...f.input.recordRef, byteLength: 0 } },
      { ...f.input, recordRef: { ...f.input.recordRef, byteLength: 1048577 } }, { ...f.input, modelConfig: { ...f.input.modelConfig, recordSha256: "0".repeat(64) } },
      { ...f.input, bindings: { ...f.input.bindings, unknown: byteRef() } }, { ...f.input, layout: {} }]) expect(() => decodeGpuAttemptInput(JSON.stringify(input))).toThrow();
  });
  test("rejects recursively escaped duplicate keys, malformed JSON and resource excess", () => {
    for (const json of ['{"a":1,"\\u0061":2}', '{"a":{"x":1,"\\u0078":2}}', '[{"a":1,"a":1}]', '{"a":1,}', '[1,]',
      '{"a":01}', '{"a":NaN}', '{"a":1e999}', '{"a":9007199254740992}', '{"a":"\n"}', '{"a":true} trailing', '\ufeff{}', '"\ud800"']) expect(() => parseClosedJson(json)).toThrow();
    expect(() => parseClosedJson("[".repeat(34) + "0" + "]".repeat(34))).toThrow();
    expect(() => parseClosedJson(JSON.stringify(Array(16385).fill(0)))).toThrow();
    expect(() => parseClosedJson(" ".repeat(1048577))).toThrow();
    expect(parseClosedJson('{"x":"brace } \\\" ","a":[true,false,null,-1.5e-2]}')).toEqual({ x: 'brace } " ', a: [true, false, null, -0.015] });
  });
});

describe("GPU original descriptor token commitment", () => {
  test("accepts literal negative-zero integers only with the exact changed descriptor commitment", () => {
    const proposal = zeroIntegerProposal(), canonical = JSON.stringify(proposal), canonicalDescriptor = JSON.stringify(proposal.descriptor);
    const oldPin = gpuJobSha256(canonicalDescriptor), json = negativeZeroIntegerLiterals(canonical), descriptor = negativeZeroIntegerLiterals(canonicalDescriptor);
    expect(decodeGpuAttemptProposal(canonical, gpuJobSha256(canonical), oldPin)).toEqual(proposal);
    expect(json).toContain('"historyRefs":[{"byteLength":-0');
    expect(json).toContain('"corpusPermutation":[-0,1');
    expect(json).toContain('"baselineSum":-0');
    expect(json).toContain('"root":-0');
    expect(json).toContain('"state":-0');
    expect(json).toContain('"drawCount":-0');
    expect(descriptor).toContain('"startedOrdinal":-0');
    expect(descriptor).toContain('"corpusIndex":-0');
    expect(descriptor).toContain('"frozenBaseline":0,');
    expect(() => decodeGpuAttemptProposal(json, gpuJobSha256(json), oldPin)).toThrow("DESCRIPTOR_HASH");
    const newPin = gpuJobSha256(descriptor);
    expect(newPin).not.toBe(oldPin);
    const parsed = decodeGpuAttemptProposal(json, gpuJobSha256(json), newPin);
    expect(JSON.stringify(parsed)).toBe(canonical);
    expect(parsed.state.historyRefs[0]!.byteLength === 0).toBe(true);
    expect(parsed.state.rng.selection.root === 0 && parsed.state.rng.selection.state === 0).toBe(true);
    expect(Object.is(parseClosedJson("-0"), -0)).toBe(true);
  });
  test("accepts literal negative-zero live ordinals without changing descriptor token hashing", () => {
    const proposal = zeroIntegerProposal();
    proposal.descriptor.schedule = { kind: "live", liveOrdinal: 0, candidateSide: "w" };
    const canonical = JSON.stringify(proposal), originalDescriptor = JSON.stringify(proposal.descriptor), oldPin = gpuJobSha256(originalDescriptor);
    const descriptor = negativeZeroIntegerLiterals(originalDescriptor), json = canonical.replace(originalDescriptor, descriptor);
    expect(descriptor).toContain('"liveOrdinal":-0');
    expect(() => decodeGpuAttemptProposal(json, gpuJobSha256(json), oldPin)).toThrow("DESCRIPTOR_HASH");
    const parsed = decodeGpuAttemptProposal(json, gpuJobSha256(json), gpuJobSha256(descriptor));
    expect(parsed.descriptor.schedule.kind === "live" && parsed.descriptor.schedule.liveOrdinal === 0).toBe(true);
    expect(JSON.stringify(parsed)).toBe(canonical);
  });
  test("retains Bun semantic integer spellings beyond the narrower Rust integer token grammar", () => {
    const proposal = zeroIntegerProposal(), canonical = JSON.stringify(proposal), pin = gpuJobSha256(JSON.stringify(proposal.descriptor));
    for (const token of ["-0.0", "-0e0", "0.0", "0e0"]) {
      const json = canonical.replace('"baselineSum":0', `"baselineSum":${token}`);
      expect(JSON.stringify(decodeGpuAttemptProposal(json, gpuJobSha256(json), pin))).toBe(canonical);
    }
    for (const token of ["1.0", "1e0"]) {
      const json = canonical.replace('"started":1', `"started":${token}`);
      expect(JSON.stringify(decodeGpuAttemptProposal(json, gpuJobSha256(json), pin))).toBe(canonical);
    }
    for (const token of ["true", '"0"', "9007199254740992"]) {
      const json = canonical.replace('"baselineSum":0', `"baselineSum":${token}`);
      expect(() => decodeGpuAttemptProposal(json, gpuJobSha256(json), pin)).toThrow();
    }
  });
  test("accepts outer formatting and decoded escaped property names", () => {
    const f = fixture(), json = JSON.stringify(f.proposal);
    const variants = [json, " \n" + json + "\t", json.replace('"descriptor":', '"\\u0064escriptor" : \n'),
      `{"state":${JSON.stringify(f.state)},"descriptor": ${f.descriptorJson} ,"initialModelId":"${f.initial.modelId}","version":"chess-coach.gpu-attempt-proposal.v1"}`];
    for (const proposalJson of variants) expect(decodeGpuAttemptProposal(proposalJson, gpuJobSha256(proposalJson), f.descriptorSha256)).toEqual(f.proposal);
  });
  test("rejects inside-token whitespace, reordering and Unicode escapes despite refreshed enclosing hashes", () => {
    const f = fixture(), json = JSON.stringify(f.proposal);
    const { version, ...rest } = f.descriptor;
    const tokens = [JSON.stringify(f.descriptor, null, 1), JSON.stringify({ ...rest, version }), f.descriptorJson.replace('"master"', '"\\u006daster"'),
      f.descriptorJson.replace("chess-coach.attempt.v1", "chess-coach.attempt.v\\u0031")];
    for (const token of tokens) {
      const proposalJson = json.replace(f.descriptorJson, token);
      expect(() => decodeGpuAttemptProposal(proposalJson, gpuJobSha256(proposalJson), f.descriptorSha256)).toThrow("DESCRIPTOR_HASH");
      expect(decodeGpuAttemptProposal(proposalJson, gpuJobSha256(proposalJson), gpuJobSha256(token))).toEqual(f.proposal);
    }
  });
  test("rejects escaped descriptor duplicates in the same bounded parse", () => {
    const f = fixture(), json = JSON.stringify(f.proposal), duplicate = json.replace('"descriptor":', `"\\u0064escriptor":${f.descriptorJson},"descriptor":`);
    expect(() => decodeGpuAttemptProposal(duplicate, gpuJobSha256(duplicate), f.descriptorSha256)).toThrow("CLOSED_JSON");
    const nested = json.replace('"master":101', '"master":101,"\\u006daster":101');
    expect(() => decodeGpuAttemptProposal(nested, gpuJobSha256(nested))).toThrow("CLOSED_JSON");
    expect(() => decodeGpuAttemptProposal(json, "0".repeat(64), f.descriptorSha256)).toThrow("HASH");
  });
  test("accepts opaque alternate RNG roots, valid prefixes and a different corpus permutation", () => {
    const f = fixture(), proposal = structuredClone(f.proposal), { state } = proposal;
    for (const [index, label] of (["selection", "environment-settlement", "policy-sampling", "opponent"] as const).entries()) {
      const stream = state.rng[label];
      stream.root = (stream.root ^ 0xffffffff) >>> 0;
      stream.drawCount = label === "environment-settlement" ? 0 : Number.MAX_SAFE_INTEGER - index;
      stream.state = Number((BigInt(stream.root) + BigInt(stream.drawCount) * 0x6d2b79f5n) & 0xffffffffn);
    }
    state.control.corpusPermutation.reverse();
    state.control.corpusCursor = 18;
    state.control.corpusEpoch = 999;
    expect(state.rng.selection.root).not.toBe(f.state.rng.selection.root);
    expect(state.control.corpusPermutation).not.toEqual(f.state.control.corpusPermutation);
    expect(checkGpuTrainingState(state)).toEqual(trainingStateShape.parse(state));
    const json = JSON.stringify(proposal);
    expect(decodeGpuAttemptProposal(json, gpuJobSha256(json), f.descriptorSha256)).toEqual(proposal);
  });
  test("accepts schema-valid descriptor, journal, model and update alternatives without replay", () => {
    const f = fixture();
    const changes = [
      (p: typeof f.proposal) => { p.descriptor.frozenBaseline = 0.5; },
      (p: typeof f.proposal) => { p.descriptor.schedule = { kind: "live", liveOrdinal: 499, candidateSide: "w" }; },
      (p: typeof f.proposal) => { p.state.modelId = "0".repeat(64); },
      (p: typeof f.proposal) => { p.state.control.corpusCursor = 2; },
      (p: typeof f.proposal) => { p.state.journalRef = null; },
      (p: typeof f.proposal) => { p.state.journalRef = { ...byteRef(""), lastRecordOrdinal: 0 }; },
      (p: typeof f.proposal) => { p.state.historyRefs[0]!.byteLength = 0; },
      (p: typeof f.proposal) => { Object.assign(p.state.counters, { eligibleCompleted: 1, updates: 1, baselineCount: 1, baselineSum: 1 }); },
    ];
    for (const change of changes) {
      const proposal = structuredClone(f.proposal); change(proposal);
      expect(checkGpuTrainingState(proposal.state)).toEqual(trainingStateShape.parse(proposal.state));
      const json = JSON.stringify(proposal);
      expect(decodeGpuAttemptProposal(json, gpuJobSha256(json), gpuJobSha256(JSON.stringify(proposal.descriptor)))).toEqual(proposal);
    }
    const pending = structuredClone(f.initial);
    pending.counters.started = pending.control.scheduleCursor = 5;
    pending.control.liveOrdinal = 2;
    pending.journalRef = { ...byteRef("journal"), lastRecordOrdinal: 1 };
    expect(checkGpuTrainingState(pending)).toEqual(trainingStateShape.parse(pending));
  });
  test("retains existing closed state, prefix, counter, history and control predicates", () => {
    const f = fixture();
    expect(checkGpuTrainingState(f.initial)).toEqual(f.initial);
    expect(checkGpuTrainingState(f.state)).toEqual(f.state);
    const changes = [
      (p: typeof f.proposal) => { p.state.initializationSeed = 102; },
      (p: typeof f.proposal) => { p.state.counters.verifiedCompleted = 0; },
      (p: typeof f.proposal) => { p.state.counters.verifiedCompleted = 2; p.state.historyRefs.push(byteRef("other")); },
      (p: typeof f.proposal) => { p.state.counters.nonzeroPGUpdates = 1; },
      (p: typeof f.proposal) => { p.state.counters.updates = 1; },
      (p: typeof f.proposal) => { p.state.counters.eligibleCompleted = 1; },
      (p: typeof f.proposal) => { p.state.counters.baselineCount = 1; },
      (p: typeof f.proposal) => { p.state.counters.baselineSum = 1; },
      (p: typeof f.proposal) => { p.state.control.scheduleCursor = 2; },
      (p: typeof f.proposal) => { p.state.control.liveOrdinal = 1; },
      (p: typeof f.proposal) => { p.state.control.corpusPermutation[0] = p.state.control.corpusPermutation[1]!; },
      (p: typeof f.proposal) => { p.state.control.dueBucket = 1; },
      (p: typeof f.proposal) => { p.state.control.fulfilledBucket = 1; },
      (p: typeof f.proposal) => { p.state.control.corpusCursor = 19; },
      (p: typeof f.proposal) => { p.state.control.corpusEpoch = 1000; },
      (p: typeof f.proposal) => { p.state.rng.selection.state++; },
      (p: typeof f.proposal) => { p.state.rng["policy-sampling"].drawCount++; },
      (p: typeof f.proposal) => { p.state.rng.opponent.root++; },
      (p: typeof f.proposal) => { p.state.rng["environment-settlement"].status = "active"; },
      (p: typeof f.proposal) => { p.state.rng.selection.status = "unused"; },
      (p: typeof f.proposal) => { p.state.historyRefs = []; },
      (p: typeof f.proposal) => { Object.assign(p.state.control, { extra: 0 }); },
    ];
    for (const change of changes) {
      const proposal = structuredClone(f.proposal); change(proposal);
      expect(() => checkGpuTrainingState(proposal.state)).toThrow();
      expect(() => decodeGpuAttemptProposal(JSON.stringify(proposal))).toThrow();
    }
  });
  test("retains exactly the accepted first-attempt proposal bindings", () => {
    const f = fixture();
    const changes = [
      (p: typeof f.proposal) => { p.descriptor.attemptId = "a".repeat(33); },
      (p: typeof f.proposal) => { p.descriptor.master = 102; },
      (p: typeof f.proposal) => { p.descriptor.startedOrdinal = 1; },
      (p: typeof f.proposal) => { p.descriptor.modelId = "0".repeat(64); },
      (p: typeof f.proposal) => { p.state.master = p.state.initializationSeed = 102; },
      (p: typeof f.proposal) => { p.state.counters.started = p.state.control.scheduleCursor = 2; p.state.control.liveOrdinal = 1; },
      (p: typeof f.proposal) => { p.state.counters.verifiedCompleted = 0; p.state.historyRefs = []; },
    ];
    for (const change of changes) {
      const proposal = structuredClone(f.proposal); change(proposal);
      const json = JSON.stringify(proposal);
      expect(() => decodeGpuAttemptProposal(json, gpuJobSha256(json), gpuJobSha256(JSON.stringify(proposal.descriptor)))).toThrow("GPU proposal binding");
    }
  });
});
