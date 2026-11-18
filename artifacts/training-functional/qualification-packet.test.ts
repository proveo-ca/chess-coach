// SPEC: _spec/runtime-protocol.puml
import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import * as childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { FixedAttemptFactory, FIXED_ATTEMPT_LAYOUT, observeNativeTransport } from "../../packages/runtime/src/fixed-attempt";
import type { FixedAttemptLayout, NativeObservation, NativeObserver } from "../../packages/runtime/src/fixed-attempt";
import type { ExitReceipt, OwnedTransport } from "../../packages/runtime/src/native-session";
import { NativeLearner } from "../../packages/runtime/src/native-learner";
import { LearnerPair } from "../../packages/runtime/src/learner-pair";
import type { LearningReply, LearningRequest } from "../../packages/contracts/src/learning-channel";
import type { AckedDecision } from "../../packages/runtime/src/policy-session";
import { deriveStream, drawStream } from "../../packages/runtime/src/rng";
import { matchFixture } from "../../packages/runtime/tests/match-fixture";
import { syntheticRecord } from "../../packages/runtime/tests/training-fixture";

const cleanExit = (): ExitReceipt => ({ stdinClosed: true, stdoutEof: true, stderrEof: true, reaped: true, exitCode: 0, forced: false });
const modelId = "a".repeat(64), attemptId = "mock-native-tap";
class MockNativePort implements OwnedTransport {
  readonly requests: string[] = [];
  readonly replies: { json: string; receivedNs: bigint }[] = [];
  readonly receipt = cleanExit();
  readonly termination = Promise.resolve();
  readonly reasons: unknown[] = [];
  samples = 0;
  finishes = 0;
  reply(json: string): string {
    const request: LearningRequest = JSON.parse(json);
    this.requests.push(json);
    let result: LearningReply["result"];
    switch (request.command.kind) {
      case "begin": result = { kind: "begun" }; break;
      case "score": result = { kind: "scored", response: { version: "chess-coach.inference.v1", featureVersion: "chess-coach.features.v1",
        requestId: request.command.request.requestId, modelId: request.modelId, logits: Array(request.command.request.rows).fill(0.25) } }; break;
      case "acknowledge": result = { kind: "acknowledged", journalDigest: request.command.journalDigest, sampledDecisions: ++this.samples }; break;
      case "finish": {
        const record = syntheticRecord("MOCK_NOT_NATIVE_MODEL");
        result = this.samples ? { kind: "proposed", config: record.config, record: Array.from(record.record), sampledDecisions: this.samples,
          objective: 0.25, nonzeroPolicyGradient: true, parameterSha256: "b".repeat(64) } : { kind: "diagnostic" }; break;
      }
      case "close": result = { kind: "closed" }; break;
    }
    const reply = { json: JSON.stringify({ version: request.version, sessionId: request.sessionId, ordinal: request.ordinal, modelId: request.modelId, result }), receivedNs: 17n };
    this.replies.push(reply); return reply.json;
  }
  async exchange(json: string) { this.reply(json); return this.replies.at(-1)!; }
  async finish() { this.finishes++; return this.receipt; }
  terminate(reason: unknown) { this.reasons.push(reason); return this.termination; }
}

function ack(): AckedDecision {
  const before = deriveStream(101, "policy-sampling"), draw = drawStream(before);
  const journal: AckedDecision["journal"] = { version: "chess-coach.decision.v1", attemptId, permitId: `${attemptId}:plan:0:w`, planningOrdinal: 0,
    side: "w", modelId, historyDigest: "c".repeat(64), featureVersion: "chess-coach.features.v1", enumerationVersion: "chess-coach.enumeration.v1",
    orderedCandidateDigest: "d".repeat(64), mode: "sample", selectedIndex: 0, selectedKey: "[]", actions: [], requestedSpend: { minerals: 0, gas: 0 },
    uniform: draw.uniform, selectedLogProbability: -Math.log(2), samplingBefore: before, samplingAfter: draw.after };
  return { journal, digest: createHash("sha256").update(JSON.stringify(journal)).digest("hex"),
    features: { featureVersion: "chess-coach.features.v1", rows: 2, values: new Float64Array(2 * 2271) } };
}

