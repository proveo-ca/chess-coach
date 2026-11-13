// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml, _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { types } from "node:util";
import type { Readable, Writable } from "node:stream";
import { stageR3Begin, type R3Session } from "@chess-coach/starchess-arena";
import type { EpisodeMessage, EpisodeMessageKind, PlanPermit } from "./episodeContracts";
import { requireNativeEvidenceProduction, requireNativeMessageProduction } from "./episodeVerification";
import { constructFloat64Hex, constructRef } from "../economic/ownedKernel";
import { constructActiveStreamState, constructEpisodeStartStreams, constructUnusedEnvironmentState } from "./episodeRng";
import { requireEpisodeAttemptId } from "./episodeRequest";

export const EPISODE_LIMITS = Object.freeze({ startupMs: 10000, planMs: 10000, matchMs: 300000,
  maxWindows: 64, maxRecordedPlies: 128, maxProposals: 4096, maxIpcMessages: 2048,
  maxProgressBytes: 1048576, maxCompletionBytes: 16777216 } as const);
export class EpisodeProtocolError extends Error {
  override readonly name = "EpisodeProtocolError";
  constructor(readonly code: "CANONICAL" | "SCHEMA" | "SIZE" | "ORDINAL" | "DIRECTION" | "CHANNEL" | "CLOSED") { super(code); }
}
const reject = (code: EpisodeProtocolError["code"]): never => { throw new EpisodeProtocolError(code); };
const freeze = Object.freeze;
const clock = process.hrtime.bigint.bind(process.hrtime);
const integer = Number.isSafeInteger;
const descriptor = Object.getOwnPropertyDescriptor;
const completionPrefix = Buffer.from('{"acceptedCandidateDecisionIds":');
declare const frameBrand: unique symbol;
export type RawEpisodeFrame = Readonly<{ [frameBrand]: "complete-real-channel-frame" }>;
type Frame = { bytes: Buffer | null; receivedAt: bigint; channel: object; consumed: boolean; decoded: EpisodeMessage | null };
const frames = new WeakMap<object, Frame>();
const written = new WeakSet<object>();
const frameFor = WeakMap.prototype.get.bind(frames);
const publishFrame = WeakMap.prototype.set.bind(frames);
const wasWritten = WeakSet.prototype.has.bind(written);
const recordWritten = WeakSet.prototype.add.bind(written);
export const requireDecodedEpisodeMessage = (frame: RawEpisodeFrame): EpisodeMessage => {
  const decoded = frameFor(frame)?.decoded;
  if (!decoded) return reject("CHANNEL");
  return decoded;
};
export const requireWrittenAcknowledgement = (message: EpisodeMessage): void => {
  if (!wasWritten(message) || message.kind !== "turn-open-accepted" && message.kind !== "decision-accepted") return reject("CHANNEL");
};
export const rawFrameReceipt = (frame: RawEpisodeFrame): bigint => {
  const record = frameFor(frame);
  if (!record) return reject("CHANNEL");
  return record.receivedAt;
};

type Schema = { kind: "int"; max: number; min: number } | { kind: "text"; max: number } |
  { kind: "enum"; values: readonly string[] } | { kind: "hex"; size: number } |
  { kind: "array"; child: Schema; max: number; min: number } |
  { kind: "object"; fields: readonly Field[] } | { kind: "nullable"; child: Schema };
type Field = Readonly<{ key: string; schema: Schema; optional: boolean }>;
const int = (max: number, min = 0): Schema => ({ kind: "int", max, min });
const text = (max: number): Schema => ({ kind: "text", max });
const choices = (...values: string[]): Schema => ({ kind: "enum", values });
const hex = (size: number): Schema => ({ kind: "hex", size });
const array = (child: Schema, max: number, min = 0): Schema => ({ kind: "array", child, max, min });
const nullable = (child: Schema): Schema => ({ kind: "nullable", child });
const record = (fields: Record<string, Schema>, optional: readonly string[] = []): Schema => ({ kind: "object",
  fields: Object.keys(fields).sort().map(key => ({ key, schema: fields[key]!, optional: optional.includes(key) })) });
