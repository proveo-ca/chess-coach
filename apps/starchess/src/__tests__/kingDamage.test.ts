import { describe, expect, it } from "vitest";

import {
  kingDamageCuesFromBoard,
  visibleKingDamageCues,
  withKingFire,
} from "~/presentation/animations/kingDamage";

const OPEN = "4k3/8/8/8/8/8/8/4K3";

const NONE: ReadonlySet<string> = new Set();

const NO_GATES = {
  attackFrom: NONE,
  dyingAt: NONE,
  dyingColors: NONE,
  movingColors: NONE,
  isVisible: () => true,
};

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

/**
 * `handleMoveWave` flips `moveProgress` one frame before it commits the
 * relocated placement, so a burning slot keyed off placement is still parked on
 * `from` for the whole slide. Two hulls then draw the same king: a pristine
 * mover at z 30 and this layer's fire at z 35.
 * // SPEC: _spec/apps/starchess/architecture/board-entities.puml
 */
describe("visibleKingDamageCues · travelling king", () => {
  const damaged = () => kingDamageCuesFromBoard(OPEN, { w: 2, b: 1 }, []);

  it("hands the hull to the move layer while that king travels", () => {
    expect(
      visibleKingDamageCues(damaged(), {
        ...NO_GATES,
        movingColors: new Set(["w"]),
      }).map((c) => c.id),
    ).toEqual(["b"]);
  });

  it("takes the hull back once the move cue clears", () => {
    expect(visibleKingDamageCues(damaged(), NO_GATES).map((c) => c.id)).toEqual([
      "w",
      "b",
    ]);
  });

  it("gates on the side, not the square — the mover is between tiles", () => {
    // `at` still reads the origin mid-slide, so a square gate would miss it.
    const cues = damaged();
    expect(cues.find((c) => c.id === "w")!.at).toBe("e1");
    expect(
      visibleKingDamageCues(cues, {
        ...NO_GATES,
        movingColors: new Set(["w", "b"]),
      }),
    ).toEqual([]);
  });
});

/**
 * The handoff's other half: whichever layer the persistent slot stepped aside
 * for has to receive `damage` + `seed`, or nothing burns at all.
 * // SPEC: _spec/apps/starchess/architecture/board-entities.puml
 */
describe("withKingFire", () => {
  // One array per test: the seeder rolls a fresh random seed on every call, and
  // seed continuity between slot and hull is the thing being pinned.
  const fire = kingDamageCuesFromBoard(OPEN, { w: 2, b: 3 }, []);

  it("dresses a king hull — attack or move — from that side's fire cue", () => {
    const hp = fire.find((c) => c.id === "w")!;
    for (const cue of [
      { id: "a0", piece: "k", color: "w", from: "e1", to: "e3" },
      { id: "f0", piece: "k", color: "w", from: "e1", to: "e2" },
    ] as const) {
      const [out] = withKingFire([cue], fire);
      expect(out).toMatchObject({ damage: "smallFire", seed: hp.seed });
    }
  });

  it("leaves the array identical when no hull needs fire", () => {
    // Cue arrays are structurally shared down the VFX path.
    const healthy = [{ id: "f0", piece: "k", color: "b", from: "e8", to: "e7" }] as const;
    expect(withKingFire(healthy, fire)).toBe(healthy);

    const pawn = [{ id: "f1", piece: "p", color: "w", from: "e2", to: "e3" }] as const;
    expect(withKingFire(pawn, fire)).toBe(pawn);
    expect(withKingFire(pawn, [])).toBe(pawn);
  });

  it("dresses only the damaged side in a two-king wave", () => {
    const cues = [
      { id: "a0", piece: "k", color: "w", from: "e1", to: "e3" },
      { id: "a1", piece: "k", color: "b", from: "e8", to: "e6" },
    ] as const;
    const out = withKingFire(cues, fire);
    expect(out[0]).toMatchObject({ damage: "smallFire" });
    expect(out[1]).toBe(cues[1]);
  });
});
