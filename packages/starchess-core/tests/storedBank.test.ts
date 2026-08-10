import { describe, expect, it } from "vitest";

import { formatScFen, parseScFen } from "../src/scfen/codec";

describe("SCFEN B: mineral bank", () => {
  it("round-trips stored minerals", () => {
    const raw =
      "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|B:3:5|Q:w:;b:";
    const snap = parseScFen(raw);
    expect(snap.stored).toEqual({ w: 3, b: 5 });
    expect(formatScFen(snap)).toBe(raw);
  });

  it("omits B: when stored is absent (legacy)", () => {
    const raw = "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:";
    const snap = parseScFen(raw);
    expect(snap.stored).toBeUndefined();
    expect(formatScFen(snap)).toBe(raw);
  });

  it("rejects bank above 12", () => {
    expect(() =>
      parseScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|B:13:0"),
    ).toThrow(/B:/);
  });
});
