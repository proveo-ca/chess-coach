// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertEconomicResultFits } from "../economic-replay";
import {
  ECONOMIC_PROTOCOL, ECONOMIC_REPLY_LIMIT, ECONOMIC_REQUEST_LIMIT, parseEconomicBoundary, parseEconomicJson,
  parseEconomicRequest, type EconomicReply, type EconomicResult,
} from "../economic-wire";
import { EconomicLineDecoder, EconomicWorker, encodeEconomicReply, runEconomicNdjson } from "../worker-economic";
import { EngineErrorV2 } from "../wire-v2";

const request = (id: number, operation: Record<string, unknown>) => ({ protocol: ECONOMIC_PROTOCOL, id, ...operation });
const line = (value: unknown) => Buffer.from(`${JSON.stringify(value)}\n`);
const code = (value: string, message?: RegExp) => (error: unknown) => error instanceof EngineErrorV2 && error.packet.code === value && (!message || message.test(error.message));
function success(reply: EconomicReply): EconomicResult { if (!reply.ok) throw new Error(reply.error.message); return reply.result; }
function failure(reply: EconomicReply, code: string, message: RegExp): void {
  assert.equal(reply.ok, false);
  if (!reply.ok) {
    assert.equal(reply.error.code, code); assert.match(reply.error.message, message);
    assert.deepEqual(Object.keys(reply.error).sort(), ["code", "context", "message", "witness"]);
  }
}
async function* chunks(parts: Uint8Array[]) { for (const part of parts) yield part; }
async function transport(parts: Uint8Array[]) {
  const output: string[] = []; const diagnostics: string[] = [];
  const exit = await runEconomicNdjson(chunks(parts), async value => { output.push(value); }, value => diagnostics.push(value));
  return { exit, replies: output.map(value => JSON.parse(value) as EconomicReply), diagnostics };
}

test("economic wire exposes exactly four closed object operations, no snapshots, paths or positional aliases", () => {
  const operations = [
    request(0, { op: "economic.start", fixture: "tiny-v1" }), request(1, { op: "economic.open", planningOrdinal: 0 }),
    request(2, { op: "economic.settle", context: { session: 1, planningOrdinal: 0, turn: 0 }, requests: { w: [], b: [] } }), request(0xffffffff, { op: "economic.close" }),
  ];
  for (const operation of operations) {
    assert.deepEqual(parseEconomicRequest(operation), operation);
    for (const extra of ["snapshot", "provenance", "path", "module", "session", "executable"]) assert.throws(() => parseEconomicRequest({ ...operation, [extra]: null }), code("BAD_REQUEST", /Unexpected fields/));
    assert.throws(() => parseEconomicRequest(Object.values(operation)), code("BAD_REQUEST", /Unsupported/));
  }
  for (const id of [-1, -0, 2 ** 32, 1.1, NaN, Infinity, null]) assert.throws(() => parseEconomicRequest(request(id as number, { op: "economic.close" })), code("BAD_REQUEST", /integer/));
  assert.throws(() => parseEconomicRequest(request(1, { op: "replay.start", fixture: "tiny-v1" })), code("BAD_REQUEST", /Unsupported/));
  assert.throws(() => parseEconomicRequest(request(1, { op: "economic.start", fixture: { "tiny-v1": null } })), code("BAD_REQUEST", /fixture/));
  assert.throws(() => parseEconomicRequest(request(1, { op: "economic.start", fixture: "custom" })), code("BAD_REQUEST", /fixture/));
  assert.throws(() => parseEconomicRequest({ ...operations[0], protocol: "arena-engine-v2" }), code("BAD_REQUEST", /protocol/));
  assert.throws(() => parseEconomicRequest(request(1, { op: "economic.settle", context: [1, 0, 0], requests: { w: [], b: [] } })), code("BAD_REQUEST", /plain object/));
  const accessor = { ...operations[0] };
  Object.defineProperty(accessor, "fixture", { enumerable: true, get() { throw new Error("Getter executed"); } });
  assert.throws(() => parseEconomicRequest(accessor), code("BAD_REQUEST", /data field/));
});

