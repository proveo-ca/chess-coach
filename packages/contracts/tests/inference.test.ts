// SPEC: _spec/policy-io.puml
import { describe, expect, test } from "bun:test";
import { decodeScoreResponse, encodeScoreRequest } from "../src";
import type { ScoreRequest } from "../src";
import layout from "../../../schemas/feature-layout.json";

const request = (): ScoreRequest => ({
  version: "chess-coach.inference.v1", featureVersion: layout.version, requestId: "fixture-1", modelId: "a".repeat(64), rows: 1, values: Array(layout.dimension).fill(0),
});

describe("numeric inference contract", () => {
  test("serializes ordinary finite F64 JSON values and normalizes negative zero", () => {
    const input = { ...request(), values: [-0, Number.MIN_VALUE, 1 / 3, ...Array(layout.dimension - 3).fill(1_000_000)] };
    const output = JSON.parse(encodeScoreRequest(input));
    expect(Object.is(output.values[0], -0)).toBe(false);
    expect(output.values.slice(1, 3)).toEqual([Number.MIN_VALUE, 1 / 3]);
  });

  test.each([0, 513])("rejects row count %i", rows => {
    expect(() => encodeScoreRequest({ ...request(), rows })).toThrow();
  });

  test.each([NaN, Infinity, -Infinity, -1_000_001, 1_000_001])("rejects feature %s", value => {
    expect(() => encodeScoreRequest({ ...request(), values: [value, ...Array(layout.dimension - 1).fill(0)] })).toThrow();
  });

  test("rejects wrong dimensions and malformed identifiers", () => {
    expect(() => encodeScoreRequest({ ...request(), values: Array(layout.dimension - 1).fill(0) })).toThrow();
    expect(() => encodeScoreRequest({ ...request(), featureVersion: "legacy" })).toThrow();
    expect(() => encodeScoreRequest({ ...request(), modelId: "legacy-model" })).toThrow();
    expect(() => encodeScoreRequest({ ...request(), requestId: "bad id" })).toThrow();
  });

  test("accepts maximum candidate count", () => {
    expect(JSON.parse(encodeScoreRequest({ ...request(), rows: 512, values: Array(512 * layout.dimension).fill(0) })).rows).toBe(512);
  });

  test("requires response identities and row count to match", () => {
    const input = request();
    const base = { version: input.version, featureVersion: input.featureVersion, requestId: input.requestId, modelId: input.modelId, logits: [0] };
    expect(decodeScoreResponse(JSON.stringify(base), input).logits).toEqual([0]);
    for (const change of [
      { modelId: "b".repeat(64) }, { requestId: "other" }, { logits: [0, 0] }, { logits: [null] }, { hiddenState: {} },
    ]) expect(() => decodeScoreResponse(JSON.stringify({ ...base, ...change }), input)).toThrow();
  });
});
