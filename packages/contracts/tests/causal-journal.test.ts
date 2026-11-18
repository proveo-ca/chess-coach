// SPEC: _spec/causal-journal.puml, _spec/engine-consolidation.puml
import { expect, test } from "bun:test";
import { CausalJournal } from "@chess-coach/starchess-core/engine/causal-events";
import { seedCausalState } from "@chess-coach/starchess-core/causal-producer";
import type { CausalJournalData } from "@chess-coach/starchess-core/causal-types";
import type { Square } from "@chess-coach/starchess-core/engine";
import { resolveTurnKernel } from "../../starchess-core/src/resolve/resolve-turn";
import { causalJournalJsonSchema, causalStateJsonSchema, decodeCausalJournal, decodeCausalState, encodeCausalJournal, MAX_CAUSAL_JSON_BYTES } from "../src/causal-journal";
import { produceRecipient, seedRecipient } from "../src/recipient";
import { causalBoard, causalRun } from "./causal-fixture";

function pathCCShot(at: Square = "a2") {
  const snapshot = causalBoard([["a1", "r", "w"], ["h1", "k", "w"], [at, "k", "b"]]);
  const initial = seedCausalState(snapshot);
  const actions = [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "a8", seq: 0 }] as const;
  const collector = new CausalJournal(initial, actions);
  const result = resolveTurnKernel({ placement: snapshot.placement, ccLives: snapshot.ccLives, white: actions[0], black: null,
    isTargetVisible: () => false }, collector, { w: 0, b: null });
  const next = { ...snapshot, ...result.afterAll };
  return { snapshot, initial, actions, result, next, ...collector.finish(next) };
}

const reindexEvents = (value: CausalJournalData): void => { value.events.forEach((event, ordinal) => event.ordinal = ordinal); };

function removeAppliedMove(value: CausalJournalData): void {
  const applied = value.discoveries[0]!.applied!;
  value.events = value.events.filter(event => event.kind !== "unit-moved" || event.group !== applied.group || event.entityId !== applied.actorId);
  reindexEvents(value);
}