test("no observer returns the exact owned transport and preserves raw replies, finish receipt and termination promise", async () => {
  const raw = new MockNativePort(), port = observeNativeTransport(raw, attemptId, "a");
  expect(port).toBe(raw);
  const request = JSON.stringify({ version: "chess-coach.learning-channel.v1", sessionId: "mock:a", modelId, ordinal: 0, command: { kind: "begin", baseline: 0 } });
  expect(await port.exchange(request)).toBe(raw.replies[0]!);
  expect(await port.finish()).toBe(raw.receipt);
  const reason = new Error("MOCK_STOP"); expect(port.terminate(reason)).toBe(raw.termination); expect(raw.reasons).toEqual([reason]);
});

test("tap copies and freezes observations without rewriting bytes, timestamps, return objects or underlying receipts", async () => {
  const order: string[] = [], events: NativeObservation[] = [], receipt = cleanExit(), reply = { json: ' {"result":"copied exactly"} ', receivedNs: 987654321n };
  const reason = new Error("MOCK_STOP"), termination = Promise.resolve();
  const raw: OwnedTransport = {
    async exchange(json) { order.push("raw:exchange"); expect(json).toBe(' {"request":"exact"} '); return reply; },
    async finish() { order.push("raw:finish"); return receipt; },
    terminate(value) { order.push("raw:terminate"); expect(value).toBe(reason); return termination; },
  };
  const port = observeNativeTransport(raw, attemptId, "b", event => {
    order.push(`observe:${event.kind}`); events.push(event);
    expect(Object.isFrozen(event)).toBe(true);
    expect(Reflect.set(event, "json", "REWRITE_FORBIDDEN")).toBe(false);
    if (event.kind === "finish") {
      expect(event.receipt).not.toBe(receipt); expect(Object.isFrozen(event.receipt)).toBe(true);
      expect(Reflect.set(event.receipt, "exitCode", 99)).toBe(false);
    }
  });
  expect(await port.exchange(' {"request":"exact"} ')).toBe(reply);
  expect(await port.finish()).toBe(receipt); expect(port.terminate(reason)).toBe(termination);
  expect(order).toEqual(["observe:request", "raw:exchange", "observe:reply", "raw:finish", "observe:finish", "raw:terminate"]);
  expect(events).toEqual([{ kind: "request", attemptId, channel: "b", json: ' {"request":"exact"} ' },
    { kind: "reply", attemptId, channel: "b", ...reply }, { kind: "finish", attemptId, channel: "b", receipt: cleanExit() }]);
  receipt.exitCode = 9; expect(events[2]!.kind === "finish" && events[2]!.receipt.exitCode).toBe(0);
  expect(Object.isFrozen(receipt)).toBe(false); expect(reply.json).toBe(' {"result":"copied exactly"} ');
});

test("MOCK learner pair retains both bound proposals and natural exit receipts through the observed ports", async () => {
  const events: NativeObservation[] = [], raw = [new MockNativePort(), new MockNativePort()];
  const learners = raw.map((port, index) => {
    const channel = index === 0 ? "a" : "b";
    return new NativeLearner(`${attemptId}:learner:${channel}`, modelId, observeNativeTransport(port, attemptId, channel, event => { events.push(event); }),
      () => 17n, 1_000_000_000n, 2_000_000_000n);
  });
  const pair = new LearnerPair(learners[0]!, learners[1]!);
  await pair.begin(0); await pair.accumulate(ack()); expect((await pair.propose(1)).kind).toBe("proposed"); await pair.close();
  for (const [index, channel] of (["a", "b"] as const).entries()) {
    const selected = events.filter(event => event.channel === channel), port = raw[index]!;
    expect(selected.map(event => event.kind)).toEqual(["request", "reply", "request", "reply", "request", "reply", "request", "reply", "finish"]);
    for (let ordinal = 0; ordinal < port.requests.length; ordinal++) {
      expect(selected[2 * ordinal]).toEqual({ kind: "request", attemptId, channel, json: port.requests[ordinal] });
      expect(selected[2 * ordinal + 1]).toEqual({ kind: "reply", attemptId, channel, ...port.replies[ordinal]! });
      expect(JSON.parse(port.requests[ordinal]!)).toMatchObject({ modelId, sessionId: `${attemptId}:learner:${channel}`, ordinal });
    }
    expect(selected.at(-1)).toEqual({ kind: "finish", attemptId, channel, receipt: cleanExit() });
    expect(JSON.parse(port.replies[2]!.json).result.kind).toBe("proposed");
    expect(port.finishes).toBe(1); expect(port.reasons).toEqual([]);
  }
});