test("strict JSON rejects duplicate decoded keys at every nested level for the duplicate-key reason", () => {
  const cases = [
    '{"protocol":"arena-economic-v1","id":1,"id":2,"op":"economic.close"}',
    '{"context":{"session":1,"session":2}}', '{"requests":{"w":[],"w":[]}}',
    '{"action":{"kind":"deploy","kind":"classical"}}', '{"i\\u0064":1,"id":2}',
  ];
  for (const text of cases) assert.throws(() => parseEconomicJson(text), code("BAD_REQUEST", /Duplicate JSON key/));
  assert.equal((parseEconomicJson('{"text":"é\\\"\\\\","id":1}') as { id: number }).id, 1);
  for (const text of ["", "{}{}", "[1,]", '{"id":01}', '{"id":1,}', '"bad\nstring"']) assert.throws(() => parseEconomicJson(text), code("BAD_REQUEST"));
  assert.throws(() => parseEconomicJson(`${"[".repeat(34)}0${"]".repeat(34)}`), code("BAD_REQUEST", /nesting/));
});

test("economic request IDs strictly increase across errors and session restarts without wrapping", () => {
  const worker = new EconomicWorker();
  assert.equal(worker.clean, false);
  success(worker.handle(request(0, { op: "economic.start", fixture: "tiny-v1" })));
  failure(worker.handle(request(0, { op: "economic.close" })), "BAD_REQUEST", /increase strictly/);
  failure(worker.handle(request(1, { op: "economic.start", fixture: "tiny-v1" })), "STATE", /already active/);
  success(worker.handle(request(2, { op: "economic.close" })));
  assert.equal(worker.clean, true);
  const restarted = success(worker.handle(request(3, { op: "economic.start", fixture: "tiny-v1" })));
  assert.ok(restarted.kind === "started"); assert.equal(restarted.session, 2);
  success(worker.handle(request(0xffffffff, { op: "economic.close" })));
  failure(worker.handle(request(0xffffffff, { op: "economic.close" })), "BAD_REQUEST", /increase strictly/);
});

test("economic wire lifecycle carries exact native host facts and data-only recipient boundaries", () => {
  const worker = new EconomicWorker();
  const start = success(worker.handle(request(1, { op: "economic.start", fixture: "standard-v1" })));
  assert.ok(start.kind === "started");
  assert.deepEqual(Object.keys(start).sort(), ["boundaries", "fixture", "initial", "kind", "outcome", "rules", "session"]);
  const open = success(worker.handle(request(2, { op: "economic.open", planningOrdinal: 0 })));
  assert.ok(open.kind === "planning");
  assert.deepEqual(Object.keys(open).sort(), ["begin", "boundaries", "context", "kind", "views"]);
  const paid = success(worker.handle(request(3, { op: "economic.settle", context: open.context, requests: { w: [], b: [] } })));
  assert.ok(paid.kind === "committed");
  for (const side of ["w", "b"] as const) assert.deepEqual(parseEconomicBoundary(paid.boundaries[side]), paid.boundaries[side]);
  assert.ok(!Object.hasOwn(paid, "rules"));
  const closed = success(worker.handle(request(4, { op: "economic.close" })));
  assert.ok(closed.kind === "closed");
  assert.equal(closed.pendingBegin, null);
  assert.deepEqual(Object.keys(closed).sort(), ["image", "kind", "outcome", "pendingBegin", "session"]);
  failure(worker.handle(request(5, { op: "economic.open", planningOrdinal: 1 })), "STATE", /Unknown/);
});