const side = choices("w", "b"), h = record({ hex: hex(16) });
const ref = record({ byteLength: int(Number.MAX_SAFE_INTEGER), sha256: hex(64) });
const stream = record({ drawCount: int(Number.MAX_SAFE_INTEGER), root: int(4294967295), state: int(4294967295), status: choices("active", "unused") });
const streams = record({ selection: stream, "environment-settlement": stream, "policy-sampling": stream, opponent: stream });
const decisionId = record({ planningOrdinal: int(63), side });
const permit = record({ permitId: text(96), planningOrdinal: int(63), turn: int(45), side, role: choices("candidate", "strategic") });
const action = record({ color: side, from: text(2), kind: choices("classical", "deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump"),
  promotion: choices("p", "n", "b", "r", "q"), timing: choices("B", "C", "F"), to: text(2), unit: choices("p", "n", "b", "r", "q") }, ["promotion", "to", "unit"]);
const sample = record({ decisionId, permitId: text(96), historyDigest: ref, manifestDigest: ref,
  generatorVersion: choices("challenge-composition-v3"), orderedCandidateKeysDigest: ref,
  selectedIndex: int(511), selectedKey: text(8192), actions: array(action, 4), requestedSpend: record({ minerals: int(12), gas: int(3) }),
  uniform: h, selectedLogProbability: h, samplingBefore: stream, samplingAfter: stream });
const opponent = record({ decisionId, permitId: text(96), actions: array(action, 65), reportedMinSpend: int(12), opponentBefore: stream, opponentAfter: stream });
const reasons = ["core-terminal", "candidate-native-rejection", "recorded-white-rejection", "trace-exhaustion", "progress-cap", "candidate-deadline",
  "exception", "policy-schema", "nonmember", "version", "codec", "adapter-mutation", "distribution", "nonfinite", "rng", "journal", "gradient", "protocol", "permit",
  "session", "opponent", "startup-timeout", "match-timeout", "unattributed-timeout", "dataset", "source", "identity", "ledger", "provenance", "forged-progress",
  "config-override", "publication", "storage", "size"] as const;
const stop = record({ kind: choices("terminal", "queue-rejected", "trace-exhausted", "watchdog", "progress-limit", "exception", "script-contract"),
  phase: text(64), planningOrdinal: int(64), turn: int(45), side, actionIndex: int(64), action, sourcePlyIndex: int(127), reason: text(8192),
  engineCode: text(128), requiredMinerals: int(585), availableMinerals: int(12), rejectedQueue: array(action, 65) },
  ["side", "actionIndex", "action", "sourcePlyIndex", "reason", "engineCode", "requiredMinerals", "availableMinerals", "rejectedQueue"]);
const proof = record({ stop, origin: choices("native", "recorded-white", "candidate-deadline", "infrastructure"), reason: choices(...reasons),
  checkedBoundaryOrdinal: int(256), acceptedCandidateCount: int(64), evidenceRef: ref });
const header = { version: choices("starchess-training-episode-v2"), attemptId: text(64), messageOrdinal: int(2047) };
const schemas = {
  "turn-open-accepted": record({ ...header, kind: choices("turn-open-accepted"), planningOrdinal: int(63), nextPermit: nullable(permit) }),
  "decision-accepted": record({ ...header, kind: choices("decision-accepted"), decisionId, nextPermit: nullable(permit) }),
  "candidate": record({ ...header, kind: choices("decision-result"), role: choices("candidate"), journalEntry: sample }),
  "strategic": record({ ...header, kind: choices("decision-result"), role: choices("strategic"), journalEntry: opponent }),
  "complete": record({ ...header, kind: choices("complete"), acceptedCandidateDecisionIds: array(decisionId, 64), acceptedOpponentDecisionIds: array(decisionId, 64),
    scoreAccumulator: array(h, 418, 418), rngSummaries: streams, stopProof: proof }),
} as const;