for (const phase of ["request", "reply", "finish"] as const) test(`observer ${phase} failure propagates unchanged through existing learner cleanup`, async () => {
  const raw = new MockNativePort(), failure = new Error(`MOCK_OBSERVER_${phase}`);
  const port = observeNativeTransport(raw, attemptId, "a", event => { if (event.kind === phase) throw failure; });
  const learner = new NativeLearner("mock:a", modelId, port, () => 17n, 1_000_000_000n, 2_000_000_000n);
  if (phase === "finish") { await learner.begin(0); await learner.propose(0); await expect(learner.close()).rejects.toBe(failure); }
  else await expect(learner.begin(0)).rejects.toBe(failure);
  expect(raw.reasons).toEqual([failure]);
  expect(raw.requests.length).toBe(phase === "request" ? 0 : phase === "reply" ? 1 : 3);
  expect(raw.finishes).toBe(phase === "finish" ? 1 : 0);
});

test("invalid observer results fail rather than accepting asynchronous observation or replacing transport output", async () => {
  for (const observer of [() => 3, () => ({ json: "REWRITE" }), async () => {}, async () => { throw new Error("MOCK_ASYNC_REJECTED"); }]) {
    const raw = new MockNativePort(), port = observeNativeTransport(raw, attemptId, "a", observer);
    await expect(port.exchange("untouched")).rejects.toThrow("OBSERVER_RETURN"); expect(raw.requests).toEqual([]);
  }
});

test("raw exchange and finish failures propagate without fabricating observations", async () => {
  const events: NativeObservation[] = [], failure = new Error("MOCK_RAW_FAILURE");
  const raw: OwnedTransport = { async exchange() { throw failure; }, async finish() { throw failure; }, async terminate() {} };
  const port = observeNativeTransport(raw, attemptId, "a", event => { events.push(event); });
  await expect(port.exchange("exact")).rejects.toBe(failure); await expect(port.finish()).rejects.toBe(failure);
  expect(events).toEqual([{ kind: "request", attemptId, channel: "a", json: "exact" }]);
});

test("nonfunction observer rejects before layout access, filesystem or process acquisition", () => {
  const fixture = matchFixture({ windows: 0 }), layout = new Proxy({} as FixedAttemptLayout, { ownKeys() { throw new Error("FORBIDDEN_LAYOUT_ACCESS"); } });
  const mkdir = spyOn(fs, "mkdirSync").mockImplementation(() => { throw new Error("FORBIDDEN_FS"); });
  const spawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_SPAWN"); });
  try {
    for (const value of [null, false, 0, "", {}, []]) {
      expect(() => new FixedAttemptFactory(fixture.corpus, null, layout, value as unknown as NativeObserver)).toThrow("Fixed attempt: OBSERVER");
      expect(() => observeNativeTransport(new MockNativePort(), attemptId, "a", value as unknown as NativeObserver)).toThrow("Fixed attempt: OBSERVER");
    }
    expect(mkdir).not.toHaveBeenCalled(); expect(spawn).not.toHaveBeenCalled();
  } finally { mkdir.mockRestore(); spawn.mockRestore(); }
});

