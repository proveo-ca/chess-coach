// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { NativeSession } from "../src/native-session";
import { NativeWorker, boundaryDigest } from "../src/worker";
import { currentGameDriver } from "../src/current-driver";
import { decodeNativeReply, encodeNativeRequest } from "../../contracts/src/native-protocol";
import type { NativeRequest } from "../../contracts/src/native-protocol";
import { syntheticSession, SyntheticTransport } from "./fixture";

const request = (extra: Partial<NativeRequest> = {}): string => JSON.stringify({ version: "chess-coach.native.v1", sessionId: "synthetic-session", ordinal: 0, cursor: -1, operation: "init", ...extra });

test("synthetic owned transports verify staged BOTH init/open/pass/close without claiming independent F9 execution", async () => {
  const { session, main, reference } = syntheticSession();
  expect(session.snapshot()).toBeNull();
  const initial = await session.initialize();
  expect(initial.bank).toEqual({ w: 3, b: 3 });
  expect(initial.batches.w.observation.economy.ownPaidDebits).toBe(0);
  await session.open();
  const settled = await session.settle({ w: [], b: [] });
  expect(settled.snapshot.turn).toBe(1);
  expect(settled.bank).toEqual({ w: 4, b: 4 });
  await session.close();
  for (const transport of [main, reference]) {
    expect(transport.requests.map(request => request.operation)).toEqual(["init", "commit", "open", "commit", "settle", "commit", "close"]);
    expect(transport.finished).toBe(1);
    expect(transport.terminated).toBe(0);
  }
  await expect(session.open()).rejects.toThrow("CLOSED");
});

test("worker stages once, replays only identical most-recent bytes and requires the exact commit", () => {
  let initialized = 0;
  const worker = new NativeWorker("main", "native-proof", "synthetic-session", { ...currentGameDriver,
    initialize: () => { initialized++; return currentGameDriver.initialize(); } });
  const json = request(), first = worker.handle(json);
  expect(worker.handle(json)).toBe(first);
  expect(initialized).toBe(1);
  const staged = decodeNativeReply(first);
  if (staged.kind !== "staged") throw new Error("fixture");
  const committed = worker.handle(encodeNativeRequest({ version: "chess-coach.native.v1", sessionId: "synthetic-session", ordinal: 1, cursor: -1,
    operation: "commit", stagedCursor: 0, digest: boundaryDigest(staged.boundary) }));
  expect(decodeNativeReply(committed)).toMatchObject({ kind: "committed", cursor: 0 });
  expect(() => worker.handle(json)).toThrow("SEQUENCE");
  expect(() => worker.handle(request({ ordinal: 2, cursor: 0, operation: "open" }))).toThrow("CLOSED");
});

test("worker rejects pending reentry, conflicting duplicates and request-controlled selectors", () => {
  for (const bad of [
    request({ ordinal: 1, operation: "open" }),
    request({ operation: "open" }),
    JSON.stringify({ ...JSON.parse(request()), executable: "/other/bun" }),
  ]) {
    const worker = new NativeWorker("main", "native-proof", "synthetic-session", currentGameDriver);
    worker.handle(request());
    expect(() => worker.handle(bad)).toThrow();
    expect(() => worker.handle(request())).toThrow("CLOSED");
  }
});

for (const field of ["role", "sessionId", "ordinal", "cursor", "stagedCursor"] as const) {
  test(`coordinator rejects substituted ${field} without publishing either recipient`, async () => {
    const { session, main, reference } = syntheticSession();
    reference.alter = reply => {
      Reflect.set(reply, field, field === "role" ? "main" : field === "sessionId" ? "other" : 1);
      return reply;
    };
    await expect(session.initialize()).rejects.toThrow();
    expect(session.snapshot()).toBeNull();
    expect(main.terminated).toBe(1);
    expect(reference.terminated).toBe(1);
    await expect(session.initialize()).rejects.toThrow("CLOSED");
  });
}