const quote = (value: string): string => {
  let result = '"';
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c === 34 || c === 92) result += `\\${value[i]}`;
    else if (c === 8) result += "\\b";
    else if (c === 9) result += "\\t";
    else if (c === 10) result += "\\n";
    else if (c === 12) result += "\\f";
    else if (c === 13) result += "\\r";
    else if (c >= 0xd800 && c <= 0xdbff && value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff) result += value[i]! + value[++i]!;
    else if (c < 32 || c >= 0xd800 && c <= 0xdfff) result += `\\u${c.toString(16).padStart(4, "0")}`;
    else result += value[i];
  }
  return result + '"';
};
const data = (value: object, key: string): unknown => {
  const field = descriptor(value, key);
  if (!field || !("value" in field) || !field.enumerable) return reject("SCHEMA");
  return field.value;
};
const checkObject = (value: unknown): object => {
  if (!value || typeof value !== "object" || types.isProxy(value)) return reject("SCHEMA");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && prototype !== Array.prototype) return reject("SCHEMA");
  return value;
};
const write = (value: unknown, schema: Schema): string => {
  if (schema.kind === "nullable") return value === null ? "null" : write(value, schema.child);
  if (schema.kind === "int") {
    if (typeof value !== "number" || !integer(value) || Object.is(value, -0) || value < schema.min || value > schema.max) return reject("SCHEMA");
    return String(value);
  }
  if (schema.kind === "text" || schema.kind === "hex" || schema.kind === "enum") {
    if (typeof value !== "string" || schema.kind === "text" && value.length > schema.max ||
      schema.kind === "enum" && !schema.values.includes(value) || schema.kind === "hex" && (value.length !== schema.size || !/^[0-9a-f]+$/.test(value))) return reject("SCHEMA");
    return quote(value);
  }
  const source = checkObject(value);
  if (schema.kind === "array") {
    if (!Array.isArray(source)) return reject("SCHEMA");
    const length = descriptor(source, "length")!.value as number;
    if (length < schema.min || length > schema.max || Reflect.ownKeys(source).length !== length + 1) return reject("SIZE");
    const parts: string[] = [];
    for (let i = 0; i < length; i++) parts.push(write(data(source, String(i)), schema.child));
    return `[${parts.join(",")}]`;
  }
  if (Array.isArray(source)) return reject("SCHEMA");
  const parts: string[] = [];
  for (const field of schema.fields) {
    if (field.optional && !descriptor(source, field.key)) continue;
    parts.push(`${quote(field.key)}:${write(data(source, field.key), field.schema)}`);
  }
  if (Reflect.ownKeys(source).length !== parts.length) return reject("SCHEMA");
  return `{${parts.join(",")}}`;
};

const writeNativeProduction = (value: unknown, depth = 0): string => {
  if (depth > 32) return reject("SIZE");
  if (value === null) return "null";
  if (typeof value === "string") return quote(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && integer(value) && !Object.is(value, -0)) return String(value);
  const source = checkObject(value);
  if (Array.isArray(source)) {
    if (source.length > 2304) return reject("SIZE");
    const parts: string[] = [];
    for (let i = 0; i < source.length; i++) parts.push(writeNativeProduction(data(source, String(i)), depth + 1));
    return `[${parts.join(",")}]`;
  }
  const keys = Object.keys(source).sort();
  if (keys.length > 32) return reject("SIZE");
  const parts: string[] = [];
  for (const key of keys) {
    const child = data(source, key);
    if (child !== undefined) parts.push(`${quote(key)}:${writeNativeProduction(child, depth + 1)}`);
  }
  return `{${parts.join(",")}}`;
};
export const encodeInitialNativeProvenance = (binding: object, session: R3Session): Buffer => {
  stageR3Begin(binding, session);
  return Buffer.from(writeNativeProduction({ provenance: session.provenance, frames: [], visibilityImages: [], visibilityCheckpoints: [] }));
};
export const encodeNativeEpisodeEvidence = (message: EpisodeMessage): Buffer => {
  const bytes = Buffer.from(writeNativeProduction(requireNativeEvidenceProduction(message)));
  if (bytes.length > EPISODE_LIMITS.maxCompletionBytes) return reject("SIZE");
  return bytes;
};
export const encodeEpisodeMessage = (message: EpisodeMessage): Buffer => {
  checkObject(message);
  requireEpisodeAttemptId(data(message, "attemptId"));
  const kind = data(message, "kind");
  let encoded: string;
  if (kind === "ready" || kind === "turn-open-result" || kind === "settlement") {
    encoded = writeNativeProduction(requireNativeMessageProduction(message));
  } else {
    const schema = kind === "decision-result" ? schemas[data(message, "role") === "candidate" ? "candidate" : "strategic"] :
      kind === "turn-open-accepted" || kind === "decision-accepted" || kind === "complete" ? schemas[kind] : reject("SCHEMA");
    encoded = write(message, schema);
  }
  const result = Buffer.from(encoded, "utf8");
  if (result.length > (kind === "complete" ? EPISODE_LIMITS.maxCompletionBytes : EPISODE_LIMITS.maxProgressBytes)) return reject("SIZE");
  return result;
};