test("native rejection returns required nullable context/witness and permits only safe close", () => {
  const worker = new EconomicWorker(); success(worker.handle(request(1, { op: "economic.start", fixture: "tiny-v1" })));
  const open = success(worker.handle(request(2, { op: "economic.open", planningOrdinal: 0 })));
  assert.ok(open.kind === "planning");
  const rejected = worker.handle(request(3, { op: "economic.settle", context: open.context, requests: { w: [], b: [{ kind: "classical", timing: "C", color: "b", from: "a8", to: "a7" }] } }));
  failure(rejected, "NATIVE_REJECTION", /actor|unit|piece/i);
  if (!rejected.ok) { assert.deepEqual(rejected.error.context, open.context); assert.ok(rejected.error.witness); }
  failure(worker.handle(request(4, { op: "economic.settle", context: open.context, requests: { w: [], b: [] } })), "STATE", /failed/);
  const close = success(worker.handle(request(5, { op: "economic.close" })));
  assert.ok(close.kind === "closed"); assert.equal(close.pendingBegin, null); assert.deepEqual(close.image, open.begin.after);
});

test("strict UTF-8 decoder handles split scalars, exact 64 KiB including LF and partial EOF", () => {
  const bytes = Buffer.from('{"text":"é"}\n'); const cut = bytes.indexOf(0xc3) + 1;
  const decoder = new EconomicLineDecoder();
  assert.deepEqual([...decoder.push(bytes.subarray(0, cut))], []);
  assert.deepEqual([...decoder.push(bytes.subarray(cut))], ['{"text":"é"}']); decoder.finish();
  assert.equal([...new EconomicLineDecoder().push(Buffer.from(`${" ".repeat(ECONOMIC_REQUEST_LIMIT - 1)}\n`))][0]!.length, ECONOMIC_REQUEST_LIMIT - 1);
  assert.throws(() => [...new EconomicLineDecoder().push(Buffer.alloc(ECONOMIC_REQUEST_LIMIT, 32))], code("LIMIT", /64 KiB/));
  for (const bytes of [Buffer.from([0xff, 10]), Buffer.from([0xc3, 10]), Buffer.from([0xed, 0xa0, 0x80, 10])]) assert.throws(() => [...new EconomicLineDecoder().push(bytes)], code("BAD_REQUEST", /UTF-8/));
  const partial = new EconomicLineDecoder(); assert.deepEqual([...partial.push(Buffer.from("{}"))], []);
  assert.throws(() => partial.finish(), code("BAD_REQUEST", /EOF inside/));
});

test("NDJSON rejects duplicate keys, malformed framing, wrong UTF-8 and oversized input without consuming continuation", async () => {
  for (const [bytes, expected, message] of [
    [Buffer.from('{"id":1,"id":2}\n'), "BAD_REQUEST", /Duplicate JSON key/],
    [Buffer.from("{\n"), "BAD_REQUEST", /object key/], [Buffer.from("{}"), "BAD_REQUEST", /EOF inside/],
    [Buffer.from([0xff, 10]), "BAD_REQUEST", /UTF-8/], [Buffer.alloc(ECONOMIC_REQUEST_LIMIT, 32), "LIMIT", /64 KiB/],
  ] as const) {
    const result = await transport(bytes.equals(Buffer.from("{}")) ? [bytes] : [bytes, line(request(9, { op: "economic.start", fixture: "tiny-v1" }))]);
    assert.equal(result.exit, expected === "LIMIT" ? 1 : 2);
    assert.equal(result.replies.length, 1); failure(result.replies[0]!, expected, message);
    if (!result.replies[0]!.ok) assert.equal(result.replies[0]!.id, null);
  }
});

test("EOF succeeds only after explicit close, retaining trailing begins in close", async () => {
  assert.equal((await transport([])).exit, 1);
  const start = line(request(1, { op: "economic.start", fixture: "tiny-v1" }));
  assert.equal((await transport([start])).exit, 1);
  const result = await transport([start, line(request(2, { op: "economic.open", planningOrdinal: 0 })), line(request(3, { op: "economic.close" }))]);
  assert.equal(result.exit, 0);
  const closed = success(result.replies[2]!); assert.ok(closed.kind === "closed"); assert.ok(closed.pendingBegin);
});

