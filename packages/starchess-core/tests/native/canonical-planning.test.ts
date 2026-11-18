// SPEC: _spec/turn-planning.puml
import { expect, test } from "bun:test";
import { planningCorpus } from "./planning-corpus";
import golden from "./fixtures/canonical-planning.json";

test("matches canonical native-dependency and append fingerprints across both sides", () => {
  const { reference: _reference, ...expected } = golden;
  expect(planningCorpus()).toEqual(expected);
});