class Cursor {
  offset = 0;
  constructor(readonly bytes: Buffer) {}
  literal(value: string): void {
    const expected = Buffer.from(value, "utf8");
    for (let i = 0; i < expected.length; i++) if (this.bytes[this.offset++] !== expected[i]) return reject("CANONICAL");
  }
  string(max: number): string {
    this.literal('"');
    let result = "", escaped = false;
    const start = this.offset - 1;
    while (this.offset < this.bytes.length) {
      const c = this.bytes[this.offset++]!;
      if (!escaped && c === 34) {
        if (result.length > max || !Buffer.from(quote(result), "utf8").equals(this.bytes.subarray(start, this.offset))) return reject("CANONICAL");
        return result;
      }
      if (!escaped && c === 92) { escaped = true; continue; }
      if (escaped) {
        if (c === 117) {
          const digits = this.bytes.subarray(this.offset, this.offset + 4).toString("ascii");
          if (!/^[0-9a-f]{4}$/.test(digits)) return reject("CANONICAL");
          result += String.fromCharCode(Number.parseInt(digits, 16)); this.offset += 4;
        } else {
          const mapping: Record<number, string> = { 34: '"', 92: "\\", 98: "\b", 116: "\t", 110: "\n", 102: "\f", 114: "\r" };
          if (mapping[c] === undefined) return reject("CANONICAL");
          result += mapping[c];
        }
        escaped = false;
      } else {
        if (c < 32) return reject("CANONICAL");
        if (c < 128) result += String.fromCharCode(c);
        else {
          const length = c >= 0xc2 && c <= 0xdf ? 2 : c >= 0xe0 && c <= 0xef ? 3 : c >= 0xf0 && c <= 0xf4 ? 4 : reject("CANONICAL");
          try { result += new TextDecoder("utf-8", { fatal: true }).decode(this.bytes.subarray(this.offset - 1, this.offset + length - 1)); }
          catch { return reject("CANONICAL"); }
          this.offset += length - 1;
        }
      }
      if (result.length > max) return reject("SIZE");
    }
    return reject("CANONICAL");
  }
  read(schema: Schema): unknown {
    if (schema.kind === "nullable") {
      if (this.bytes[this.offset] === 110) { this.literal("null"); return null; }
      return this.read(schema.child);
    }
    if (schema.kind === "int") {
      const start = this.offset;
      if (this.bytes[this.offset] === 45) this.offset++;
      while (this.bytes[this.offset]! >= 48 && this.bytes[this.offset]! <= 57 && this.offset - start <= 16) this.offset++;
      const token = this.bytes.subarray(start, this.offset).toString("ascii"), value = Number(token);
      if (!/^(0|[1-9][0-9]*|-[1-9][0-9]*)$/.test(token) || !integer(value) || value < schema.min || value > schema.max) return reject("SCHEMA");
      return value;
    }
    if (schema.kind === "text" || schema.kind === "enum" || schema.kind === "hex") {
      const value = this.string(schema.kind === "text" ? schema.max : schema.kind === "hex" ? schema.size : 128);
      write(value, schema); return value;
    }
    if (schema.kind === "array") {
      this.literal("["); const values: unknown[] = [];
      while (this.bytes[this.offset] !== 93) {
        if (values.length >= schema.max) return reject("SIZE");
        if (values.length) this.literal(",");
        values.push(this.read(schema.child));
      }
      this.literal("]");
      if (values.length < schema.min) return reject("SCHEMA");
      return freeze(values);
    }
    this.literal("{"); const result: Record<string, unknown> = {}; let count = 0;
    for (const field of schema.fields) {
      const prefix = `${count ? "," : ""}${quote(field.key)}:`;
      if (field.optional && !this.bytes.subarray(this.offset, this.offset + prefix.length).equals(Buffer.from(prefix))) continue;
      this.literal(prefix); result[field.key] = this.read(field.schema); count++;
    }
    this.literal("}");
    if (schema === h) return constructFloat64Hex(result.hex as string);
    if (schema === ref) return constructRef(result.byteLength as number, result.sha256 as string);
    if (schema === stream) {
      if (result.status === "unused") {
        if (result.drawCount !== 0 || result.state !== result.root) return reject("SCHEMA");
        return constructUnusedEnvironmentState(result.root as number);
      }
      return constructActiveStreamState(result.root as number, result.state as number, result.drawCount as number);
    }
    if (schema === streams) return constructEpisodeStartStreams(result.selection as never, result["environment-settlement"] as never,
      result["policy-sampling"] as never, result.opponent as never);
    if (schema === action) {
      if (!/^[a-h][1-8]$/.test(result.from as string) || result.to !== undefined && !/^[a-h][1-8]$/.test(result.to as string) ||
        result.kind === "classical" && (result.timing !== "C" || result.to === undefined || result.unit !== undefined) ||
        result.kind !== "classical" && result.timing === "C" || result.kind === "deploy" && (result.unit === undefined || result.to === undefined)) return reject("SCHEMA");
    }
    return freeze(result);
  }
  finish(): void { if (this.offset !== this.bytes.length) return reject("CANONICAL"); }
}

