// SPEC: _spec/turn-planning.puml
import { expect, test } from "bun:test";
import { queueCorpus } from "./queue-corpus";
import golden from "./fixtures/canonical-queue.json";

test("matches canonical queue acceptance, refusal, gas and removal fingerprints", () => {
  const { reference: _reference, ...expected } = golden;
  expect(queueCorpus()).toEqual(expected);
});