test("standard JSON/Zod round trips actual mutation journals and state", () => {
  const { ended } = causalRun();
  expect(decodeCausalJournal(encodeCausalJournal(ended.journal))).toEqual(ended.journal);
  expect(decodeCausalState(JSON.stringify(ended.state))).toEqual(ended.state);
  expect(causalJournalJsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  expect(causalStateJsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
});

test("actual stationary CC-shot journal round trips and projects both recipients without private IDs", () => {
  const generated = pathCCShot();
  const encoded = encodeCausalJournal(generated.journal);
  const decoded = decodeCausalJournal(encoded);
  expect(encoded).toBe(JSON.stringify(generated.journal));
  expect(decoded).toEqual(generated.journal);
  expect(decodeCausalState(JSON.stringify(generated.state))).toEqual(generated.state);
  const query = decoded.discoveries[0]!;
  expect(query).toMatchObject({ returnedStep: 1, steps: [{ square: "a2", visible: true }],
    applied: { operation: "cc-shot", actorId: query.evaluationActorId, targetId: query.evaluationTargetId } });
  expect(decoded.events.filter(event => event.group === query.applied!.group)).toEqual([
    expect.objectContaining({ kind: "cc-damaged", phase: "C-path", before: 3, after: 2, actionSeq: 0 }),
  ]);
  expect(generated.result.moves).toEqual([{ piece: "r", color: "w", from: "a1", to: "a8" }]);
  for (const side of ["w", "b"] as const) {
    const initial = seedRecipient(generated.snapshot, generated.initial, side, 12);
    const projected = produceRecipient(initial.state, generated.next, generated.state, decoded, "settled", 12, generated.actions);
    expect(projected.batch.observation.own.ccLives).toBe(side === "w" ? 3 : 2);
    expect(projected.batch.observation.own.minerals).toBe(12);
    if (side === "w") {
      expect(projected.batch.events).toContainEqual(expect.objectContaining({ kind: "vision",
        changes: [{ square: "a2", visibility: "lit", piece: { type: "k", color: "b" } }] }));
      expect(projected.batch.events.filter(event => event.kind === "own-unit-moved")).toEqual([
        expect.objectContaining({ id: "w:unit:opening:a1", from: "a1", to: "a8" }),
      ]);
      expect(projected.batch.observation.ownUnitLineage).toContainEqual(expect.objectContaining({ id: "w:unit:opening:a1", square: "a8", type: "r" }));
    }
    for (const privateKey of ["engine:", "evaluationActorId", "evaluationTargetId", "appliedActorId", "appliedTargetId", "discoveryOrdinal", "actionSeq", "returnedStep"]) {
      expect(JSON.stringify(projected.batch)).not.toContain(privateKey);
    }
  }
});

test("capture discoveries still reject removal of their actual movement", () => {
  const value = structuredClone(causalRun().ended.journal);
  expect(value.discoveries[0]!.applied!.operation).toBe("capture");
  removeAppliedMove(value);
  expect(() => decodeCausalJournal(JSON.stringify(value))).toThrow("APPLIED_ACTOR");
});

for (const [target, returnedStep] of [["a3", 1], ["a6", 3]] as const) {
  test(`nonstationary CC shot at ${target} still requires movement despite returned step ${returnedStep}`, () => {
    const generated = pathCCShot(target);
    expect(decodeCausalJournal(encodeCausalJournal(generated.journal))).toEqual(generated.journal);
    expect(generated.journal.discoveries[0]!.returnedStep).toBe(returnedStep);
    const value = structuredClone(generated.journal);
    removeAppliedMove(value);
    expect(() => decodeCausalJournal(JSON.stringify(value))).toThrow("APPLIED_ACTOR");
  });
}

for (const variant of ["actor-id", "target-id", "group", "sequence", "phase", "target-square", "ray-target", "actor-cell", "target-cell",
  "conflicting-move", "prior-origin", "trace", "duplicate-target", "duplicate-trace"] as const) {
  test(`stationary CC-shot codec rejects inconsistent ${variant}`, () => {
    const value = structuredClone(pathCCShot().journal);
    const query = value.discoveries[0]!;
    const damage = value.events.find(event => event.kind === "cc-damaged")!;
    switch (variant) {
      case "actor-id": query.applied!.actorId = damage.targets[0]!.appliedActorId = "engine:unit:192"; break;
      case "target-id": query.applied!.targetId = damage.targets[0]!.appliedTargetId = "engine:unit:192"; break;
      case "group": query.applied!.group++; break;
      case "sequence": damage.actionSeq = 1; break;
      case "phase": damage.phase = "C-move"; break;
      case "target-square": damage.targets[0]!.square = "b2"; break;
      case "ray-target": query.target = query.steps[0]!.square = damage.targets[0]!.square = "b2"; break;
      case "actor-cell": {
        const actor = value.initialCells.w.find(cell => cell.square === "a1")!;
        if (actor.visibility !== "lit") throw new Error("expected lit actor");
        actor.piece = null;
        break;
      }
      case "target-cell": {
        const target = value.initialCells.w.find(cell => cell.square === "a2")!;
        if (target.visibility !== "lit") throw new Error("expected lit target");
        target.piece = { type: "p", color: "b" };
        break;
      }
      case "conflicting-move":
        value.events.unshift({ kind: "unit-moved", entityId: query.applied!.actorId, from: "b1", to: "c1", actionSeq: 0,
          ordinal: 0, group: query.applied!.group, phase: "C-path" });
        reindexEvents(value);
        break;
      case "prior-origin":
        value.events.forEach(event => event.group++);
        query.applied!.group++;
        value.events.unshift({ kind: "unit-moved", entityId: query.applied!.actorId, from: "a1", to: "b1", actionSeq: 0,
          ordinal: 0, group: 0, phase: "B" });
        reindexEvents(value);
        break;
      case "trace": query.steps.push({ square: "a3", visible: false }); break;
      case "duplicate-target": damage.targets.push(structuredClone(damage.targets[0]!)); break;
      case "duplicate-trace": value.discoveries.push(structuredClone(query)); break;
    }
    expect(() => decodeCausalJournal(JSON.stringify(value))).toThrow();
  });
}

test("stationary CC-shot codec rejects duplicate applied traces with distinct ordinals and damage groups", () => {
  const value = structuredClone(pathCCShot().journal);
  const query = structuredClone(value.discoveries[0]!);
  const damage = structuredClone(value.events.find(event => event.kind === "cc-damaged")!);
  value.events.forEach(event => { if (event.group > 0) event.group++; });
  query.ordinal = 1;
  query.applied!.group = 1;
  damage.group = 1;
  damage.before = 2;
  damage.after = 1;
  damage.targets[0]!.discoveryOrdinal = 1;
  value.discoveries.push(query);
  value.events.splice(1, 0, damage);
  reindexEvents(value);
  expect(() => decodeCausalJournal(JSON.stringify(value))).toThrow("APPLIED_ACTOR");
});

test("journal rejects byte exhaustion before parsing, including multibyte input", () => {
  expect(() => decodeCausalJournal(" ".repeat(MAX_CAUSAL_JSON_BYTES + 1))).toThrow(RangeError);
  expect(() => decodeCausalJournal('"' + "é".repeat(MAX_CAUSAL_JSON_BYTES / 2) + '"')).toThrow(RangeError);
  expect(() => decodeCausalJournal("{")).toThrow();
});

for (const variant of ["version", "extra", "ordinal", "group", "phase", "target", "source", "applied", "evaluation", "trace", "cells", "effect-order", "duplicate-target"] as const) {
  test(`journal rejects structurally or causally inconsistent ${variant}`, () => {
    const value = structuredClone(causalRun().ended.journal);
    const loss = value.events.find(event => event.kind === "unit-destroyed")!;
    const query = value.discoveries[0]!;
    switch (variant) {
      case "version": Reflect.set(value, "version", "unregistered"); break;
      case "extra": Reflect.set(value, "verified", true); break;
      case "ordinal": value.events[0]!.ordinal++; break;
      case "group": value.events[0]!.group++; break;
      case "phase": loss.phase = "C-move"; break;
      case "target": loss.targets[0]!.square = "b6"; break;
      case "source": query.actionSeq++; break;
      case "applied": query.applied!.targetId = "engine:unit:192"; break;
      case "evaluation": loss.targets[0]!.evaluationTargetId = "engine:unit:192"; break;
      case "trace": query.steps[0]!.visible = true; break;
      case "cells": value.initialCells.w.reverse(); break;
      case "effect-order": {
        const vision = value.events.find(event => event.kind === "visibility")!;
        const index = value.events.indexOf(vision);
        value.events.splice(index, 1);
        value.events.unshift(vision);
        value.events.forEach((event, ordinal) => event.ordinal = ordinal);
        break;
      }
      case "duplicate-target": loss.targets.push(structuredClone(loss.targets[0]!)); break;
    }
    expect(() => decodeCausalJournal(JSON.stringify(value))).toThrow();
  });
}

test("state rejects duplicate identities, stale modes, missing mines and counter substitution", () => {
  const initial = causalRun().initial;
  for (const alter of [
    (state: typeof initial) => Reflect.set(state, "extra", true),
    (state: typeof initial) => Reflect.set(state.entities[1]!, "id", state.entities[0]!.id),
    (state: typeof initial) => Reflect.set(state.entities[0]!, "tankMode", "siege"),
    (state: typeof initial) => Reflect.set(state, "mineOrder", ["engine:mine:1"]),
    (state: typeof initial) => state.unitCounter = 2,
  ]) {
    const value = structuredClone(initial);
    alter(value);
    expect(() => decodeCausalState(JSON.stringify(value))).toThrow();
  }
});