export type EpisodeChannel = Readonly<{
  receive(): Promise<RawEpisodeFrame>;
  decode(frame: RawEpisodeFrame, expectedNative?: EpisodeMessage): EpisodeMessage;
  write(message: EpisodeMessage): Promise<void>;
  close(): void;
}>;
export const createEpisodeChannel = (input: Readable, output: Writable, attemptId: string,
  direction: "parent" | "child", now: () => bigint = clock): EpisodeChannel => {
  requireEpisodeAttemptId(attemptId);
  const identity = freeze({});
  const completionCap = EPISODE_LIMITS.maxCompletionBytes, messageCap = EPISODE_LIMITS.maxIpcMessages;
  const remainderCap = completionCap + messageCap, retainedCap = completionCap + remainderCap;
  const assemblyCap = completionCap + retainedCap, slabBytes = 65536, maxSlabs = completionCap / slabBytes;
  let incomingOrdinal = 0, outgoingOrdinal = 0, combined = 0, closed = false, ended = false, failed = false, failure: unknown;
  let slabs: Buffer[] = [], length = 0, decodingCapacity = 0;
  let active: RawEpisodeFrame | null = null, delivered = false;
  let waiting: { resolve: (frame: RawEpisodeFrame) => void; reject: (error: unknown) => void } | null = null;
  let remainder: { bytes: Buffer; offset: number; sourceStart: number; delimiters: number[]; next: number; receivedAt: bigint } | null = null;
  const ownedCapacity = (): number => slabs.length * slabBytes + (active ? frameFor(active)!.bytes?.buffer.byteLength ?? 0 : 0) +
    (remainder?.bytes.buffer.byteLength ?? 0);
  const allocate = (size: number): Buffer => {
    if (failed || closed) throw failure;
    if (ownedCapacity() + decodingCapacity + size > assemblyCap) return reject("SIZE");
    return Buffer.allocUnsafeSlow(size);
  };
  const failChannel = (error: unknown): void => {
    if (!failed) { failed = true; failure = error; }
    const waiter = waiting; waiting = null;
    if (active) { const raw = frameFor(active)!; raw.bytes = null; raw.consumed = true; }
    active = null; delivered = false; slabs = []; length = 0; remainder = null;
    input.pause(); waiter?.reject(failure);
  };
  const finishEnd = (): void => {
    if (ended && !active && !remainder && !failed) failChannel(new EpisodeProtocolError(length ? "CANONICAL" : "CLOSED"));
  };
  const checkFrameSize = (chunk: Buffer, start: number, end: number, partial: number): void => {
    const total = partial + end - start;
    let complete = total >= completionPrefix.length;
    for (let i = 0; complete && i < completionPrefix.length; i++) {
      const byte = i < partial ? slabs[0]![i] : chunk[start + i - partial];
      if (byte !== completionPrefix[i]) complete = false;
    }
    if (total > (complete ? completionCap : EPISODE_LIMITS.maxProgressBytes)) return reject("SIZE");
  };
  const append = (chunk: Buffer, start: number, end: number): void => {
    checkFrameSize(chunk, start, end, length);
    while (start < end) {
      const index = Math.floor(length / slabBytes), offset = length % slabBytes;
      if (index === slabs.length) {
        if (slabs.length >= maxSlabs) return reject("SIZE");
        slabs.push(allocate(slabBytes));
      }
      const count = Math.min(end - start, slabBytes - offset);
      chunk.copy(slabs[index]!, offset, start, start + count); length += count; start += count;
    }
  };
  const expose = (bytes: Buffer, receivedAt: bigint): void => {
    const token = freeze({}) as RawEpisodeFrame;
    publishFrame(token, { bytes, receivedAt, channel: identity, consumed: false, decoded: null }); active = token;
    if (ownedCapacity() > retainedCap) return reject("SIZE");
    if (waiting) { const waiter = waiting; waiting = null; delivered = true; waiter.resolve(token); }
  };
  const pump = (): void => {
    if (failed || closed || active) return;
    try {
      if (remainder) {
        const captured = remainder;
        if (captured.next < captured.delimiters.length) {
          const end = captured.delimiters[captured.next++]! - captured.sourceStart;
          checkFrameSize(captured.bytes, captured.offset, end, 0);
          const bytes = allocate(end - captured.offset);
          captured.bytes.copy(bytes, 0, captured.offset, end); captured.offset = end + 1;
          if (captured.offset === captured.bytes.length) remainder = null;
          expose(bytes, captured.receivedAt); return;
        }
        append(captured.bytes, captured.offset, captured.bytes.length); remainder = null;
      }
      if (ownedCapacity() > retainedCap) return reject("SIZE");
      finishEnd();
      if (!failed && !ended) input.resume();
    } catch (error) { failChannel(error); }
  };
  const onData = (chunk: Buffer): void => {
    if (closed || failed) return;
    try {
      if (!Buffer.isBuffer(chunk) || active || remainder || ended) return reject("CHANNEL");
      const receivedAt = now();
      if (length + chunk.length > retainedCap) return reject("SIZE");
      const delimiters: number[] = [];
      let start = 0, partial = length;
      while (true) {
        const end = chunk.indexOf(10, start);
        checkFrameSize(chunk, start, end === -1 ? chunk.length : end, partial);
        if (end === -1) break;
        if (combined + delimiters.length >= messageCap) return reject("SIZE");
        delimiters.push(end); start = end + 1; partial = 0;
      }
      const first = delimiters[0];
      if (first === undefined) { append(chunk, 0, chunk.length); return; }
      const sourceStart = first + 1, remaining = chunk.length - sourceStart;
      if (remaining > remainderCap) return reject("SIZE");
      combined += delimiters.length; input.pause();
      if (remaining) {
        const bytes = allocate(remaining); chunk.copy(bytes, 0, sourceStart);
        remainder = { bytes, offset: 0, sourceStart, delimiters, next: 1, receivedAt };
      }
      append(chunk, 0, first);
      const bytes = allocate(length);
      for (let i = 0; i < slabs.length; i++) slabs[i]!.copy(bytes, i * slabBytes, 0, Math.min(slabBytes, length - i * slabBytes));
      slabs = []; length = 0; expose(bytes, receivedAt);
    } catch (error) { failChannel(error); }
  };
  const onEnd = (): void => { if (!closed && !failed) { ended = true; finishEnd(); } };
  input.on("data", onData); input.on("end", onEnd); input.on("error", failChannel); output.on("error", failChannel);
  const decode = (frame: RawEpisodeFrame, expectedNative?: EpisodeMessage): EpisodeMessage => {
    const raw = frameFor(frame);
    if (!raw || raw.channel !== identity || raw.consumed || closed || active !== frame || !delivered) return reject("CHANNEL");
    if (failed) throw failure;
    raw.consumed = true;
    const bytes = raw.bytes!;
    decodingCapacity = bytes.buffer.byteLength;
    try {
      let message: EpisodeMessage;
      if (expectedNative) {
        requireNativeMessageProduction(expectedNative);
        if (!bytes.equals(encodeEpisodeMessage(expectedNative))) return reject("CANONICAL");
        message = expectedNative;
      } else {
        let schema: Schema;
        if (bytes.subarray(0, completionPrefix.length).equals(completionPrefix)) schema = schemas.complete;
        else {
          const selector = new Cursor(bytes);
          selector.literal('{"attemptId":'); selector.string(64); selector.literal(",");
          const next = selector.string(32);
          schema = next === "journalEntry" ? bytes.includes(Buffer.from(',"role":"candidate"')) ? schemas.candidate : schemas.strategic :
            next === "decisionId" ? schemas["decision-accepted"] : next === "kind" ? schemas["turn-open-accepted"] : reject("SCHEMA");
        }
        const cursor = new Cursor(bytes);
        message = cursor.read(schema) as EpisodeMessage; cursor.finish();
      }
      if (message.attemptId !== attemptId || message.messageOrdinal !== incomingOrdinal++) return reject("ORDINAL");
      const parentKind = message.kind === "turn-open-accepted" || message.kind === "decision-accepted";
      if (parentKind !== (direction === "child")) return reject("DIRECTION");
      raw.decoded = message; raw.bytes = null; active = null; delivered = false;
      pump();
      return message;
    } catch (error) { failChannel(error); throw failure; }
    finally { decodingCapacity = 0; }
  };
  return freeze({
    receive(): Promise<RawEpisodeFrame> {
      if (failed || closed) return Promise.reject(failure);
      if (waiting || delivered) return Promise.reject(new EpisodeProtocolError("CHANNEL"));
      if (active) { delivered = true; return Promise.resolve(active); }
      return new Promise((resolve, reject) => { waiting = { resolve, reject }; });
    }, decode,
    async write(message: EpisodeMessage): Promise<void> {
      if (closed || failed) throw failure;
      if (message.attemptId !== attemptId || message.messageOrdinal !== outgoingOrdinal++) return reject("ORDINAL");
      const parentKind = message.kind === "turn-open-accepted" || message.kind === "decision-accepted";
      if (parentKind !== (direction === "parent")) return reject("DIRECTION");
      if (combined >= messageCap) return reject("SIZE");
      combined++;
      const bytes = encodeEpisodeMessage(message);
      try {
        await new Promise<void>((resolve, reject) => output.write(Buffer.concat([bytes, Buffer.from("\n")]), error => error ? reject(error) : resolve()));
      } catch (error) { failChannel(error); throw failure; }
      if (closed || failed) throw failure;
      if (parentKind) recordWritten(message);
    },
    close(): void {
      if (closed) return;
      closed = true; input.off("data", onData); input.off("end", onEnd); input.off("error", failChannel); output.off("error", failChannel);
      failChannel(new EpisodeProtocolError("CLOSED"));
    },
  });
};

export const samePlanPermit = (left: PlanPermit, right: PlanPermit): boolean => left.permitId === right.permitId &&
  left.planningOrdinal === right.planningOrdinal && left.turn === right.turn && left.side === right.side && left.role === right.role;
