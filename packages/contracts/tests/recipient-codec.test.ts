// SPEC: _spec/recipient-production.puml
import { expect, test } from "bun:test";
import { decodeRecipientBatch, encodeRecipientBatch, recipientBatchJsonSchema } from "../src/recipient-codec";
import { causalBoard } from "./causal-fixture";
import { recipientRun } from "./recipient-fixture";

test("public standard batch codec rejects private fields, cross-recipient IDs and event gaps", () => {
  const batch = recipientRun(causalBoard([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["h8", "k", "b"]]),
    [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" }]).settled.w.batch;
  expect(decodeRecipientBatch(encodeRecipientBatch(batch))).toEqual(batch);
  const extra = structuredClone(batch);
  Reflect.set(extra.events[0]!, "engineId", "engine:unit:1");
  expect(() => decodeRecipientBatch(JSON.stringify(extra))).toThrow();
  const gap = structuredClone(batch);
  gap.events[1]!.sequence++;
  expect(() => decodeRecipientBatch(JSON.stringify(gap))).toThrow("sequence mismatch");
  const other = structuredClone(batch);
  const witness = other.events.find(event => event.kind === "enemy-unit-destruction-witnessed")!;
  witness.witnessId = "b:witness:1";
  expect(() => decodeRecipientBatch(JSON.stringify(other))).toThrow("side mismatch");
  expect(recipientBatchJsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
});
