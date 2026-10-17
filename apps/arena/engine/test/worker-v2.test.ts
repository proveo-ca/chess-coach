// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { encodeReplyV2, INPUT_LIMIT_V2, LineDecoderV2, OUTPUT_LIMIT_V2, runNdjsonV2, WorkerV2 } from "../worker-v2";
import { ACTION_KINDS, EngineErrorV2, parseActionV2, parseRequestV2, PROTOCOL_V2, type Action, type ReplyV2, type SessionOpen } from "../wire-v2";

const requestV2 = (id: number, operation: Record<string, unknown>) => ({ protocol: PROTOCOL_V2, id, ...operation });
const lineV2 = (value: unknown) => Buffer.from(`${JSON.stringify(value)}\n`);
const codeV2 = (code: string) => (error: unknown) => error instanceof EngineErrorV2 && error.packet.code === code;
function successV2(reply: ReplyV2): unknown { if (!reply.ok) throw new Error(reply.error.message); return reply.result; }

async function* chunksV2(chunks: Uint8Array[]) { for (const chunk of chunks) yield chunk; }
async function transportV2(chunks: Uint8Array[]) {
  const lines: string[] = [];
  const diagnostics: string[] = [];
  const exit = await runNdjsonV2(chunksV2(chunks), async line => { lines.push(line); }, message => diagnostics.push(message));
  return { exit, replies: lines.map(line => JSON.parse(line) as ReplyV2), diagnostics };
}

test("v2 wire accepts all seven exact action grammars and rejects unrelated or nullable fields", () => {
  for (const color of ["w", "b"] as const) {
    for (const kind of ACTION_KINDS) {
      const timings = kind === "classical" ? ["C"] as const : ["B", "F"] as const;
      for (const timing of timings) {
        const action = { kind, timing, color, from: "e2", ...(["spiderMine", "siegeMode"].includes(kind) ? {} : { to: "e3" }), ...(kind === "deploy" ? { unit: "p" } : {}) };
        assert.deepEqual(parseActionV2(action), action);
        assert.throws(() => parseActionV2({ ...action, seq: 0 }), codeV2("BAD_REQUEST"));
        assert.throws(() => parseActionV2({ ...action, private: null }), codeV2("BAD_REQUEST"));
        assert.throws(() => parseActionV2({ ...action, from: null }), codeV2("BAD_REQUEST"));
      }
    }
    for (const unit of ["p", "n", "b", "r", "q"]) {
      const action = parseActionV2({ kind: "deploy", timing: "B", color, from: "e1", to: "e2", unit });
      assert.equal(action.kind, "deploy");
      if (action.kind === "deploy") assert.equal(action.unit, unit);
    }
    for (const promotion of ["n", "b", "r", "q"]) assert.equal(parseActionV2({ kind: "classical", timing: "C", color, from: "a7", to: "a8", promotion }).promotion, promotion);
  }
  const base = { kind: "classical", timing: "C", color: "w", from: "a7", to: "a8" };
  for (const promotion of [null, undefined, "p", "k", "", 1]) assert.throws(() => parseActionV2({ ...base, promotion }), codeV2("BAD_REQUEST"));
  for (const action of [
    { ...base, timing: "B" }, { ...base, unit: "p" }, { ...base, from: "a9" },
    { kind: "spiderMine", timing: "B", color: "w", from: "a1", to: "a1" },
    { kind: "siegeMode", timing: "F", color: "b", from: "a8", promotion: "q" },
    { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit: "k" },
  ]) assert.throws(() => parseActionV2(action), codeV2("BAD_REQUEST"));
});

test("v2 requests require exact keys, explicit nullable families, dense bounds and u32 identities", () => {
  const start = requestV2(0, { op: "session.start", fixture: "tiny-v1" });
  assert.deepEqual(parseRequestV2(start), start);
  const invalid: unknown[] = [null, { ...start, protocol: "arena-engine-v1" }, { ...start, id: -1 }, { ...start, id: 2 ** 32 }, { ...start, id: 1.1 },
    { ...start, fixture: "custom" }, { ...start, path: "ignored" }, { ...start, op: "shell" },
    requestV2(1, { op: "plan.next", planning: 1, pulls: [{ kind: "start", prefix: [] }] }),
    requestV2(1, { op: "plan.next", planning: 1, pulls: [] }),
    requestV2(1, { op: "plan.next", planning: 1, pulls: Array(2) }),
    requestV2(1, { op: "plan.close", planning: null }),
  ];
  const accessor = { ...start };
  Object.defineProperty(accessor, "fixture", { enumerable: true, get() { throw new Error("must not execute"); } });
  invalid.push(accessor);
  for (const input of invalid) assert.throws(() => parseRequestV2(input), codeV2("BAD_REQUEST"));
  const next = requestV2(0xffffffff, { op: "plan.next", planning: 1, pulls: [{ kind: "start", prefix: [], family: null }] });
  assert.deepEqual(parseRequestV2(next), next);
});

