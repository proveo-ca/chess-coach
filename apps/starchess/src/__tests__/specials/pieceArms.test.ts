/**
 * Piece arms — queueing behavior of each extracted special arm.
 * // SPEC: _spec/apps/starchess/turn-input-sequence.puml
 */
import { describe, expect, it } from "vitest";

import type { Square } from "@chess-coach/starchess-core";

import { addScAction } from "@chess-coach/starchess-core";

import { createMatchStateFromScfen } from "~/app/matchReducer";
import { createMatchStore } from "~/app/MatchStoreContext";
import { tankModeForSieged } from "~/presentation/board/tankMode";
import { mechaCharonArm } from "~/presentation/specials/arms/mechaCharon";
import { hoverbikeMineArm } from "~/presentation/specials/arms/hoverbikeMine";
import { shipJumpArm } from "~/presentation/specials/arms/shipJump";
import { tankSiegeArm } from "~/presentation/specials/arms/tankSiege";
import type { MatchStore } from "~/types/match";

const makeStore = (fen: string): MatchStore =>
  createMatchStore({ initial: createMatchStateFromScfen(fen, 1) });

const snapOf = (store: MatchStore) => store.state().liveSnapshot;

describe("tankSiegeArm", () => {
  it("queues the siege toggle", () => {
    const store = makeStore("SCFEN|4k3/8/8/8/8/8/8/R3K3|1|33|P|G:11:11|Q:w:;b:");
    expect(tankSiegeArm(store, snapOf(store), { square: "a1", piece: "r" })).toBe("armed");
    expect(snapOf(store).queue?.actions).toMatchObject([
      { timing: "B", kind: "siegeMode", color: "w", from: "a1" },
    ]);
  });

  it("rejects a mismatched piece without queueing", () => {
    const store = makeStore("SCFEN|4k3/8/8/8/8/8/8/R3K3|1|33|P|G:11:11|Q:w:;b:");
    expect(tankSiegeArm(store, snapOf(store), { square: "a1", piece: "q" })).toBe(false);
    expect(snapOf(store).queue?.actions ?? []).toHaveLength(0);
  });

  it("queues at F timing after a classical", () => {
    const store = makeStore("SCFEN|4k3/8/8/8/8/8/4P3/R3K3|1|33|P|G:11:11|Q:w:;b:");
    const queued = addScAction({
      snapshot: snapOf(store),
      action: { timing: "C", kind: "classical", color: "w", from: "e2", to: "e3" },
    });
    store.dispatch({ type: "APPLY_SNAPSHOT", snapshot: queued.snapshot });
    expect(tankSiegeArm(store, snapOf(store), { square: "a1", piece: "r" })).toBe("armed");
    expect(snapOf(store).queue?.actions).toMatchObject([
      { timing: "C", kind: "classical", color: "w", from: "e2", to: "e3" },
      { timing: "F", kind: "siegeMode", color: "w", from: "a1" },
    ]);
  });
});

describe("hoverbikeMineArm", () => {
  it("queues the mine on its own square", () => {
    const store = makeStore("SCFEN|4k3/8/8/8/8/8/8/1N2K3|1|33|P|G:11:11|Q:w:;b:");
    expect(hoverbikeMineArm(store, snapOf(store), { square: "b1", piece: "n" })).toBe("armed");
    expect(snapOf(store).queue?.actions).toMatchObject([
      { timing: "B", kind: "spiderMine", color: "w", from: "b1", to: "b1" },
    ]);
  });
});

