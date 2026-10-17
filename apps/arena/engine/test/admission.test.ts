// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import { test } from "node:test";
import { type ScActionInput } from "@chess-coach/starchess-core";
import { assertOpenSnapshot, commitWindow, stageSide } from "../admission";
import { openedFixture } from "../fixture";

const action: ScActionInput = { kind: "classical", timing: "C", color: "w", from: "e1", to: "f1" };

test("stages both seats from the open boundary and commits only the full pair", () => {
  const { opening } = openedFixture();
  const before = structuredClone(opening);
  const result = commitWindow(opening, { w: [action], b: [] });
  assert.deepEqual(opening, before);
  assert.deepEqual(result.snapshot.queue?.actions.map(({ seq, ...value }) => { assert.equal(seq, 0); return value; }), [action]);
  assert.deepEqual(result.bank, { w: 3, b: 3 });
  assert.deepEqual(result.snapshot.stored, result.bank);
});

test("rejecting the second seat preserves the input and bank", () => {
  const { opening } = openedFixture();
  const before = structuredClone(opening);
  assert.throws(() => commitWindow(opening, { w: [action], b: [{ ...action, color: "b", from: "a8" }] }));
  assert.deepEqual(opening, before);
});

test("rejects mixed-side actions without mutation", () => {
  const { opening } = openedFixture();
  assert.throws(() => stageSide(opening, "b", [action]), /opposing action/);
  assert.equal(opening.queue?.actions.length, 0);
});

test("requires empty planning state and a valid explicit bank", () => {
  const { opening } = openedFixture();
  assert.throws(() => assertOpenSnapshot({ ...opening, phase: "M" }));
  assert.throws(() => assertOpenSnapshot({ ...opening, stored: { w: -1, b: 3 } }));
  assert.throws(() => assertOpenSnapshot({ ...opening, queue: { actions: [{ ...action, seq: 0 }] } }));
});