test("transport confirms earlier frames before later errors and never retries an uncertain output write", async () => {
  const start = line(request(1, { op: "economic.start", fixture: "tiny-v1" }));
  const prefix = await transport([Buffer.concat([start, Buffer.from([0xff, 10])])]);
  assert.equal(prefix.exit, 2); assert.equal(prefix.replies.length, 2); assert.equal(prefix.replies[0]!.ok, true);
  let writes = 0;
  const input = Buffer.concat([start, line(request(2, { op: "economic.close" }))]);
  assert.equal(await runEconomicNdjson(chunks([input]), async () => { writes++; throw new Error("closed output"); }, () => {}), 1);
  assert.equal(writes, 1);
});

test("transport awaits backpressure before accepting the next request", async () => {
  let release = () => {}; let reached = () => {};
  const blocked = new Promise<void>(resolve => { release = resolve; }); const ready = new Promise<void>(resolve => { reached = resolve; });
  let writes = 0;
  const input = Buffer.concat([line(request(1, { op: "economic.start", fixture: "tiny-v1" })), line(request(2, { op: "economic.close" }))]);
  const pending = runEconomicNdjson(chunks([input]), async () => { writes++; if (writes === 1) { reached(); await blocked; } }, () => {});
  await ready; assert.equal(writes, 1); release(); assert.equal(await pending, 0); assert.equal(writes, 2);
});

test("oversized replies refuse LIMIT rather than truncating facts or silently changing success", () => {
  const worker = new EconomicWorker();
  const reply = worker.handle(request(1, { op: "economic.start", fixture: "tiny-v1" }));
  assert.ok(reply.ok && reply.result.kind === "started");
  const oversized = structuredClone(reply);
  if (!oversized.ok || oversized.result.kind !== "started") throw new Error("Expected start");
  oversized.result.initial.scfen = "x".repeat(ECONOMIC_REPLY_LIMIT);
  assert.throws(() => assertEconomicResultFits(oversized.result), code("LIMIT", /1 MiB/));
  assert.throws(() => encodeEconomicReply(oversized), code("LIMIT", /1 MiB/));
  assert.ok(Buffer.byteLength(encodeEconomicReply(reply)) <= ECONOMIC_REPLY_LIMIT);
  success(worker.handle(request(2, { op: "economic.close" })));
});

test("public boundary decoder enforces group, combined entry, vision, nullable and closed-locator bounds", () => {
  const worker = new EconomicWorker();
  const start = success(worker.handle(request(1, { op: "economic.start", fixture: "tiny-v1" })));
  assert.ok(start.kind === "started");
  const base = start.boundaries.w;
  const own = { units: [{ square: "e1", type: "k", mode: null }], mines: [], ccLives: 3 };
  const fact = { kind: "cc-lives-changed", before: 3, after: 2 };
  const effects = (seq: number, length: number) => ({ kind: "effects", seq, beforeOwn: own, afterOwn: own, facts: Array.from({ length }, () => fact) });
  const withGroups = (groups: unknown[]) => ({ ...base, phase: "turn-open", ordinal: 1, seqThrough: groups.length, groups });
  assert.throws(() => parseEconomicBoundary(withGroups(Array.from({ length: 2049 }, (_, i) => effects(i + 1, 1)))), code("BAD_REQUEST", /array length/));
  assert.throws(() => parseEconomicBoundary(withGroups([effects(1, 1024), effects(2, 1024), effects(3, 1)])), code("BAD_REQUEST", /2048 admission actions plus effect facts/));
  assert.throws(() => parseEconomicBoundary(withGroups([{ kind: "vision", seq: 1, turn: 0, changes: Array.from({ length: 65 }, () => base.snapshot.cells[0]) }])), code("BAD_REQUEST", /array length/));
  assert.throws(() => parseEconomicBoundary(withGroups([{ ...effects(1, 1), facts: [{ kind: "enemy-destruction-witnessed", square: "e2", type: "p" }] }])), code("BAD_REQUEST", /data field/));
  assert.throws(() => parseEconomicBoundary(withGroups([{ ...effects(1, 1), facts: [{ kind: "unit-destroyed", square: "e2", type: "p", subject: { kind: "before-unit", square: "e2", id: "private" } }] }])), code("BAD_REQUEST", /Unexpected fields/));
  assert.throws(() => parseEconomicBoundary({ ...base, snapshot: { ...base.snapshot, side: { w: null } } }), code("BAD_REQUEST", /side/));
  assert.throws(() => parseEconomicBoundary({ ...base, snapshot: { ...base.snapshot, own: { ...base.snapshot.own, pieces: [["e1", "k"]] } } }), code("BAD_REQUEST", /plain object/));
  success(worker.handle(request(2, { op: "economic.close" })));
});

