// SPEC: _spec/resolution-primitives.puml
import { expect, test } from "bun:test";
import { resolutionCorpus } from "./resolution-corpus";
import golden from "./fixtures/canonical-resolution-primitives.json";

test("matches canonical schedules, mover contacts, mine effects, Charon targets and ray discoveries", () => {
  const { reference: _reference, ...expected } = golden;
  expect(resolutionCorpus()).toEqual(expected);
});