function mockNativeChild() {
  const port = new MockNativePort(), encoder = new TextEncoder();
  let output!: ReadableStreamDefaultController<Uint8Array>, errors!: ReadableStreamDefaultController<Uint8Array>, resolve!: (code: number) => void;
  const stdout = new ReadableStream<Uint8Array>({ start(controller) { output = controller; } });
  const stderr = new ReadableStream<Uint8Array>({ start(controller) { errors = controller; } });
  const exited = new Promise<number>(yes => { resolve = yes; });
  let closed = false;
  const finish = (code: number) => { if (!closed) { closed = true; child.exitCode = code; output.close(); errors.close(); resolve(code); } };
  const child = { stdout, stderr, exited, exitCode: null as number | null,
    stdin: { write(json: string) { output.enqueue(encoder.encode(port.reply(json.slice(0, -1)) + "\n")); return json.length; },
      async flush() {}, async end() { finish(0); } },
    kill(signal: string) { port.reasons.push(signal); finish(137); },
  };
  return { child, port };
}

function scratchLayout() {
  const root = fs.mkdtempSync(fileURLToPath(new URL("./scratch/qualification-native-source-", import.meta.url)));
  const layout: FixedAttemptLayout = { scratchRoot: `${root}/inputs`, cwd: root, learnerExecutable: `${root}/mock-policy-channel`,
    bunExecutable: `${root}/mock-bun`, matchEntrypoint: `${root}/mock-match.ts` };
  return { root, layout, cleanup() { fs.rmdirSync(layout.scratchRoot); fs.rmdirSync(root); } };
}

test("MOCK real factory branch observes both channels and passes original deadlines, limits, arguments and environments", async () => {
  const scratch = scratchLayout(), fixture = matchFixture({ windows: 0 }), events: NativeObservation[] = [];
  const native = [mockNativeChild(), mockNativeChild()], launches: { command: unknown; options: unknown }[] = [];
  const match = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  const spawn = spyOn(Bun, "spawn").mockImplementation(((command: unknown, options: unknown) => {
    launches.push({ command, options }); return native[launches.length - 1]!.child;
  }) as unknown as typeof Bun.spawn);
  const matchSpawn = spyOn(childProcess, "spawn").mockImplementation((() => {
    queueMicrotask(() => { match.stdout.end(); match.stderr.end(); match.emit("exit", 0, null); }); return match;
  }) as unknown as typeof childProcess.spawn);
  const clockNs = () => 17n, timing = { clockNs, originNs: 17n, startupDeadlineNs: 10_000_000_017n, workDeadlineNs: 297_000_000_017n, cleanupDeadlineNs: 300_000_000_017n };
  let release: (() => void) | undefined;
  try {
    const factory = new FixedAttemptFactory(fixture.corpus, null, scratch.layout, event => { events.push(event); });
    const owned = await factory.create({ descriptor: fixture.descriptor, rng: fixture.rng, model: syntheticRecord("MOCK_NOT_NATIVE_MODEL"), directory: scratch.root, timing });
    release = owned.releaseInputs;
    for (const learner of [Reflect.get(owned.learners, "first"), Reflect.get(owned.learners, "second")]) {
      expect(Reflect.get(learner, "clockNs")).toBe(clockNs); expect(Reflect.get(learner, "workDeadlineNs")).toBe(timing.workDeadlineNs);
      expect(Reflect.get(learner, "cleanupDeadlineNs")).toBe(timing.cleanupDeadlineNs);
    }
    expect(Reflect.get(owned.transport, "cleanupDeadlineNs")).toBe(timing.cleanupDeadlineNs);
    await owned.learners.begin(0); await owned.learners.accumulate(ack()); expect((await owned.learners.propose(1)).kind).toBe("proposed"); await owned.learners.close();
    expect(launches).toHaveLength(2); expect(matchSpawn).toHaveBeenCalledTimes(1);
    for (const [index, channel] of (["a", "b"] as const).entries()) {
      expect(launches[index]).toEqual({ command: [scratch.layout.learnerExecutable, `${scratch.layout.scratchRoot}/attempt-${fixture.descriptor.attemptId}/config.json`,
        `${scratch.layout.scratchRoot}/attempt-${fixture.descriptor.attemptId}/model.bpk`, `${fixture.descriptor.attemptId}:learner:${channel}`], options: {
        cwd: scratch.root, env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", NODE_ENV: "production", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", RAYON_NUM_THREADS: "2" },
        stdin: "pipe", stdout: "pipe", stderr: "pipe" } });
      const observed = events.filter(event => event.channel === channel);
      expect(observed.every(event => event.attemptId === fixture.descriptor.attemptId)).toBe(true);
      expect(observed.filter(event => event.kind === "reply").map(event => JSON.parse(event.json).result.kind)).toEqual(["begun", "acknowledged", "proposed", "closed"]);
      expect(observed.at(-1)).toEqual({ kind: "finish", attemptId: fixture.descriptor.attemptId, channel, receipt: cleanExit() });
      expect(native[index]!.port.reasons).toEqual([]);
    }
    expect(matchSpawn.mock.calls[0]!.slice(0, 2)).toEqual([scratch.layout.bunExecutable, ["--no-env-file", "--no-install", scratch.layout.matchEntrypoint,
      fixture.descriptor.attemptId, fixture.descriptor.modelId, "297000000000"]]);
  } finally {
    release?.(); match.stdin.end(); spawn.mockRestore(); matchSpawn.mockRestore(); scratch.cleanup();
  }
});

