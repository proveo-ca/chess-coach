// SPEC: _spec/causal-journal.puml
import { expect, test } from "bun:test";
import { causalJournalJsonSchema, causalStateJsonSchema, decodeCausalJournal, decodeCausalState, encodeCausalJournal, MAX_CAUSAL_JSON_BYTES } from "../src/causal-journal";
import { causalRun } from "./causal-fixture";

test("standard JSON/Zod round trips actual mutation journals and state", () => {
  const { ended } = causalRun();
  expect(decodeCausalJournal(encodeCausalJournal(ended.journal))).toEqual(ended.journal);
  expect(decodeCausalState(JSON.stringify(ended.state))).toEqual(ended.state);
  expect(causalJournalJsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  expect(causalStateJsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
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
