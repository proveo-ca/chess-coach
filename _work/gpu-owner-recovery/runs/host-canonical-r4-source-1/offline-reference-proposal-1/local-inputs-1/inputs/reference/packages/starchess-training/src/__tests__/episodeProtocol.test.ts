// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  createEpisodeChannel, encodeEpisodeMessage, EPISODE_LIMITS, rawFrameReceipt, requireDecodedEpisodeMessage,
} from "../coordinator/episodeProtocol";
import { constructRef } from "../economic/ownedKernel";
import { encodeOwnedNumber } from "../economic/ownedScalars";
import type { CompleteMessage, DecisionResultMessage, EpisodeMessage, EpisodeScoreAccumulator, TurnOpenAcceptedMessage } from "../coordinator/episodeContracts";
import { constructActiveStreamState, constructEpisodeStartStreams, constructUnusedEnvironmentState } from "../coordinator/episodeRng";

const ack = (ordinal = 0, id = "attempt"): TurnOpenAcceptedMessage => Object.freeze({ version: "starchess-training-episode-v2",
  attemptId: id, messageOrdinal: ordinal, kind: "turn-open-accepted", planningOrdinal: 0, nextPermit: null });
const journal = (): DecisionResultMessage => {
  const state = constructActiveStreamState(1, 1, 0), ref = constructRef(0, "0".repeat(64));
  return Object.freeze({ version: "starchess-training-episode-v2", attemptId: "attempt", messageOrdinal: 0, kind: "decision-result", role: "candidate",
    journalEntry: Object.freeze({ decisionId: Object.freeze({ planningOrdinal: 0, side: "b" }), permitId: "attempt:plan:0:b",
      historyDigest: ref, manifestDigest: ref, generatorVersion: "challenge-composition-v3", orderedCandidateKeysDigest: ref, selectedIndex: 0,
      selectedKey: "[]", actions: Object.freeze([]), requestedSpend: Object.freeze({ minerals: 0, gas: 0 }), uniform: encodeOwnedNumber(0),
      selectedLogProbability: encodeOwnedNumber(0), samplingBefore: state, samplingAfter: state }) });
};
const wire = (direction: "parent" | "child" = "child", id = "attempt", clock = () => 123n) => {
  const input = new PassThrough(), output = new PassThrough();
  const channel = createEpisodeChannel(input, output, id, direction, clock);
  return { input, output, channel };
};
const completion = (): CompleteMessage => {
  const state = constructActiveStreamState(1, 1, 0);
  return { version: "starchess-training-episode-v2", attemptId: "attempt", messageOrdinal: 0, kind: "complete",
    acceptedCandidateDecisionIds: [], acceptedOpponentDecisionIds: [], scoreAccumulator: Object.freeze(Array.from({ length: 418 }, () => encodeOwnedNumber(0))) as EpisodeScoreAccumulator,
    rngSummaries: constructEpisodeStartStreams(state, constructUnusedEnvironmentState(2), state, state),
    stopProof: { stop: { kind: "exception", phase: "fixture", planningOrdinal: 0, turn: 0 }, origin: "infrastructure", reason: "protocol",
      checkedBoundaryOrdinal: 0, acceptedCandidateCount: 0, evidenceRef: constructRef(0, "0".repeat(64)) } };
};
const completionPrefix = Buffer.from('{"acceptedCandidateDecisionIds":');
const maximalCompletionLine = Buffer.alloc(EPISODE_LIMITS.maxCompletionBytes + 1, 120);
completionPrefix.copy(maximalCompletionLine); maximalCompletionLine[maximalCompletionLine.length - 1] = 10;
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
describe("closed registered episode channel", () => {
  it("stamps the complete raw frame before decoding, across chunks", async () => {
    let time = 1n;
    const w = wire("child", "attempt", () => time);
    const bytes = encodeEpisodeMessage(ack());
    w.input.write(bytes.subarray(0, 13)); time = 777n;
    w.input.write(Buffer.concat([bytes.subarray(13), Buffer.from("\n")]));
    const frame = await w.channel.receive();
    expect(rawFrameReceipt(frame)).toBe(777n);
    expect(() => requireDecodedEpisodeMessage(frame)).toThrow("CHANNEL");
    expect(w.channel.decode(frame)).toEqual(ack());
    expect(rawFrameReceipt(frame)).toBe(777n);
    expect(() => w.channel.decode(frame)).toThrow("CHANNEL");
    w.channel.close();
  });
  it("handles the maximal attempt ID without header-prefix truncation", async () => {
    const id = "a".repeat(64), w = wire("child", id);
    const message: EpisodeMessage = { version: "starchess-training-episode-v2", attemptId: id, messageOrdinal: 0,
      kind: "decision-accepted", decisionId: { planningOrdinal: 0, side: "b" }, nextPermit: null };
    w.input.write(Buffer.concat([encodeEpisodeMessage(message), Buffer.from("\n")]));
    expect(w.channel.decode(await w.channel.receive())).toEqual(message); w.channel.close();
  });
  it("parses the compact v3 journal without distributions or feature tensors", async () => {
    const w = wire("parent"), message = journal();
    w.input.write(Buffer.concat([encodeEpisodeMessage(message), Buffer.from("\n")]));
    const parsed = w.channel.decode(await w.channel.receive());
    expect(parsed).toEqual(message);
    expect(parsed).not.toBe(message); w.channel.close();
  });
  it("parses only the exact 418-value completion statistics and rejects extra economics", async () => {
    const w = wire("parent"), message = completion();
    w.input.write(encodeEpisodeMessage(message).toString() + "\n");
    expect(w.channel.decode(await w.channel.receive())).toEqual(message); w.channel.close();
    expect(() => encodeEpisodeMessage({ ...message, scoreAccumulator: message.scoreAccumulator.slice(1) } as never)).toThrow("SIZE");
    expect(() => encodeEpisodeMessage({ ...message, usage: 12 } as never)).toThrow("SCHEMA");
    const extra = wire("parent");
    extra.input.write(encodeEpisodeMessage(message).toString().replace('"scoreAccumulator":', '"probabilities":[],"scoreAccumulator":') + "\n");
    const frame = await extra.channel.receive(); expect(() => extra.channel.decode(frame)).toThrow(); extra.channel.close();
  });
  it("parses the exact five-field permit and strategic journal productions", async () => {
    const w = wire(), permit = { permitId: "attempt:plan:0:b", planningOrdinal: 0, turn: 0, side: "b", role: "candidate" } as const;
    w.input.write(encodeEpisodeMessage({ ...ack(), nextPermit: permit }).toString() + "\n");
    expect(w.channel.decode(await w.channel.receive())).toEqual({ ...ack(), nextPermit: permit }); w.channel.close();
    expect(() => encodeEpisodeMessage({ ...ack(), nextPermit: { ...permit, deadline: 10000 } } as never)).toThrow("SCHEMA");
    const state = constructActiveStreamState(1, 1, 0), strategic: DecisionResultMessage = { version: "starchess-training-episode-v2", attemptId: "attempt",
      messageOrdinal: 0, kind: "decision-result", role: "strategic", journalEntry: { decisionId: { planningOrdinal: 0, side: "w" },
        permitId: "attempt:plan:0:w", actions: [], reportedMinSpend: 0, opponentBefore: state, opponentAfter: state } };
    const parent = wire("parent"); parent.input.write(encodeEpisodeMessage(strategic).toString() + "\n");
    expect(parent.channel.decode(await parent.channel.receive())).toEqual(strategic); parent.channel.close();
  });
  it("enforces the raw 16MiB completion bound before parsing", async () => {
    const w = wire("parent");
    w.input.write(Buffer.from('{"acceptedCandidateDecisionIds":'));
    w.input.write(Buffer.alloc(EPISODE_LIMITS.maxCompletionBytes, 120));
    await expect(w.channel.receive()).rejects.toThrow("SIZE"); w.channel.close();
  });
  it.each([
    (s: string) => s.replace('"planningOrdinal":0', '"planningOrdinal":0,"used":1'),
    (s: string) => s.replace('"nextPermit":null', '"nextPermit":null,"authority":true'),
    (s: string) => s.replace('"kind":"turn-open-accepted"', '"kind":"status"'),
    (s: string) => s.replace('"messageOrdinal":0', '"messageOrdinal":0,"messageOrdinal":0'),
    (s: string) => ` ${s}`,
    (s: string) => s.replace('"planningOrdinal":0', '"planningOrdinal":-0'),
  ])("rejects noncanonical and undeclared fields before publishing a message", async change => {
    const w = wire(); w.input.write(change(encodeEpisodeMessage(ack()).toString()) + "\n");
    const awaitFrame = await w.channel.receive();
    expect(() => w.channel.decode(awaitFrame)).toThrow(); w.channel.close();
  });
  it("rejects fake raw-frame handles and cross-channel substitution", async () => {
    const a = wire(), b = wire();
    expect(() => a.channel.decode({} as never)).toThrow("CHANNEL");
    a.input.write(encodeEpisodeMessage(ack()).toString() + "\n");
    const frame = await a.channel.receive();
    expect(() => b.channel.decode(frame)).toThrow("CHANNEL"); a.channel.close(); b.channel.close();
  });
  it("rejects unsolicited native graphs instead of adopting claims", () => {
    expect(() => encodeEpisodeMessage({ version: "starchess-training-episode-v2", attemptId: "attempt", messageOrdinal: 0,
      kind: "turn-open-result", planningOrdinal: 0, begin: {} } as never)).toThrow("provenance");
  });
  it("enforces raw progress size before decode and the fixed combined IPC cap", async () => {
    const w = wire();
    w.input.write(Buffer.alloc(EPISODE_LIMITS.maxProgressBytes + 1, 120));
    await expect(w.channel.receive()).rejects.toThrow("SIZE"); w.channel.close();
    const count = wire();
    for (let i = 0; i < EPISODE_LIMITS.maxIpcMessages; i++) {
      count.input.write(encodeEpisodeMessage(ack(i)).toString() + "\n");
      count.channel.decode(await count.channel.receive());
    }
    await expect(count.channel.write(journal())).rejects.toThrow("SIZE"); count.channel.close();
  });
  it("rejects role/ordinal/session mismatches without extending receipt time", async () => {
    const wrongId = wire(); wrongId.input.write(encodeEpisodeMessage(ack(0, "other")).toString() + "\n");
    const frameId = await wrongId.channel.receive();
    expect(() => wrongId.channel.decode(frameId)).toThrow("ORDINAL"); wrongId.channel.close();
    const wrongOrdinal = wire(); wrongOrdinal.input.write(encodeEpisodeMessage(ack(1)).toString() + "\n");
    const frameOrdinal = await wrongOrdinal.channel.receive();
    expect(() => wrongOrdinal.channel.decode(frameOrdinal)).toThrow("ORDINAL"); wrongOrdinal.channel.close();
  });
  it("rejects an aggregate completion burst before copying or assembling it", async () => {
    const w = wire("parent"), burst = Buffer.alloc(maximalCompletionLine.length * 3);
    for (let offset = 0; offset < burst.length; offset += maximalCompletionLine.length) maximalCompletionLine.copy(burst, offset);
    const from = vi.spyOn(Buffer, "from"), concat = vi.spyOn(Buffer, "concat"), allocate = vi.spyOn(Buffer, "allocUnsafeSlow");
    try {
      w.input.emit("data", burst);
      await expect(w.channel.receive()).rejects.toThrow("SIZE");
      expect(from.mock.calls.length).toBe(0); expect(concat.mock.calls.length).toBe(0); expect(allocate.mock.calls.length).toBe(0);
    } finally { vi.restoreAllMocks(); w.channel.close(); }
  });
  it("retains only one undecoded handle and pauses completion-prefixed bursts", async () => {
    const w = wire("parent");
    w.input.write(maximalCompletionLine);
    expect(w.input.isPaused()).toBe(true);
    const frame = await w.channel.receive();
    expect(w.input.isPaused()).toBe(true);
    await expect(w.channel.receive()).rejects.toThrow("CHANNEL");
    const copy = vi.spyOn(Buffer.prototype, "copy");
    try {
      for (let i = 1; i < EPISODE_LIMITS.maxIpcMessages; i++) w.input.write(maximalCompletionLine);
      expect(copy.mock.calls.length).toBe(0);
    } finally { copy.mockRestore(); }
    expect(() => w.channel.decode(frame)).toThrow("CANONICAL");
    await expect(w.channel.receive()).rejects.toThrow("CANONICAL"); w.channel.close();
  });
  it("admits coalesced maximal progress plus completion framing above C + I", async () => {
    const w = wire("parent"), progressLength = EPISODE_LIMITS.maxProgressBytes;
    const bytes = Buffer.alloc(progressLength + 1 + maximalCompletionLine.length, 120);
    bytes[progressLength] = 10; maximalCompletionLine.copy(bytes, progressLength + 1);
    w.input.write(bytes);
    const frame = await w.channel.receive();
    expect(rawFrameReceipt(frame)).toBe(123n); expect(w.input.isPaused()).toBe(true);
    expect(() => w.channel.decode(frame)).toThrow("CANONICAL"); w.channel.close();
  });
  it("bounds backing allocations while assembling two maximal completion lines", async () => {
    const w = wire("parent"), bytes = Buffer.alloc(maximalCompletionLine.length * 2);
    maximalCompletionLine.copy(bytes); maximalCompletionLine.copy(bytes, maximalCompletionLine.length);
    const allocate = vi.spyOn(Buffer, "allocUnsafeSlow");
    try {
      w.input.emit("data", bytes); const frame = await w.channel.receive();
      const capacities = allocate.mock.results.map(result => result.value.buffer.byteLength as number);
      expect(capacities.filter(size => size === 65536)).toHaveLength(256);
      expect(capacities[0]).toBe(maximalCompletionLine.length);
      expect(capacities.at(-1)).toBe(EPISODE_LIMITS.maxCompletionBytes);
      expect(capacities.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(3 * EPISODE_LIMITS.maxCompletionBytes + EPISODE_LIMITS.maxIpcMessages);
      expect(() => w.channel.decode(frame)).toThrow("CANONICAL");
    } finally { vi.restoreAllMocks(); w.channel.close(); }
  });
  it("rejects an oversized captured remainder before any buffer allocation or copy", async () => {
    const w = wire(), first = encodeEpisodeMessage(ack()), bytes = Buffer.alloc(first.length + 1 + maximalCompletionLine.length + EPISODE_LIMITS.maxIpcMessages, 120);
    first.copy(bytes); bytes[first.length] = 10; maximalCompletionLine.copy(bytes, first.length + 1);
    const from = vi.spyOn(Buffer, "from"), concat = vi.spyOn(Buffer, "concat"), allocate = vi.spyOn(Buffer, "allocUnsafeSlow"), copy = vi.spyOn(Buffer.prototype, "copy");
    try {
      w.input.emit("data", bytes); await expect(w.channel.receive()).rejects.toThrow("SIZE");
      expect(from.mock.calls.length).toBe(0); expect(concat.mock.calls.length).toBe(0); expect(allocate.mock.calls.length).toBe(0); expect(copy.mock.calls.length).toBe(0);
    } finally { vi.restoreAllMocks(); w.channel.close(); }
  });
  it("preflights split non-completion prefixes before progress growth", async () => {
    const w = wire("parent"), prefix = Buffer.from(completionPrefix), bytes = Buffer.alloc(EPISODE_LIMITS.maxProgressBytes, 120);
    prefix[prefix.length - 1] = 120; w.input.emit("data", prefix.subarray(0, prefix.length - 1)); bytes[0] = 120;
    const allocate = vi.spyOn(Buffer, "allocUnsafeSlow"), from = vi.spyOn(Buffer, "from"), concat = vi.spyOn(Buffer, "concat"), copy = vi.spyOn(Buffer.prototype, "copy");
    try {
      w.input.emit("data", bytes); await expect(w.channel.receive()).rejects.toThrow("SIZE");
      expect(allocate.mock.calls.length).toBe(0); expect(from.mock.calls.length).toBe(0); expect(concat.mock.calls.length).toBe(0); expect(copy.mock.calls.length).toBe(0);
    } finally { vi.restoreAllMocks(); w.channel.close(); }
  });
  it("decodes coalesced canonical progress and completion without renewing receipts", async () => {
    let time = 7n;
    const now = vi.fn(() => time), w = wire("parent", "attempt", now), progress = journal(), done = { ...completion(), messageOrdinal: 1 };
    w.input.write(Buffer.concat([encodeEpisodeMessage(progress), Buffer.from("\n"), encodeEpisodeMessage(done), Buffer.from("\n")]));
    const first = await w.channel.receive(); time = 999999999999n;
    expect(w.channel.decode(first)).toEqual(progress);
    const last = await w.channel.receive();
    expect(rawFrameReceipt(last)).toBe(7n); expect(now).toHaveBeenCalledOnce();
    expect(w.channel.decode(last)).toEqual(done); expect(requireDecodedEpisodeMessage(first)).toEqual(progress); w.channel.close();
  });
  it("drains complete frames before clean EOF and preserves completion identity", async () => {
    const w = wire("parent"), message = completion();
    w.input.end(Buffer.concat([encodeEpisodeMessage(message), Buffer.from("\n")])); await turn();
    const frame = await w.channel.receive(), decoded = w.channel.decode(frame);
    expect(decoded).toEqual(message); expect(requireDecodedEpisodeMessage(frame)).toBe(decoded);
    await expect(w.channel.receive()).rejects.toThrow("CLOSED");
    expect(requireDecodedEpisodeMessage(frame)).toBe(decoded); expect(rawFrameReceipt(frame)).toBe(123n); w.channel.close();
  });
  it.each(["", "unterminated"])("drains coalesced frames before EOF tail %j", async tail => {
    const w = wire(), bytes = Buffer.from(encodeEpisodeMessage(ack()).toString() + "\n" + encodeEpisodeMessage(ack(1)).toString() + "\n" + tail);
    w.input.emit("data", bytes); w.input.emit("end");
    const first = await w.channel.receive(); expect(w.channel.decode(first)).toEqual(ack());
    const last = await w.channel.receive(), decoded = w.channel.decode(last);
    expect(decoded).toEqual(ack(1)); expect(requireDecodedEpisodeMessage(last)).toBe(decoded);
    await expect(w.channel.receive()).rejects.toThrow(tail ? "CANONICAL" : "CLOSED");
    expect(requireDecodedEpisodeMessage(first)).toEqual(ack()); w.channel.close();
  });
  it("rejects an unterminated-only EOF as CANONICAL", async () => {
    const w = wire(); w.input.end(encodeEpisodeMessage(ack())); await turn();
    await expect(w.channel.receive()).rejects.toThrow("CANONICAL"); w.channel.close();
  });
  it("stamps deferred delimiters at arrival and stamps split frames only at their LF", async () => {
    let time = 11n;
    const now = vi.fn(() => time), w = wire("child", "attempt", now), third = encodeEpisodeMessage(ack(2));
    w.input.write(Buffer.concat([encodeEpisodeMessage(ack()), Buffer.from("\n"), encodeEpisodeMessage(ack(1)), Buffer.from("\n"), third.subarray(0, 17)]));
    time = 99n;
    const first = await w.channel.receive(); expect(w.channel.decode(first)).toEqual(ack());
    const second = await w.channel.receive(); expect(rawFrameReceipt(second)).toBe(11n);
    expect(w.channel.decode(second)).toEqual(ack(1)); await turn();
    w.input.write(Buffer.concat([third.subarray(17), Buffer.from("\n")]));
    const last = await w.channel.receive(); expect(rawFrameReceipt(last)).toBe(99n);
    expect(w.channel.decode(last)).toEqual(ack(2)); expect(now).toHaveBeenCalledTimes(2); w.channel.close();
  });
  it("rejects nonlinear receive and foreign, fake, and reused handles without consuming the legitimate handle", async () => {
    const a = wire(), b = wire(), waiting = a.channel.receive();
    await expect(a.channel.receive()).rejects.toThrow("CHANNEL");
    a.input.write(Buffer.from(encodeEpisodeMessage(ack()).toString() + "\n" + encodeEpisodeMessage(ack(1)).toString() + "\n"));
    b.input.write(encodeEpisodeMessage(ack()).toString() + "\n");
    const first = await waiting, foreign = await b.channel.receive();
    await expect(a.channel.receive()).rejects.toThrow("CHANNEL");
    expect(() => a.channel.decode({} as never)).toThrow("CHANNEL");
    expect(() => a.channel.decode(foreign)).toThrow("CHANNEL");
    expect(a.channel.decode(first)).toEqual(ack());
    const second = await a.channel.receive(); expect(() => a.channel.decode(first)).toThrow("CHANNEL");
    expect(a.channel.decode(second)).toEqual(ack(1)); expect(b.channel.decode(foreign)).toEqual(ack()); a.channel.close(); b.channel.close();
  });
  it("reserves every coalesced delimiter against the combined cap before exposing the first frame", async () => {
    const w = wire(), outbound = journal();
    w.input.write(Buffer.from(encodeEpisodeMessage(ack()).toString() + "\n" + "\n".repeat(EPISODE_LIMITS.maxIpcMessages - 1)));
    await expect(w.channel.write(outbound)).rejects.toThrow("SIZE");
    const first = await w.channel.receive(); expect(w.channel.decode(first)).toEqual(ack());
    expect(() => w.channel.decode(first)).toThrow("CHANNEL");
    const empty = await w.channel.receive(); expect(() => w.channel.decode(empty)).toThrow("CANONICAL"); w.channel.close();
  });
  it("copies the bounded captured remainder instead of retaining upstream backing", async () => {
    const w = wire(), first = encodeEpisodeMessage(ack()), second = encodeEpisodeMessage(ack(1));
    const backing = Buffer.alloc(EPISODE_LIMITS.maxCompletionBytes * 3), length = first.length + second.length + 2;
    first.copy(backing); backing[first.length] = 10; second.copy(backing, first.length + 1); backing[length - 1] = 10;
    const allocations = vi.spyOn(Buffer, "allocUnsafeSlow");
    try {
      w.input.emit("data", backing.subarray(0, length)); backing.fill(120);
      const frame = await w.channel.receive(); expect(w.channel.decode(frame)).toEqual(ack());
      expect(w.channel.decode(await w.channel.receive())).toEqual(ack(1));
      expect(allocations.mock.calls.some(([size]) => size === second.length + 1)).toBe(true);
      expect(allocations.mock.results.every(result => result.type === "return" && result.value.buffer.byteLength === result.value.length)).toBe(true);
    } finally { vi.restoreAllMocks(); w.channel.close(); }
  });
  it("uses bounded fixed slabs for one-byte fragmentation", () => {
    const w = wire("parent"), prefixBytes = Array.from(completionPrefix, value => Buffer.from([value])), one = Buffer.from("x");
    const from = vi.spyOn(Buffer, "from"), concat = vi.spyOn(Buffer, "concat"), allocate = vi.spyOn(Buffer, "allocUnsafeSlow");
    try {
      for (const byte of prefixBytes) w.input.emit("data", byte);
      for (let i = completionPrefix.length; i < 65537; i++) w.input.emit("data", one);
      expect(from.mock.calls.length).toBe(0); expect(concat.mock.calls.length).toBe(0);
      expect(allocate.mock.calls).toEqual([[65536], [65536]]);
    } finally { vi.restoreAllMocks(); w.channel.close(); }
  });
  it("performs no additional Buffer copy after an authentic decode rejection", async () => {
    const w = wire(), bytes = Buffer.from('{"bogus":0}\n' + encodeEpisodeMessage(ack(1)).toString() + "\n"), outgoing = journal();
    w.input.write(bytes); const frame = await w.channel.receive();
    expect(() => w.channel.decode(frame)).toThrow("CANONICAL");
    const from = vi.spyOn(Buffer, "from"), concat = vi.spyOn(Buffer, "concat"), allocate = vi.spyOn(Buffer, "allocUnsafeSlow"), copy = vi.spyOn(Buffer.prototype, "copy");
    try {
      w.input.emit("data", bytes);
      expect(() => w.channel.decode(frame)).toThrow();
      await expect(w.channel.write(outgoing)).rejects.toThrow("CANONICAL");
      await expect(w.channel.receive()).rejects.toThrow("CANONICAL");
      expect(from.mock.calls.length).toBe(0); expect(concat.mock.calls.length).toBe(0); expect(allocate.mock.calls.length).toBe(0); expect(copy.mock.calls.length).toBe(0);
      expect(() => requireDecodedEpisodeMessage(frame)).toThrow("CHANNEL");
    } finally { vi.restoreAllMocks(); w.channel.close(); }
  });
  it.each(["input", "output", "close"] as const)("clears delivered bytes on fatal %s and keeps the first failure", async action => {
    const w = wire(), bytes = Buffer.from(encodeEpisodeMessage(ack()).toString() + "\n"), outgoing = journal(), fatal = new Error("first transport failure");
    w.input.write(bytes); const frame = await w.channel.receive();
    if (action === "close") w.channel.close(); else w[action].emit("error", fatal);
    const from = vi.spyOn(Buffer, "from"), concat = vi.spyOn(Buffer, "concat"), allocate = vi.spyOn(Buffer, "allocUnsafeSlow"), copy = vi.spyOn(Buffer.prototype, "copy");
    try {
      if (action !== "close") w.input.emit("error", new Error("later failure"));
      w.input.emit("data", bytes); expect(() => w.channel.decode(frame)).toThrow();
      if (action === "close") await expect(w.channel.receive()).rejects.toThrow("CLOSED");
      else await expect(w.channel.receive()).rejects.toBe(fatal);
      await expect(w.channel.write(outgoing)).rejects.toThrow(action === "close" ? "CLOSED" : "first transport failure");
      expect(from.mock.calls.length).toBe(0); expect(concat.mock.calls.length).toBe(0); expect(allocate.mock.calls.length).toBe(0); expect(copy.mock.calls.length).toBe(0);
    } finally { vi.restoreAllMocks(); w.channel.close(); }
  });
  it.each(["input", "output", "close"] as const)("rejects the outstanding receive waiter on %s", async action => {
    const w = wire(), waiting = w.channel.receive(), fatal = new Error("first transport failure");
    if (action === "close") w.channel.close(); else w[action].emit("error", fatal);
    if (action === "close") await expect(waiting).rejects.toThrow("CLOSED");
    else { await expect(waiting).rejects.toBe(fatal); w.channel.close(); await expect(w.channel.receive()).rejects.toBe(fatal); }
  });
});
