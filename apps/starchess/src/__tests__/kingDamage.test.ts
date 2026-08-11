import { describe, expect, it } from "vitest";

import { kingDamageCuesFromBoard } from "~/presentation/animations/kingDamage";

const OPEN = "4k3/8/8/8/8/8/8/4K3";

describe("kingDamageCuesFromBoard", () => {
  it("keeps pristine cues for HP-drop tracking (display layer filters them)", () => {
    const full = kingDamageCuesFromBoard(OPEN, { w: 3, b: 3 }, []);
    expect(full.every((c) => c.damage === "pristine")).toBe(true);
    expect(full.every((c) => (c.impactSeq ?? 0) === 0)).toBe(true);
  });

  it("bumps impactSeq only when HP drops, not on quiet re-sync", () => {
    const full = kingDamageCuesFromBoard(OPEN, { w: 3, b: 3 }, []);

    const chipped = kingDamageCuesFromBoard(OPEN, { w: 2, b: 3 }, full);
    const w = chipped.find((c) => c.id === "w")!;
    expect(w.damage).toBe("smallFire");
    expect(w.impactSeq).toBe(1);

    const same = kingDamageCuesFromBoard(OPEN, { w: 2, b: 3 }, chipped);
    expect(same.find((c) => c.id === "w")!.impactSeq).toBe(1);

    const again = kingDamageCuesFromBoard(OPEN, { w: 1, b: 3 }, same);
    expect(again.find((c) => c.id === "w")!.impactSeq).toBe(2);
  });

  it("does not boom-bump when restoring an already-damaged SCFEN from empty prev", () => {
    const restored = kingDamageCuesFromBoard(OPEN, { w: 2, b: 3 }, []);
    expect(restored.find((c) => c.id === "w")!.impactSeq).toBe(0);
  });
});
