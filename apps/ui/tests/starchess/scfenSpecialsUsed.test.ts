import { describe, expect, it } from "vitest";

import {
  formatScFen,
  formatSpecialsUsedExtra,
  parseScFen,
  parseSpecialsUsedExtra,
  validateScFen,
} from "~/starchess/scfen";

const GAS1 = { w: 1, b: 1 } as const;

describe("SCFEN specials-used extras", () => {
  it("round-trips U: packed squares", () => {
    const raw = formatScFen({
      placement: "4k3/8/8/8/3R4/8/8/4K3",
      turn: 2,
      kingLives: { w: 3, b: 3 },
      phase: "P",
      gas: { ...GAS1 },
      gasIncome: { ...GAS1 },
      specialsUsed: ["e4", "c4"],
    });
    expect(raw).toBe("SCFEN|4k3/8/8/8/3R4/8/8/4K3|2|33|P|G:11:11|U:c4e4");
    const snap = parseScFen(raw);
    expect(snap.specialsUsed).toEqual(["c4", "e4"]);
  });

  it("omits U: when empty", () => {
    const raw = formatScFen({
      placement: "4k3/8/8/8/8/8/8/4K3",
      turn: 0,
      kingLives: { w: 3, b: 2 },
      phase: "P",
      gas: { ...GAS1 },
      gasIncome: { ...GAS1 },
    });
    expect(raw).toBe("SCFEN|4k3/8/8/8/8/8/8/4K3|0|32|P|G:11:11");
    expect(parseScFen(raw).specialsUsed).toBeUndefined();
  });

  it("parses packed square lists", () => {
    expect(parseSpecialsUsedExtra("U:a1h8")).toEqual(["a1", "h8"]);
    expect(formatSpecialsUsedExtra(["h8", "a1"])).toBe("U:a1h8");
  });
});

describe("SCFEN validateScFen smoke", () => {
  it("rejects missing G:", () => {
    const r = validateScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SC_SCHEMA");
  });
});