test("economic v1 explicit birth and transformation modes decode both rook modes and required nonrook nulls without aliases", () => {
  const worker = new EconomicWorker();
  const start = success(worker.handle(request(1, { op: "economic.start", fixture: "tiny-v1" })));
  assert.ok(start.kind === "started");
  const own = { units: [{ square: "e1", type: "k", mode: null }], mines: [], ccLives: 3 };
  const withFact = (fact: unknown) => ({ ...start.boundaries.w, ordinal: 1, phase: "turn-open", seqThrough: 1,
    groups: [{ kind: "effects", seq: 1, beforeOwn: own, afterOwn: own, facts: [fact] }],
  });
  for (const mode of ["tank", "siege", null] as const) {
    const born = { kind: "unit-born" as const, actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, square: "e2", type: mode === null ? "p" : "r", mode };
    const transformed = { kind: "unit-transformed" as const, subject: { kind: "before-unit", square: "e2" }, fromType: "p", toType: mode === null ? "q" : "r", toMode: mode };
    for (const fact of [born, transformed]) {
      const input = withFact(fact);
      const decoded = parseEconomicBoundary(input);
      assert.deepEqual(decoded, input);
      assert.notEqual(decoded.groups, input.groups);
      const group = decoded.groups[0]!;
      assert.ok(group.kind === "effects");
      assert.notEqual(group.facts[0], fact);
      if (fact.kind === "unit-born") {
        fact.actionRef.acceptedActionOrdinal = 3;
        assert.ok(group.facts[0]!.kind === "unit-born");
        assert.equal(group.facts[0]!.actionRef.acceptedActionOrdinal, 0);
      } else {
        fact.subject.square = "e3";
        assert.ok(group.facts[0]!.kind === "unit-transformed");
        assert.deepEqual(group.facts[0]!.subject, { kind: "before-unit", square: "e2" });
      }
    }
  }
  for (const [valid, field, typeField] of [
    [{ kind: "unit-born", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, square: "e2", type: "r", mode: "tank" }, "mode", "type"],
    [{ kind: "unit-transformed", subject: { kind: "before-unit", square: "e2" }, fromType: "p", toType: "r", toMode: "tank" }, "toMode", "toType"],
  ] as const) {
    const missing: Record<string, unknown> = { ...valid }; delete missing[field];
    assert.throws(() => parseEconomicBoundary(withFact(missing)), code("BAD_REQUEST", /data field/));
    assert.throws(() => parseEconomicBoundary(withFact({ ...valid, [field]: null })), code("BAD_REQUEST", /rook-only/));
    assert.throws(() => parseEconomicBoundary(withFact({ ...valid, [typeField]: "q" })), code("BAD_REQUEST", /rook-only/));
    for (const alias of [{ tank: null }, ["tank"], "Tank", "sieged", 1, true]) assert.throws(() => parseEconomicBoundary(withFact({ ...valid, [field]: alias })), code("BAD_REQUEST", /Invalid tank mode/));
    assert.throws(() => parseEconomicBoundary(withFact({ ...valid, opponentMode: "siege" })), code("BAD_REQUEST", /Unexpected fields/));
    assert.throws(() => parseEconomicBoundary(withFact(Object.values(valid))), code("BAD_REQUEST", /effect kind/));
    const text = JSON.stringify(withFact(valid));
    const duplicate = text.replace(`"${field}":"tank"`, `"${field}":"tank","${field}":"siege"`);
    assert.notEqual(duplicate, text);
    assert.throws(() => parseEconomicJson(duplicate), code("BAD_REQUEST", /Duplicate JSON key/));
  }
  success(worker.handle(request(2, { op: "economic.close" })));
});