test("MOCK startup failure after raw port acquisition cleans that raw owner and releases model inputs", async () => {
  const scratch = scratchLayout(), fixture = matchFixture({ windows: 0 }), native = mockNativeChild(), failure = new Error("MOCK_LEARNER_CONSTRUCTION_FAILURE");
  const spawn = spyOn(Bun, "spawn").mockImplementation((() => native.child) as unknown as typeof Bun.spawn);
  const matchSpawn = spyOn(childProcess, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_MATCH_ACQUISITION"); });
  let clocks = 0;
  try {
    const factory = new FixedAttemptFactory(fixture.corpus, null, scratch.layout, () => {});
    await expect(factory.create({ descriptor: fixture.descriptor, rng: fixture.rng, model: syntheticRecord("MOCK_NOT_NATIVE_MODEL"), directory: scratch.root,
      timing: { clockNs: () => { if (++clocks === 2) throw failure; return 17n; }, originNs: 17n, startupDeadlineNs: 10_000_000_017n,
        workDeadlineNs: 297_000_000_017n, cleanupDeadlineNs: 300_000_000_017n } })).rejects.toBe(failure);
    expect(spawn).toHaveBeenCalledTimes(1); expect(matchSpawn).not.toHaveBeenCalled();
    expect(native.port.reasons).toEqual(["SIGKILL"]); expect(fs.readdirSync(scratch.layout.scratchRoot)).toEqual([]);
  } finally { spawn.mockRestore(); matchSpawn.mockRestore(); scratch.cleanup(); }
});

test("fixed factory defaults, raw owner registration order and stream limits remain unchanged", () => {
  expect(FIXED_ATTEMPT_LAYOUT).toEqual({ scratchRoot: "/tmp/episode-model", cwd: "/app", bunExecutable: "/usr/local/bin/bun",
    learnerExecutable: "/usr/local/bin/policy-channel", matchEntrypoint: "/app/packages/runtime/src/match-worker-main.ts" });
  const source = fs.readFileSync(new URL("../../packages/runtime/src/fixed-attempt.ts", import.meta.url), "utf8");
  expect(source).toContain("frameBytes: 8 * 1024 * 1024, stdoutBytes: 64 * 1024 * 1024, stderrBytes: 65536");
  expect(source).toMatch(/ports\.push\(port\);\s+const observed = observeNativeTransport\(port, descriptor\.attemptId, suffix, this\.observer\);\s+return new NativeLearner\(sessionId, descriptor\.modelId, observed, timing\.clockNs, timing\.workDeadlineNs, timing\.cleanupDeadlineNs\)/);
});
