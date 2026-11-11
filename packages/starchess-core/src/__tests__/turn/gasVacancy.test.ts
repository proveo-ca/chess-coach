import { describe, expect, it } from "vitest";

import {
  AddScActionError,
  addScAction,
  classifyClassicalVacancy,
  endScTurn,
  parseScFen,
  placementToMap,
  type ScAction,
  type ScFenSnapshot,
} from "../../index";

const SEED = "4k3/8/8/8/8/8/2PPPP2/4K3";
const CHAIN_SEED = "4k3/8/8/8/8/4P3/2PPPP2/4K3";
const WARP_SEED = "4k3/8/8/8/8/8/8/R2QK3";

const snapOf = (placement: string, gas = "G:11:11", turn = 1): ScFenSnapshot =>
  parseScFen(`SCFEN|${placement}|${turn}|33|P|${gas}|Q:w:;b:`);

const queueB = (
  snap: ScFenSnapshot,
  from: string,
  to: string,
): ScFenSnapshot =>
  addScAction({
    snapshot: snap,
    action: { timing: "B", kind: "stimStep", color: "w", from, to } as never,
  }).snapshot;

describe("gas-phase vacancy", () => {
  it("classical onto a B-vacated origin queues and resolves", () => {
    let snap = queueB(snapOf(SEED), "e2", "e3");
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "e1", to: "e2" } as never,
    }).snapshot;
    const result = endScTurn(snap);
    const map = placementToMap(result.next.placement);
    expect(map.get("e3" as never)).toMatchObject({ type: "p", color: "w" });
    expect(map.get("e2" as never)).toMatchObject({ type: "k", color: "w" });
  });

  it("classical onto a B transit square is rejected", () => {
    const snap = queueB(snapOf(SEED), "e2", "e3");
    expect(() =>
      addScAction({
        snapshot: snap,
        action: { timing: "C", kind: "classical", color: "w", from: "e1", to: "e3" } as never,
      }),
    ).toThrowError(AddScActionError);
  });

  it("classical onto an ally without gas is rejected", () => {
    const snap = snapOf(SEED);
    expect(() =>
      addScAction({
        snapshot: snap,
        action: { timing: "C", kind: "classical", color: "w", from: "e1", to: "e2" } as never,
      }),
    ).toThrowError(AddScActionError);
  });

  it("B chain e2+e3 resolves to e3+e4", () => {
    let snap = snapOf(CHAIN_SEED, "G:22:22", 11);
    snap = queueB(snap, "e3", "e4");
    snap = queueB(snap, "e2", "e3");
    const result = endScTurn(snap);
    const map = placementToMap(result.next.placement);
    expect(map.get("e3" as never)).toMatchObject({ type: "p", color: "w" });
    expect(map.get("e4" as never)).toMatchObject({ type: "p", color: "w" });
    expect(map.has("e2" as never)).toBe(false);
    expect(result.next.specialsUsed).toEqual(["e3", "e4"]);
    expect(result.bMoves).toHaveLength(2);
  });

  it("B chain resolves heads-first regardless of seq order", () => {
    const snap = snapOf(CHAIN_SEED, "G:22:22", 11);
    const mk = (from: string, to: string, seq: number): ScAction =>
      ({ timing: "B", kind: "stimStep", color: "w", from, to, seq }) as ScAction;
    const queued: ScFenSnapshot = {
      ...snap,
      queue: { actions: [mk("e2", "e3", 0), mk("e3", "e4", 1)] },
    };
    const result = endScTurn(queued);
    const map = placementToMap(result.next.placement);
    expect(map.get("e3" as never)).toMatchObject({ type: "p", color: "w" });
    expect(map.get("e4" as never)).toMatchObject({ type: "p", color: "w" });
    expect(map.has("e2" as never)).toBe(false);
  });

  it("blocked B relocate logs its event without moving", () => {
    const snap = snapOf(CHAIN_SEED);
    const queued: ScFenSnapshot = {
      ...snap,
      queue: {
        actions: [
          { timing: "B", kind: "stimStep", color: "w", from: "e2", to: "e3", seq: 0 } as ScAction,
        ],
      },
    };
    const result = endScTurn(queued);
    const map = placementToMap(result.next.placement);
    expect(map.get("e2" as never)).toMatchObject({ type: "p", color: "w" });
    expect(map.get("e3" as never)).toMatchObject({ type: "p", color: "w" });
    expect(result.bMoves).toHaveLength(0);
    const before = result.events.filter((e) => e.phase === "specialBefore");
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ kind: "stimStep", from: "e2", to: "e3" });
  });

  it("move+gas vacates the classical origin for the F step", () => {
    let snap = snapOf(SEED);
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "e2", to: "e3" } as never,
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "stimStep", color: "w", from: "e2", to: "e3" } as never,
    }).snapshot;
    const result = endScTurn(snap);
    const map = placementToMap(result.next.placement);
    expect(map.get("e4" as never)).toMatchObject({ type: "p", color: "w" });
    expect(map.has("e2" as never)).toBe(false);
  });

  it("non-vacating specials never free their origin", () => {
    const v = classifyClassicalVacancy(
      [
        { timing: "B", kind: "spiderMine", color: "w", from: "g1", seq: 0 },
        { timing: "B", kind: "siegeMode", color: "w", from: "a1", seq: 1 },
        { timing: "B", kind: "charonMissiles", color: "w", from: "c1", to: "h6", seq: 2 },
      ] as unknown as ScAction[],
      "w",
    );
    expect(v.bOrigins.size).toBe(0);
    expect(v.transit.size).toBe(0);
  });

  it("battleship warp frees its origin but never its destination", () => {
    let snap = snapOf(WARP_SEED, "G:33:33", 21);
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "tacticalJump", color: "w", from: "d1", to: "h5" } as never,
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "a1", to: "d1" } as never,
    }).snapshot;
    const result = endScTurn(snap);
    const map = placementToMap(result.next.placement);
    expect(map.get("d1" as never)).toMatchObject({ type: "r", color: "w" });
    expect(map.get("h5" as never)).toMatchObject({ type: "q", color: "w" });
    expect(() =>
      addScAction({
        snapshot: snapOf(WARP_SEED, "G:33:33", 21),
        action: { timing: "B", kind: "tacticalJump", color: "w", from: "d1", to: "e1" } as never,
      }),
    ).toThrowError(AddScActionError);
  });
});
