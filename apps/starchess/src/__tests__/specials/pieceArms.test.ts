/**
 * Piece arms — queueing behavior of each extracted special arm.
 * // SPEC: _spec/apps/starchess/turn-input-sequence.puml
 */
import { describe, expect, it } from "vitest";

import type { Square } from "@chess-coach/starchess-core";

import { addScAction } from "@chess-coach/starchess-core";

import { createMatchStateFromScfen } from "~/app/matchReducer";
import { createMatchStore } from "~/app/MatchStoreContext";
import { rookModeForSieged } from "~/presentation/board/rookMode";
import { bishopSnipeArm } from "~/presentation/specials/arms/bishopSnipe";
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
      { timing: "B", kind: "rookSiege", color: "w", from: "a1" },
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
      { timing: "F", kind: "rookSiege", color: "w", from: "a1" },
    ]);
  });
});

describe("hoverbikeMineArm", () => {
  it("queues the mine on its own square", () => {
    const store = makeStore("SCFEN|4k3/8/8/8/8/8/8/1N2K3|1|33|P|G:11:11|Q:w:;b:");
    expect(hoverbikeMineArm(store, snapOf(store), { square: "b1", piece: "n" })).toBe("armed");
    expect(snapOf(store).queue?.actions).toMatchObject([
      { timing: "B", kind: "knightMine", color: "w", from: "b1", to: "b1" },
    ]);
  });
});

describe("bishopSnipeArm", () => {
  it("rejects when no unique diagonal queen exists", () => {
    const store = makeStore("SCFEN|4k3/8/8/8/8/8/8/2B1K3|1|33|P|G:11:11|Q:w:;b:");
    expect(bishopSnipeArm(store, snapOf(store), { square: "c1", piece: "b" })).toBe(false);
    expect(store.shell().targeting).toBeNull();
  });

  it("opens targeting on the diagonal queen", () => {
    const store = makeStore(
      "SCFEN|4k3/8/7q/8/8/8/8/2B1K3|1|33|P|G:11:11|Q:w:;b:",
    );
    let reset = 0;
    let opened = 0;
    expect(
      bishopSnipeArm(store, snapOf(store), { square: "c1", piece: "b" }, {
        resetSpawn: () => { reset += 1; },
        onAfterOpen: () => { opened += 1; },
      }),
    ).toBe("pending");
    expect(reset).toBe(1);
    expect(opened).toBe(1);
    expect(store.shell().targeting).toMatchObject({
      kind: "bishopSnipe",
      from: "c1",
      to: "h6",
    });
  });
});

describe("shipJumpArm", () => {
  const vision = (store: MatchStore) => ({
    rookModeFor: rookModeForSieged(store.shell().siegedRooks),
  });

  it("rejects a mismatched piece on a queen square", () => {
    const store = makeStore("SCFEN|4k3/8/8/8/8/8/8/3QK3|1|33|P|G:11:11|Q:w:;b:");
    expect(
      shipJumpArm(store, snapOf(store), { square: "d1", piece: "k" }, vision(store)),
    ).toBe(false);
    expect(store.shell().targeting).toBeNull();
  });

  it("rejects a queen piece on a non-queen square", () => {
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
    expect(t?.kind).toBe("queenWarp");
    expect(t && "targets" in t && (t.targets as Square[]).length).toBeGreaterThan(0);
  });
});
