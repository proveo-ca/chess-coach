// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { addScAction, applyStoredIncome, beginScTurn, endScTurn, formatScFen, parseScFen, placementToMap } from "@chess-coach/starchess-core";
import { OPENING } from "../fixture";
import { handleRequest, INPUT_LIMIT, parseRequest, PROTOCOL } from "../protocol";

const open = () => ({ protocol: PROTOCOL, id: 17, op: "open", fixture: "tiny-v1" });
const action = { kind: "classical", timing: "C", color: "w", from: "e1", to: "f1" };
const worker = fileURLToPath(new URL("../worker.ts", import.meta.url));
const cwd = fileURLToPath(new URL("../..", import.meta.url));

test("open returns only the limited observation", () => {
  const response = handleRequest(open());
  assert.equal(response.exit, 0);
  assert.deepEqual(Object.keys(response.reply).sort(), ["id", "observation", "ok", "op", "protocol"]);
});

test("settlement equals an independent native engine replay", () => {
  const request = { ...open(), op: "settle", action };
  const response = handleRequest(request);
  assert.equal(response.exit, 0);
  if (!("result" in response.reply)) throw new Error("Missing engine result");
  const result = response.reply.result;
  const initial = parseScFen(OPENING);
  const begun = beginScTurn(initial);
  const opening = { ...begun.next, stored: { w: 3, b: 3 } };
  const admitted = addScAction({ snapshot: opening, action: { kind: "classical", timing: "C", color: "w", from: "e1", to: "f1" } }).snapshot;
  const resolved = endScTurn(admitted, { skipTurnStartChecks: true });
  const bank = applyStoredIncome({ w: 3, b: 3 }, resolved.next.turn);
  assert.deepEqual(result.rawBegin, begun);
  assert.deepEqual(result.rawResolve, resolved);
  assert.equal(result.finalScfen, formatScFen({ ...resolved.next, stored: bank }));
  assert.deepEqual(result.bankAfter, { w: 4, b: 4 });
  assert.deepEqual(placementToMap(parseScFen(result.finalScfen).placement).get("f1"), { color: "w", type: "k" });
  assert.deepEqual(result.requestedActions.b, []);
  const opened = handleRequest(open());
  if (!("observation" in opened.reply)) throw new Error("Missing observation");
  assert.deepEqual(response.reply.observation, opened.reply.observation);
});

for (const [name, value] of Object.entries({
  extra: { ...open(), path: "/tmp/model" },
  wrongVersion: { ...open(), protocol: "other" },
  wrongFixture: { ...open(), fixture: "other" },
  fractionalId: { ...open(), id: 0.5 },
  negativeId: { ...open(), id: -1 },
  extraActionField: { ...open(), op: "settle", action: { ...action, seq: 0 } },
  opposingAction: { ...open(), op: "settle", action: { ...action, color: "b" } },
  malformedSquare: { ...open(), op: "settle", action: { ...action, to: "i9" } },
  unsupportedDestination: { ...open(), op: "settle", action: { ...action, to: "e2" } },
  unsupportedActor: { ...open(), op: "settle", action: { ...action, from: "d1" } },
})) {
  test(`rejects closed-protocol violation: ${name}`, () => {
    assert.throws(() => parseRequest(value));
    assert.equal(handleRequest(value).exit, 2);
  });
}

test("rejects an unsupported actor before native admission", () => {
  const response = handleRequest({ ...open(), op: "settle", action: { ...action, from: "a1" } });
  assert.equal(response.exit, 2);
  if (!("error" in response.reply)) throw new Error("Expected rejection");
  assert.equal(response.reply.error.code, "BAD_REQUEST");
});

test("both specified fixture moves reach native settlement", () => {
  for (const to of ["d1", "f1"]) {
    const response = handleRequest({ ...open(), op: "settle", action: { ...action, to } });
    assert.equal(response.exit, 0);
    if (!("result" in response.reply)) throw new Error("Expected native settlement");
    assert.equal(response.reply.result.requestedActions.w[0].to, to);
  }
});

test("actual Node worker frames one matching reply", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", worker], { cwd, env: { PATH: process.env.PATH ?? "" }, input: JSON.stringify(open()), encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.trim().split("\n").length, 1);
  assert.equal(JSON.parse(result.stdout).id, 17);
});

for (const [name, input] of Object.entries({ trailing: "{} {}", malformed: "{", oversized: " ".repeat(INPUT_LIMIT + 1) })) {
  test(`actual Node worker rejects ${name} input`, () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", worker], { cwd, env: { PATH: process.env.PATH ?? "" }, input, encoding: "utf8", timeout: 5000 });
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).error.code, "BAD_REQUEST");
  });
}