describe("mechaCharonArm", () => {
  it("opens targeting on all diagonals when no ship sits on them", () => {
    const store = makeStore("SCFEN|4k3/8/8/8/8/8/8/2B1K3|1|33|P|G:11:11|Q:w:;b:");
    expect(mechaCharonArm(store, snapOf(store), { square: "c1", piece: "b" })).toBe(
      "pending",
    );
    expect(store.shell().targeting).toMatchObject({
      kind: "charonMissiles",
      from: "c1",
    });
    const t = store.shell().targeting;
    expect(t && "targets" in t && [...t.targets].sort()).toEqual([
      "a3",
      "b2",
      "d2",
      "e3",
      "f4",
      "g5",
      "h6",
    ]);
  });

  it("opens targeting even when an allied ship screens the ray", () => {
    // White mecha c1; white ship e3 screens black ship h6 — free aim still
    // offers every diagonal square; the screened shot fizzles at resolve.
    const store = makeStore(
      "SCFEN|4k3/8/7q/8/8/4Q3/8/2B1K3|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(mechaCharonArm(store, snapOf(store), { square: "c1", piece: "b" })).toBe(
      "pending",
    );
    const t = store.shell().targeting;
    expect(t && "targets" in t && [...t.targets].sort()).toEqual([
      "a3",
      "b2",
      "d2",
      "e3",
      "f4",
      "g5",
      "h6",
    ]);
  });

  it("opens targeting with ship squares included", () => {
    const store = makeStore(
      "SCFEN|4k3/8/7q/8/8/8/8/2B1K3|1|33|P|G:11:11|Q:w:;b:",
    );
    let reset = 0;
    let opened = 0;
    expect(
      mechaCharonArm(store, snapOf(store), { square: "c1", piece: "b" }, {
        resetSpawn: () => { reset += 1; },
        onAfterOpen: () => { opened += 1; },
      }),
    ).toBe("pending");
    expect(reset).toBe(1);
    expect(opened).toBe(1);
    const t = store.shell().targeting;
    expect(t).toMatchObject({ kind: "charonMissiles", from: "c1" });
    expect(t && "targets" in t && t.targets).toContain("h6");
  });

  it("offers post-move diagonals when its own classical is queued", () => {
    // King-defense-6 geometry (with the h2 marine aboard): Be4→g2
    // queued, so f1 (on g2's diagonal but not e4's) must be pickable
    // for the F snipe.
    const store = makeStore("SCFEN|7k/8/8/3q4/4B3/8/7P/7K|21|13|P|G:33:33|Q:w:;b:");
    const queued = addScAction({
      snapshot: snapOf(store),
      action: { timing: "C", kind: "classical", color: "w", from: "e4", to: "g2" },
    });
    store.dispatch({ type: "APPLY_SNAPSHOT", snapshot: queued.snapshot });
    expect(mechaCharonArm(store, snapOf(store), { square: "e4", piece: "b" })).toBe(
      "pending",
    );
    const t = store.shell().targeting;
    // `from` stays the arming square; only the offered targets project.
    expect(t).toMatchObject({ kind: "charonMissiles", from: "e4" });
    expect(t && "targets" in t && t.targets).toContain("f1");
  });

  it("offers current diagonals without a queued classical", () => {
    const store = makeStore("SCFEN|7k/8/8/3q4/4B3/8/8/7K|21|13|P|G:33:33|Q:w:;b:");
    expect(mechaCharonArm(store, snapOf(store), { square: "e4", piece: "b" })).toBe(
      "pending",
    );
    const t = store.shell().targeting;
    expect(t && "targets" in t && [...t.targets].sort()).toEqual([
      "a8",
      "b1",
      "b7",
      "c2",
      "c6",
      "d3",
      "d5",
      "f3",
      "f5",
      "g2",
      "g6",
      "h1",
      "h7",
    ]);
    expect(t && "targets" in t && t.targets).not.toContain("f1");
  });

  it("ignores a classical queued from another square", () => {
    // Borrowing another unit's post-move square would teleport the shot:
    // offers stay byte-identical to the unqueued diagonals.
    const store = makeStore("SCFEN|7k/8/8/3q4/4B3/8/8/7K|21|13|P|G:33:33|Q:w:;b:");
    const queued = addScAction({
      snapshot: snapOf(store),
      action: { timing: "C", kind: "classical", color: "w", from: "h1", to: "g1" },
    });
    store.dispatch({ type: "APPLY_SNAPSHOT", snapshot: queued.snapshot });
    expect(mechaCharonArm(store, snapOf(store), { square: "e4", piece: "b" })).toBe(
      "pending",
    );
    const t = store.shell().targeting;
    expect(t).toMatchObject({ kind: "charonMissiles", from: "e4" });
    expect(t && "targets" in t && [...t.targets].sort()).toEqual([
      "a8",
      "b1",
      "b7",
      "c2",
      "c6",
      "d3",
      "d5",
      "f3",
      "f5",
      "g2",
      "g6",
      "h1",
      "h7",
    ]);
  });

  it("ignores an enemy classical on the wire", () => {
    const store = makeStore("SCFEN|7k/8/8/3q4/4B3/8/8/7K|21|13|P|G:33:33|Q:w:;b:");
    const queued = addScAction({
      snapshot: snapOf(store),
      action: { timing: "C", kind: "classical", color: "b", from: "d5", to: "d4" },
    });
    store.dispatch({ type: "APPLY_SNAPSHOT", snapshot: queued.snapshot });
    expect(mechaCharonArm(store, snapOf(store), { square: "e4", piece: "b" })).toBe(
      "pending",
    );
    const t = store.shell().targeting;
    expect(t).toMatchObject({ kind: "charonMissiles", from: "e4" });
    expect(t && "targets" in t && t.targets).not.toContain("f1");
  });
});

describe("shipJumpArm", () => {
  const vision = (store: MatchStore) => ({
    tankModeFor: tankModeForSieged(store.shell().siegedTanks),
  });

  it("rejects a mismatched piece on a BattleShip square", () => {
    const store = makeStore("SCFEN|4k3/8/8/8/8/8/8/3QK3|1|33|P|G:11:11|Q:w:;b:");
    expect(
      shipJumpArm(store, snapOf(store), { square: "d1", piece: "k" }, vision(store)),
    ).toBe(false);
    expect(store.shell().targeting).toBeNull();
  });

  it("rejects a BattleShip piece on a non-battleship square", () => {
    const store = makeStore("SCFEN|4k3/8/8/8/8/8/8/3QK3|1|33|P|G:11:11|Q:w:;b:");
    expect(
      shipJumpArm(store, snapOf(store), { square: "e1", piece: "q" }, vision(store)),
    ).toBe(false);
    expect(store.shell().targeting).toBeNull();
  });

  it("opens targeting over visible empty squares", () => {
    const store = makeStore("SCFEN|4k3/8/8/8/8/8/8/3QK3|1|33|P|G:11:11|Q:w:;b:");
    expect(
      shipJumpArm(store, snapOf(store), { square: "d1", piece: "q" }, vision(store)),
    ).toBe("pending");
    const t = store.shell().targeting;
    expect(t?.kind).toBe("tacticalJump");
    expect(t && "targets" in t && (t.targets as Square[]).length).toBeGreaterThan(0);
  });
});
