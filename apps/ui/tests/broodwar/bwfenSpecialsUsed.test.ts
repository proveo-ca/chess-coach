import { describe, expect, it } from "vitest";

import {
  formatBwFen,
  formatSpecialsUsedExtra,
  parseBwFen,
  parseSpecialsUsedExtra,
} from "~/broodwar/bwfen";

describe("BWFEN specials-used extras", () => {
  it("round-trips U: packed squares", () => {
    const raw = formatBwFen({
      placement: "4k3/8/8/8/3R4/8/8/4K3",
      turn: 2,
      kingLives: { w: 3, b: 3 },
      phase: "P",
      specialsUsed: ["e4", "c4"],
    });
    expect(raw).toBe("BWFEN1|4k3/8/8/8/3R4/8/8/4K3|2|33|P|U:c4e4");
    const snap = parseBwFen(raw);
    expect(snap.specialsUsed).toEqual(["c4", "e4"]);
  });

  it("omits U: when empty", () => {
    const raw = formatBwFen({
      placement: "4k3/8/8/8/8/8/8/4K3",
      turn: 0,
      kingLives: { w: 3, b: 2 },
      phase: "P",
    });
    expect(raw).toBe("BWFEN1|4k3/8/8/8/8/8/8/4K3|0|32|P");
    expect(parseBwFen(raw).specialsUsed).toBeUndefined();
  });

  it("parses packed square lists", () => {
    expect(parseSpecialsUsedExtra("U:a1h8")).toEqual(["a1", "h8"]);
    expect(formatSpecialsUsedExtra(["h8", "a1"])).toBe("U:a1h8");
  });
});
