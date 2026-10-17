// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseScFen, type ScFenSnapshot } from "@chess-coach/starchess-core";
import { openedFixture } from "../fixture";
import { projectObservation } from "../observation";

test("projects exactly 64 ordered cells without native state or enemy resources", () => {
  const observation = projectObservation(openedFixture().opening, "w");
  assert.equal(observation.cells.length, 64);
  assert.deepEqual(observation.cells.map(cell => cell.square), Array.from({ length: 64 }, (_, index) => `${String.fromCharCode(97 + Math.floor(index / 8))}${index % 8 + 1}`));
  assert.deepEqual(observation.own.pieces, [{ square: "e1", type: "k" }]);
  assert.deepEqual(Object.keys(observation).sort(), ["cells", "own", "side", "turn", "version"]);
  for (const cell of observation.cells) {
    if (cell.visibility === "unknown") assert.deepEqual(Object.keys(cell).sort(), ["square", "visibility"]);
  }
});

test("hidden enemy state and opposing resources do not change the observation", () => {
  const base = "SCFEN|1n2k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
  const first = parseScFen(base);
  const second = parseScFen(base.replace("1n2k3", "4kn2"));
  second.stored = { w: 3, b: 9 };
  assert.deepEqual(projectObservation(first, "w"), projectObservation(second, "w"));
});

test("own mine projection preserves duplicate-square counts", () => {
  const { opening } = openedFixture();
  opening.mines = [{ color: "w", at: "d2" }, { color: "w", at: "d2" }, { color: "b", at: "a8" }];
  assert.deepEqual(projectObservation(opening, "w").own.mines, ["d2", "d2"]);
});

test("the projection detaches and deeply freezes recipient data", () => {
  const { opening } = openedFixture();
  const observation = projectObservation(opening, "w");
  opening.stored.w = 11;
  assert.equal(observation.own.minerals, 3);
  assert.ok(Object.isFrozen(observation));
  assert.ok(Object.isFrozen(observation.own.pieces[0]));
  assert.ok(Object.isFrozen(observation.cells));
  assert.throws(() => Object.assign(observation.own, { minerals: 9 }), TypeError);
});

test("projection requires explicit host banking", () => {
  const { opening } = openedFixture();
  const withoutBank: ScFenSnapshot = structuredClone(opening);
  delete withoutBank.stored;
  assert.throws(() => projectObservation(withoutBank, "w"), /explicit mineral bank/);
});