test("matching worker claims cannot replace the independently fixed canonical opening", async () => {
  const { session, main, reference } = syntheticSession();
  for (const transport of [main, reference]) transport.alter = reply => {
    if (reply.kind === "staged") {
      reply.boundary.snapshot.turn = 1;
      Reflect.set(reply.boundary.batches.w.observation, "turn", 1);
      Reflect.set(reply.boundary.batches.b.observation, "turn", 1);
    }
    return reply;
  };
  await expect(session.initialize()).rejects.toThrow("CANONICAL_OPENING");
  expect(session.snapshot()).toBeNull();
});

test("independent comparison rejects changed raw native consequences even if public snapshots agree", async () => {
  const { session, reference } = syntheticSession();
  await session.initialize();
  const before = session.snapshot();
  reference.alter = reply => {
    if (reply.kind === "staged" && reply.boundary.kernel.kind === "opened") reply.boundary.kernel.result.changed = true;
    return reply;
  };
  await expect(session.open()).rejects.toThrow("REFERENCE_MISMATCH");
  expect(session.snapshot()).toEqual(before);
});

test("failed second commit revokes the attempt without publishing a half-committed BOTH successor", async () => {
  const { session, reference } = syntheticSession();
  await session.initialize();
  const before = session.snapshot();
  reference.alter = reply => { if (reply.kind === "committed") reply.digest = "0".repeat(64); return reply; };
  await expect(session.open()).rejects.toThrow("COMMIT_ACK");
  expect(session.snapshot()).toEqual(before);
  await expect(session.open()).rejects.toThrow("CLOSED");
});

test("native-proof mode rejects nonpass planning and early close without dispatching policy work", async () => {
  const first = syntheticSession();
  await first.session.initialize();
  const count = first.main.requests.length;
  await expect(first.session.close()).rejects.toThrow("CLOSE_PHASE");
  expect(first.main.requests.length).toBe(count);
  const second = syntheticSession();
  await second.session.initialize();
  await second.session.open();
  const dispatched = second.main.requests.length;
  await expect(second.session.settle({ w: [{ kind: "classical", timing: "C", color: "w", from: "e2", to: "e3" }], b: [] })).rejects.toThrow("NATIVE_SCOPE");
  expect(second.main.requests.length).toBe(dispatched);
});

test("raw receipt at the immutable deadline fails even before a timer callback runs", async () => {
  const { session, reference, setTime } = syntheticSession();
  reference.alter = reply => { setTime(10_000_000_000n); return reply; };
  await expect(session.initialize()).rejects.toThrow("DEADLINE");
  expect(session.snapshot()).toBeNull();
});

for (const field of ["stdinClosed", "stdoutEof", "stderrEof", "reaped", "exitCode", "forced"] as const) {
  test(`close reply cannot substitute for successful ${field}`, async () => {
    const { session, reference } = syntheticSession();
    await session.initialize(); await session.open(); await session.settle({ w: [], b: [] });
    Reflect.set(reference.receipt, field, field === "exitCode" ? 1 : field === "forced");
    await expect(session.close()).rejects.toThrow("CLEAN_CLOSE");
    expect(reference.terminated).toBe(1);
  });
}

test("coordinator rejects shared channels and cannot continue an operation after concurrent revocation", async () => {
  const clock = () => 0n, main = new SyntheticTransport("main", "native-proof", clock);
  expect(() => new NativeSession("synthetic-session", "native-proof", main, main, clock, 1n, 2n)).toThrow("INITIAL_CONTEXT");
  const setup = syntheticSession();
  let release!: () => void;
  const paused = new Promise<void>(resolve => { release = resolve; });
  setup.main.delay = () => paused;
  const first = setup.session.initialize();
  await expect(setup.session.initialize()).rejects.toThrow("REENTRY");
  release();
  await expect(first).rejects.toThrow("REENTRY");
  expect(setup.session.snapshot()).toBeNull();
  expect(setup.main.requests.map(request => request.operation)).toEqual(["init"]);
  expect(setup.main.terminated).toBe(1);
});
