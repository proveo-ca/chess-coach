import { describe, expect, it } from "vitest";

import {
  withHiddenSquares,
  withIdList,
  withShallowRecord,
  withTrails,
} from "~/app/timelineStructuralShare";

describe("timelineStructuralShare", () => {
  it("withHiddenSquares keeps prev Set when equal", () => {
    const prev = new Set(["e2", "e4"] as const);
    expect(withHiddenSquares(prev, ["e2", "e4"])).toBe(prev);
    expect(withHiddenSquares(prev, undefined)).toBe(prev);
    const next = withHiddenSquares(prev, ["e2"]);
    expect(next).not.toBe(prev);
    expect([...next]).toEqual(["e2"]);
  });

  it("withIdList keeps prev array when equal", () => {
    const prev = ["a", "b"] as const;
    expect(withIdList(prev, ["a", "b"])).toBe(prev);
    expect(withIdList(prev, ["a", "c"])).toEqual(["a", "c"]);
  });

  it("withShallowRecord keeps prev when values equal", () => {
    const prev = { a1: true as boolean };
    expect(withShallowRecord(prev, { a1: true })).toBe(prev);
    expect(withShallowRecord(prev, { a1: false })).toEqual({ a1: false });
  });

  it("withTrails compares id/from/to", () => {
    const prev = [{ id: "t1", from: "e2" as const, to: "e4" as const }];
    expect(withTrails(prev, [{ id: "t1", from: "e2", to: "e4" }])).toBe(prev);
    expect(withTrails(prev, [{ id: "t1", from: "e2", to: "e5" }])).not.toBe(prev);
  });
});
