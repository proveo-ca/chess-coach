// SPEC: _spec/candidate-generation.puml
import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { ENUMERATION_VERSION, enumerateCandidates } from "../src";
import { candidateFixture } from "./candidate-fixture";
import golden from "./fixtures/enumeration-v1.json";

test("pins the new enumeration version's discovery order and stopping boundaries", () => {
  expect(ENUMERATION_VERSION).toBe(golden.version);
  for (const [name, expected] of Object.entries(golden.scenarios)) {
    const input = candidateFixture(name === "pass-only" ? "5PPK/6PP/8/8/8/8/8/k7" : undefined);
    if (name !== "rich") { input.own.gas = 0; input.own.minerals = 0; }
    const batch = enumerateCandidates(JSON.stringify(input));
    expect(expected).toEqual({
      retained: batch.candidates.length, attemptedExtensions: batch.attemptedExtensions,
      stopReason: batch.stopReason, sha256: createHash("sha256").update(JSON.stringify(batch)).digest("hex"),
    });
  }
});