test("v2 worker enforces increasing IDs and one active live/replay namespace", () => {
  const worker = new WorkerV2();
  const started = successV2(worker.handle(requestV2(0, { op: "session.start", fixture: "tiny-v1" })));
  assert.deepEqual((started as { session: number }).session, 1);
  const duplicate = worker.handle(requestV2(0, { op: "session.close", session: 1 }));
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.error.code, "BAD_REQUEST");
  const conflict = worker.handle(requestV2(1, { op: "replay.start", fixture: "tiny-v1" }));
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "STATE");
  successV2(worker.handle(requestV2(2, { op: "session.close", session: 1 })));
  assert.equal(worker.clean, true);
  successV2(worker.handle(requestV2(3, { op: "replay.start", fixture: "tiny-v1" })));
  successV2(worker.handle(requestV2(4, { op: "replay.close", session: 1 })));
  assert.equal(worker.clean, true);
});

test("v2 worker opens independent planning DTO contexts and closes every cursor", () => {
  const worker = new WorkerV2();
  successV2(worker.handle(requestV2(1, { op: "session.start", fixture: "all-actors-v1" })));
  const opened = successV2(worker.handle(requestV2(2, { op: "session.open", session: 1, planningOrdinal: 0 }))) as SessionOpen;
  if (opened.kind !== "planning") throw new Error("Expected planning");
  const plan = successV2(worker.handle(requestV2(3, { op: "plan.open", view: opened.views.w }))) as { planning: number };
  const first = successV2(worker.handle(requestV2(4, { op: "plan.next", planning: plan.planning, pulls: [{ kind: "start", prefix: [], family: "spiderMine" }] }))) as { steps: { cursor: number; proposal: { action: Action } | null }[] };
  assert.equal(first.steps[0]!.proposal?.action.kind, "spiderMine");
  successV2(worker.handle(requestV2(5, { op: "plan.close", planning: plan.planning })));
  successV2(worker.handle(requestV2(6, { op: "session.commit", context: opened.context, requests: { w: [], b: [] } })));
  successV2(worker.handle(requestV2(7, { op: "session.close", session: 1 })));
  assert.equal(worker.clean, true);
});

test("v2 UTF-8 framing handles split scalars, exact byte bounds and fatal EOF", () => {
  const decoder = new LineDecoderV2();
  const bytes = Buffer.from('{"value":"é"}\n');
  const cut = bytes.indexOf(0xc3) + 1;
  assert.deepEqual([...decoder.push(bytes.subarray(0, cut))], []);
  assert.deepEqual([...decoder.push(bytes.subarray(cut))], ['{"value":"é"}']);
  decoder.finish();
  const exact = new LineDecoderV2();
  assert.equal([...exact.push(Buffer.from(`${" ".repeat(INPUT_LIMIT_V2 - 1)}\n`))][0]!.length, INPUT_LIMIT_V2 - 1);
  assert.throws(() => [...new LineDecoderV2().push(Buffer.alloc(INPUT_LIMIT_V2, 32))], codeV2("BAD_REQUEST"));
  assert.throws(() => [...new LineDecoderV2().push(Buffer.from([0xff, 10]))], codeV2("BAD_REQUEST"));
  const partial = new LineDecoderV2();
  assert.deepEqual([...partial.push(Buffer.from("{}"))], []);
  assert.throws(() => partial.finish(), codeV2("BAD_REQUEST"));
});

test("v2 NDJSON rejects malformed, partial, invalid UTF-8 and oversized input", async () => {
  for (const bytes of [Buffer.from("{\n"), Buffer.from("{}"), Buffer.from([0xff, 10]), Buffer.alloc(INPUT_LIMIT_V2, 32), Buffer.from("\n")]) {
    const result = await transportV2([bytes]);
    assert.equal(result.exit, 2);
    assert.equal(result.replies.length, 1);
    const reply = result.replies[0]!;
    assert.equal(reply.ok, false);
    if (!reply.ok) assert.deepEqual(Object.keys(reply.error).sort(), ["code", "context", "message", "witness"]);
  }
});

