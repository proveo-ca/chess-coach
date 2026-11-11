// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { currentGameDriver } from "../src/current-driver";
import { referenceProofDriver } from "../src/reference-driver";
import fixture from "./fixtures/native-reference-proof.json";

test("current fixed init/open/pass data matches independently executed old-reference source fingerprints", () => {
  const initialized = currentGameDriver.initialize(), opened = currentGameDriver.open(initialized.state), settled = currentGameDriver.settle(opened.state, { w: [], b: [] });
  for (const [index, result] of [initialized, opened, settled].entries()) {
    const json = JSON.stringify(result.boundary), expected = fixture.stages[index]!;
    expect(String(result.boundary.kind)).toBe(expected.stage);
    expect(Buffer.byteLength(json)).toBe(expected.bytes);
    expect(createHash("sha256").update(json).digest("hex")).toBe(expected.sha256);
  }
  expect(fixture.coldF9Proof).toBe(false);
});

test("reference proof adapter rejects missing exports instead of using the main resolver as fallback", () => {
  expect(() => referenceProofDriver({} as never)).toThrow();
});
