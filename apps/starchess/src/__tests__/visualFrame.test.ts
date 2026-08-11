import { describe, expect, it } from "vitest";

import { deriveVisualFrame } from "~/presentation/animations/visualFrame";

describe("deriveVisualFrame", () => {
  it("death owns at and suppresses attack on the same square", () => {
    const frame = deriveVisualFrame({
      attackCues: [{ id: "a1", from: "e4", to: "e5" }],
      deathCues: [{ id: "d1", at: "e4" }],
    });
    expect(frame.owners.get("e4")).toEqual({ kind: "death", cueId: "d1" });
    expect(frame.suppressedAttackIds.has("a1")).toBe(true);
    expect(frame.hideSquares.has("e4")).toBe(true);
  });

  it("attackDying suppresses hull without granting attack ownership", () => {
    const frame = deriveVisualFrame({
      attackCues: [{ id: "a1", from: "d2", to: "d4" }],
      attackDying: { a1: true },
      deathCues: [{ id: "d1", at: "d4" }],
    });
    expect(frame.owners.get("d2")).toBeUndefined();
    expect(frame.owners.get("d4")).toEqual({ kind: "death", cueId: "d1" });
    expect(frame.suppressedAttackIds.has("a1")).toBe(true);
    // Still hide the origin while the hull is suppressed.
    expect(frame.hideSquares.has("d2")).toBe(true);
  });

  it("priority: death > deploy > move > attack > kingDamage", () => {
    const frame = deriveVisualFrame({
      deathCues: [{ id: "d1", at: "a1" }],
      deployCues: [
        { id: "dep1", at: "a1" },
        { id: "dep2", at: "b1" },
      ],
      moveCues: [{ id: "m1", from: "b1", to: "b2" }],
      attackCues: [{ id: "a1", from: "c1", to: "c2" }],
      kingDamage: [
        { id: "w", at: "c1" },
        { id: "b", at: "e8" },
      ],
    });
    expect(frame.owners.get("a1")?.kind).toBe("death");
    expect(frame.owners.get("b1")?.kind).toBe("deploy");
    expect(frame.owners.get("b2")?.kind).toBe("move");
    expect(frame.owners.get("c1")?.kind).toBe("attack");
    expect(frame.owners.get("e8")?.kind).toBe("kingDamage");
  });

  it("move skips virtual walk-off destinations; jump owns from+to", () => {
    const frame = deriveVisualFrame({
      moveCues: [{ id: "m1", from: "e7", to: "e9" as never }],
      jumpCues: [{ id: "j1", from: "d4", to: "d6" }],
    });
    expect(frame.hideSquares.has("e7")).toBe(true);
    expect(frame.hideSquares.has("e9" as never)).toBe(false);
    expect(frame.owners.get("d4")?.kind).toBe("jump");
    expect(frame.owners.get("d6")?.kind).toBe("jump");
  });

  it("returns empty sets when no cues", () => {
    const frame = deriveVisualFrame({});
    expect(frame.hideSquares.size).toBe(0);
    expect(frame.owners.size).toBe(0);
    expect(frame.suppressedAttackIds.size).toBe(0);
  });
});