test("v2 NDJSON preserves prior complete frames before a later framing failure", async () => {
  const good = lineV2(requestV2(1, { op: "session.start", fixture: "tiny-v1" }));
  const result = await transportV2([Buffer.concat([good, Buffer.from([0xff, 10])])]);
  assert.equal(result.exit, 2);
  assert.equal(result.replies.length, 2);
  assert.equal(result.replies[0]!.ok, true);
  assert.equal(result.replies[1]!.ok, false);
});

test("v2 EOF requires closed engines and plans, including uncommitted begins", async () => {
  assert.equal((await transportV2([])).exit, 0);
  const start = lineV2(requestV2(1, { op: "session.start", fixture: "tiny-v1" }));
  const incomplete = await transportV2([start]);
  assert.equal(incomplete.exit, 1);
  assert.equal(incomplete.replies.length, 1);
  assert.ok(incomplete.diagnostics.length > 0);
  const closed = await transportV2([start, lineV2(requestV2(2, { op: "session.close", session: 1 }))]);
  assert.equal(closed.exit, 0);
  assert.equal(closed.replies.length, 2);
  const bootstrap = new WorkerV2();
  successV2(bootstrap.handle(requestV2(1, { op: "session.start", fixture: "tiny-v1" })));
  const opened = successV2(bootstrap.handle(requestV2(2, { op: "session.open", session: 1, planningOrdinal: 0 }))) as SessionOpen;
  if (opened.kind !== "planning") throw new Error("Expected planning");
  successV2(bootstrap.handle(requestV2(3, { op: "session.close", session: 1 })));
  const planOnly = await transportV2([lineV2(requestV2(1, { op: "plan.open", view: opened.views.w }))]);
  assert.equal(planOnly.exit, 1);
  assert.equal(planOnly.replies[0]!.ok, true);
});

test("v2 input stream failures produce one fixed engine-failure envelope", async () => {
  const brokenV2: AsyncIterable<Uint8Array> = {
    [Symbol.asyncIterator]() {
      return { next: () => Promise.reject(new Error("unavailable input")) };
    },
  };
  const output: string[] = [];
  const exit = await runNdjsonV2(brokenV2, async line => { output.push(line); }, () => {});
  assert.equal(exit, 1);
  assert.equal(output.length, 1);
  const reply = JSON.parse(output[0]!) as ReplyV2;
  assert.equal(reply.ok, false);
  if (!reply.ok) {
    assert.equal(reply.error.code, "ENGINE_FAILURE");
    assert.equal(reply.error.context, null);
    assert.equal(reply.error.witness, null);
  }
});

test("v2 EOF also requires closing pure planning contexts without a live engine", async () => {
  const source = new WorkerV2();
  successV2(source.handle(requestV2(0, { op: "session.start", fixture: "tiny-v1" })));
  const opened = successV2(source.handle(requestV2(1, { op: "session.open", session: 1, planningOrdinal: 0 }))) as SessionOpen;
  if (opened.kind !== "planning") throw new Error("Expected planning");
  const input = lineV2(requestV2(0, { op: "plan.open", view: opened.views.w }));
  assert.equal((await transportV2([input])).exit, 1);
  assert.equal((await transportV2([input, lineV2(requestV2(1, { op: "plan.close", planning: 1 }))])).exit, 0);
  successV2(source.handle(requestV2(2, { op: "session.close", session: 1 })));
});

test("v2 transport awaits output backpressure and does not retry failed writes", async () => {
  let release: () => void = () => {};
  let reached: () => void = () => {};
  const ready = new Promise<void>(resolve => { reached = resolve; });
  const blocked = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  const input = Buffer.concat([
    lineV2(requestV2(1, { op: "session.start", fixture: "tiny-v1" })),
    lineV2(requestV2(2, { op: "session.close", session: 1 })),
  ]);
  const pending = runNdjsonV2(chunksV2([input]), async () => { writes++; if (writes === 1) { reached(); await blocked; } }, () => {});
  await ready;
  assert.equal(writes, 1);
  release();
  assert.equal(await pending, 0);
  assert.equal(writes, 2);
  writes = 0;
  assert.equal(await runNdjsonV2(chunksV2([input]), async () => { writes++; throw new Error("closed output"); }, () => {}), 1);
  assert.equal(writes, 1);
});

