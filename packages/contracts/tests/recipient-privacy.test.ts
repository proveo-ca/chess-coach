// SPEC: _spec/recipient-production.puml, _spec/causal-journal.puml
import { expect, test } from "bun:test";
import type { ScActionInput, Square } from "@chess-coach/game-core";
import type { RecipientBatch } from "../src/recipient";
import { causalBoard } from "./causal-fixture";
import { recipientRun } from "./recipient-fixture";

const move = (color: "w" | "b", from: Square, to: Square): ScActionInput => ({ kind: "classical", timing: "C", color, from, to });
const bytes = (value: unknown): string => JSON.stringify(value);
const targets = (batch: RecipientBatch, at: Square) => batch.events.filter(event => event.kind === "vision" && event.changes.length === 1 &&
  event.changes[0]!.square === at && event.changes[0]!.visibility === "lit" && event.changes[0]!.piece?.color !== batch.side);
const sightings = (batch: RecipientBatch) => batch.events.flatMap(event => event.kind === "vision"
  ? event.changes.filter(cell => cell.visibility !== "unknown" && cell.piece?.color !== batch.side && cell.piece) : []);

test("hidden-prefix Hoverbike twins keep actual target facts but identical acting-recipient bytes", () => {
  const opening = causalBoard([["a1", "b", "w"], ["h1", "k", "w"], ["a8", "k", "b"], ["g7", "p", "b"], ["f5", "n", "b"]]);
  const left = recipientRun(opening, [move("w", "a1", "h8")], [move("b", "f5", "d4")]);
  const right = recipientRun(opening, [move("w", "a1", "h8")], [move("b", "f5", "d6")]);
  expect(left.native.ended.journal.discoveries[0]!.steps.map(step => step.square)).toContain("d4");
  expect(left.native.ended.result.next.placement).not.toBe(right.native.ended.result.next.placement);
  expect(bytes(left.settled.w.batch)).toBe(bytes(right.settled.w.batch));
  expect(targets(left.settled.w.batch, "g7")).toHaveLength(1);
  expect(sightings(left.settled.w.batch).filter(cell => ["d4", "d6", "f5"].includes(cell.square))).toEqual([]);
  expect(left.settled.w.batch.observation.everLit).not.toContain("d4");
  expect(left.settled.w.batch.observation.economy.enemyLoss).toMatchObject({ confirmedUnitCount: 1, replacementLowerBound: 1, paidLowerBound: 0 });
  expect(bytes(left.settled.w.batch)).not.toContain("engine:");
});

test("retired-enemy-siege discovery step differences do not change recipient bytes", () => {
  const opening = causalBoard([["a1", "r", "w"], ["b3", "k", "w"], ["a4", "r", "b"], ["a8", "p", "b"], ["h8", "k", "b"]],
    { mines: [{ color: "b", at: "a4" }] });
  const actions: ScActionInput[] = [{ kind: "deploy", timing: "B", color: "w", from: "b3", to: "a4", unit: "p" }, move("w", "a1", "a8")];
  const tank = recipientRun(opening, actions), siege = recipientRun({ ...opening, siegedTanks: ["a4"] }, actions);
  expect(tank.native.ended.journal.discoveries[0]!.returnedStep).toBe(5);
  expect(siege.native.ended.journal.discoveries[0]!.returnedStep).toBe(3);
  expect(bytes(tank.settled.w.batch)).toBe(bytes(siege.settled.w.batch));
  expect(siege.settled.w.batch.observation.economy).toMatchObject({ ownPaidDestroyed: 1, ownPaidSurviving: 0, enemyLoss: { confirmedUnitCount: 2 } });
});

test("an incidental moved Battleship from a speculative Tank prefix stays private", () => {
  const result = recipientRun(causalBoard([["a1", "r", "w"], ["e1", "k", "w"], ["a8", "p", "b"], ["h8", "k", "b"], ["h5", "q", "b"]]),
    [move("w", "a1", "a8")], [move("b", "h5", "b5")]);
  expect(result.native.ended.journal.discoveries[0]!.returnedStep).toBe(5);
  expect(sightings(result.settled.w.batch).filter(cell => cell.visibility !== "unknown" && cell.piece?.type === "q")).toEqual([]);
  expect(result.settled.w.batch.observation.cells.find(cell => cell.square === "b5")).toEqual({ square: "b5", visibility: "unknown" });
  expect(result.settled.w.batch.observation.everLit).not.toContain("b5");
  expect(result.settled.w.batch.observation.memory).toEqual([]);
});

test("hidden paid replacement identities do not change consumed target or enemy paid lower bounds", () => {
  const opening = causalBoard([["a1", "b", "w"], ["h1", "k", "w"], ["g7", "p", "b"], ["h7", "k", "b"]]);
  const endowed = recipientRun(opening, [move("w", "a1", "h8")]);
  const replaced = recipientRun(opening, [move("w", "a1", "h8")], [{ kind: "deploy", timing: "B", color: "b", from: "h7", to: "g7", unit: "p" }]);
  expect(endowed.native.ended.journal.discoveries[0]!.applied!.targetId).not.toBe(replaced.native.ended.journal.discoveries[0]!.applied!.targetId);
  expect(bytes(endowed.settled.w.batch)).toBe(bytes(replaced.settled.w.batch));
  expect(replaced.settled.b.batch.observation.economy.ownPaidDestroyed).toBe(1);
  expect(replaced.settled.w.batch.observation.economy.enemyLoss.paidLowerBound).toBe(0);
});