test("input failures produce one bounded failure with both required nullable fields", async () => {
  const broken: AsyncIterable<Uint8Array> = { [Symbol.asyncIterator]() { return { next: () => Promise.reject(new Error("input failed")) }; } };
  const output: string[] = [];
  assert.equal(await runEconomicNdjson(broken, async value => { output.push(value); }, () => {}), 1);
  assert.equal(output.length, 1);
  const reply = JSON.parse(output[0]!) as EconomicReply;
  failure(reply, "ENGINE_FAILURE", /Native economic/);
  if (!reply.ok) assert.deepEqual([reply.id, reply.error.context, reply.error.witness], [null, null, null]);
});

async function child(parts: Buffer[], args: string[] = []) {
  const env = { ...process.env }; delete env.NODE_OPTIONS; delete env.NODE_PATH; delete env.TSX_TSCONFIG_PATH;
  const processChild = spawn(process.execPath, ["--import", "tsx", "engine/worker-economic.ts", ...args], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)), env, stdio: ["pipe", "pipe", "pipe"],
  });
  const stdout: Buffer[] = []; const stderr: Buffer[] = [];
  processChild.stdout.on("data", value => stdout.push(Buffer.from(value))); processChild.stderr.on("data", value => stderr.push(Buffer.from(value)));
  processChild.stdin.on("error", () => {});
  const closed = new Promise<number | null>((resolve, reject) => { processChild.once("error", reject); processChild.once("close", resolve); });
  for (const part of parts) processChild.stdin.write(part);
  processChild.stdin.end();
  const status = await closed; const text = Buffer.concat(stdout).toString("utf8");
  assert.ok(Buffer.concat(stderr).byteLength <= 65_536);
  return { status, replies: text.trim() ? text.trim().split("\n").map(value => JSON.parse(value) as EconomicReply) : [], stderr: Buffer.concat(stderr).toString("utf8") };
}

test("fixed standalone economic worker streams correlated native replies across split writes and exits cleanly", { timeout: 20_000 }, async () => {
  const input = Buffer.concat([
    line(request(1, { op: "economic.start", fixture: "tiny-v1" })), line(request(2, { op: "economic.open", planningOrdinal: 0 })),
    line(request(3, { op: "economic.settle", context: { session: 1, planningOrdinal: 0, turn: 0 }, requests: { w: [], b: [] } })), line(request(4, { op: "economic.close" })),
  ]);
  const result = await child([input.subarray(0, 5), input.subarray(5, 37), input.subarray(37)]);
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(result.replies.map(r => [r.protocol, r.id, r.ok]), [1, 2, 3, 4].map(id => [ECONOMIC_PROTOCOL, id, true]));
});

test("standalone worker refuses arguments, missing close, duplicate keys, stale IDs and byte violations", { timeout: 20_000 }, async () => {
  const args = await child([], ["unexpected"]); assert.equal(args.status, 2); failure(args.replies[0]!, "BAD_REQUEST", /stdin only/);
  const open = await child([line(request(1, { op: "economic.start", fixture: "tiny-v1" }))]); assert.equal(open.status, 1); assert.match(open.stderr, /closed engine/);
  const stale = await child([line(request(1, { op: "economic.start", fixture: "tiny-v1" })), line(request(1, { op: "economic.close" }))]);
  assert.equal(stale.status, 2); failure(stale.replies[1]!, "BAD_REQUEST", /increase strictly/);
  for (const [bytes, expected, code, message] of [
    [Buffer.from('{"id":1,"id":2}\n'), 2, "BAD_REQUEST", /Duplicate/], [Buffer.from([0xff, 10]), 2, "BAD_REQUEST", /UTF-8/],
    [Buffer.from("{}"), 2, "BAD_REQUEST", /EOF/], [Buffer.alloc(ECONOMIC_REQUEST_LIMIT, 32), 1, "LIMIT", /64 KiB/],
  ] as const) {
    const result = await child([bytes]); assert.equal(result.status, expected); assert.equal(result.replies.length, 1); failure(result.replies[0]!, code, message);
  }
});