test("v2 reply serialization replaces oversized transitions with a bounded error", () => {
  const line = encodeReplyV2({ protocol: PROTOCOL_V2, id: 9, ok: true, result: "x".repeat(OUTPUT_LIMIT_V2) });
  assert.ok(Buffer.byteLength(line) <= OUTPUT_LIMIT_V2);
  const reply = JSON.parse(line) as ReplyV2;
  assert.equal(reply.ok, false);
  assert.equal(reply.id, 9);
  if (!reply.ok) assert.equal(reply.error.code, "ENGINE_FAILURE");
});

async function childV2(chunks: Buffer[], args: string[] = []) {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  delete env.TSX_TSCONFIG_PATH;
  const child = spawn(process.execPath, ["--import", "tsx", "engine/worker-v2.ts", ...args], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)), env, stdio: ["pipe", "pipe", "pipe"],
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", chunk => stdout.push(Buffer.from(chunk)));
  child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
  child.stdin.on("error", () => {});
  const closed = new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  for (const chunk of chunks) child.stdin.write(chunk);
  child.stdin.end();
  const status = await closed;
  const output = Buffer.concat(stdout).toString("utf8");
  return { status, replies: output.trim() ? output.trim().split("\n").map(line => JSON.parse(line) as ReplyV2) : [], stderr: Buffer.concat(stderr).toString("utf8") };
}

test("v2 standalone Node worker streams native transitions across split writes", { timeout: 20000 }, async () => {
  const frames = Buffer.concat([
    lineV2(requestV2(1, { op: "session.start", fixture: "tiny-v1" })),
    lineV2(requestV2(2, { op: "session.open", session: 1, planningOrdinal: 0 })),
    lineV2(requestV2(3, { op: "session.commit", context: { session: 1, planningOrdinal: 0, turn: 0 }, requests: { w: [], b: [] } })),
    lineV2(requestV2(4, { op: "session.close", session: 1 })),
  ]);
  const result = await childV2([frames.subarray(0, 7), frames.subarray(7, 34), frames.subarray(34)]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.replies.length, 4);
  assert.ok(result.replies.every(r => r.protocol === PROTOCOL_V2 && r.ok));
  assert.deepEqual(result.replies.map(r => r.id), [1, 2, 3, 4]);
});

test("v2 standalone worker rejects arguments, stale IDs and nonclosed EOF", { timeout: 20000 }, async () => {
  const args = await childV2([], ["unexpected"]);
  assert.equal(args.status, 2);
  assert.equal(args.replies[0]!.ok, false);
  const unfinished = await childV2([lineV2(requestV2(1, { op: "session.start", fixture: "tiny-v1" }))]);
  assert.equal(unfinished.status, 1);
  assert.match(unfinished.stderr, /closed engine/);
  const repeated = await childV2([
    lineV2(requestV2(1, { op: "session.start", fixture: "tiny-v1" })),
    lineV2(requestV2(1, { op: "session.close", session: 1 })),
  ]);
  assert.equal(repeated.status, 2);
  assert.equal(repeated.replies[1]!.ok, false);
});

test("v2 standalone worker enforces fatal UTF-8 and request byte bounds", { timeout: 20000 }, async () => {
  for (const bytes of [Buffer.from([0xff, 10]), Buffer.alloc(INPUT_LIMIT_V2, 32), Buffer.from("{}")]) {
    const result = await childV2([bytes]);
    assert.equal(result.status, 2);
    assert.equal(result.replies.length, 1);
    const reply = result.replies[0]!;
    assert.equal(reply.ok, false);
    if (!reply.ok) assert.equal(reply.error.code, "BAD_REQUEST");
    assert.ok(Buffer.byteLength(result.stderr) <= 64 * 1024);
  }
});

test("v2 standalone worker rejects malformed UTF-8, partial EOF and oversized frames", { timeout: 20000 }, async () => {
  for (const input of [Buffer.from([0xff, 10]), Buffer.from("{}"), Buffer.alloc(INPUT_LIMIT_V2, 32)]) {
    const result = await childV2([input]);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.replies.length, 1);
    const reply = result.replies[0]!;
    assert.equal(reply.ok, false);
    if (!reply.ok) assert.equal(reply.error.code, "BAD_REQUEST");
  }
});