for (const unit of ["p", "n"] as const) {
  test(`consumed casualty memory clears before mine death and hidden F ${unit} replacement`, () => {
    const opening = causalBoard([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["b7", "k", "b"]], { mines: [{ color: "b", at: "a5" }] });
    const result = recipientRun(opening, [move("w", "a1", "a8")], [{ kind: "deploy", timing: "F", color: "b", from: "b7", to: "a6", unit }]);
    const batch = result.settled.w.batch;
    expect(targets(batch, "a6")).toHaveLength(1);
    expect(batch.events.findIndex(event => event.kind === "enemy-unit-destruction-witnessed")).toBeGreaterThan(batch.events.indexOf(targets(batch, "a6")[0]!));
    expect(batch.events.filter(event => event.kind === "own-unit-destroyed")).toHaveLength(1);
    expect(sightings(batch).filter(cell => cell.square === "a6")).toHaveLength(1);
    expect(batch.observation.memory).toEqual([{ square: "b7", piece: { type: "k", color: "b" }, observedTurn: 21 }]);
    expect(batch.observation.cells.find(cell => cell.square === "a6")).toEqual({ square: "a6", visibility: "unknown" });
    expect(result.settled.b.batch.observation.economy.ownPaidSurviving).toBe(unit === "p" ? 1 : 3);
  });
}

test("a later crush does not restore the consumed dead target to memory", () => {
  const result = recipientRun(causalBoard([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["b7", "k", "b"]]),
    [move("w", "a1", "a8")], [{ kind: "deploy", timing: "F", color: "b", from: "b7", to: "a6", unit: "p" }]);
  expect(result.settled.w.batch.observation.memory).toEqual([{ square: "b7", piece: { type: "k", color: "b" }, observedTurn: 21 }]);
  expect(result.settled.w.batch.events.filter(event => event.kind === "own-unit-destroyed")).toHaveLength(1);
});

test("nonacting recipient receives own loss but no consumed enemy target or incidental enemy loss", () => {
  const result = recipientRun(causalBoard([["a1", "r", "w"], ["e1", "k", "w"], ["a8", "p", "b"], ["h8", "k", "b"]]), [move("w", "a1", "a8")]);
  const black = result.settled.b.batch;
  expect(black.events.filter(event => event.kind === "own-unit-destroyed")).toHaveLength(1);
  expect(black.events.filter(event => event.kind === "enemy-unit-destruction-witnessed")).toEqual([]);
  expect(targets(black, "a8")).toEqual([]);
  expect(black.observation.economy.enemyLoss.confirmedUnitCount).toBe(0);
});

test("positive stationary-siege and failed-victim-guard probes emit no public target", () => {
  for (const siege of [true, false]) {
    const opening = causalBoard([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["h8", "k", "b"]], siege ? { siegedTanks: ["a1"] } : {});
    const result = recipientRun(opening, [move("w", "a1", "a8")], siege ? [] : [move("b", "a6", "a5")]);
    expect(result.native.ended.journal.discoveries.some(query => query.returnedStep !== null)).toBe(true);
    expect(result.native.ended.journal.discoveries.every(query => query.applied === null)).toBe(true);
    expect(targets(result.settled.w.batch, "a6")).toEqual([]);
  }
});

test("dead C-wave vision source cannot witness later fire-and-forget enemy loss", () => {
  const result = recipientRun(causalBoard([["a1", "k", "w"], ["b3", "b", "w"], ["c4", "p", "b"], ["d5", "q", "b"], ["g8", "k", "b"]]),
    [{ kind: "charonMissiles", timing: "F", color: "w", from: "b3", to: "d5" }], [move("b", "c4", "b3")]);
  expect(result.settled.w.batch.events.filter(event => event.kind === "enemy-unit-destruction-witnessed")).toEqual([]);
  expect(result.settled.w.batch.observation.economy.enemyLoss.confirmedUnitCount).toBe(0);
  expect(result.settled.w.batch.observation.memory.map(sighting => sighting.square)).toEqual(["c4", "d5"]);
});

test("public recipient event numbering never includes private query or hidden-effect ordinals", () => {
  const result = recipientRun(causalBoard([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["h8", "k", "b"]]), [move("w", "a1", "a8")]);
  const batch = result.settled.w.batch;
  expect(batch.events.map(event => event.sequence)).toEqual(batch.events.map((_, index) => index + 1));
  for (const key of ["engine:", "discoveryOrdinal", "evaluationActorId", "appliedTargetId", "actionSeq", "returnedStep", "visibleTo"]) expect(bytes(batch)).not.toContain(key);
  expect(batch.observation.memory).toEqual([]);
});
