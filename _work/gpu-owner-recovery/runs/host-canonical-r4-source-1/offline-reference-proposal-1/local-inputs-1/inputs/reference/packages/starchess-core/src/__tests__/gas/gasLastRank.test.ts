import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  parseScFen,
  placementToMap,
} from "../../index";

describe("gas + last-rank promotion contract", () => {
  it("rejects move-then-gas (F) that would park a Marine on the last rank", () => {
    let snap = parseScFen(
      "SCFEN|k7/8/4P3/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e6",
        to: "e7",
      },
    }).snapshot;
    expect(() =>
      addScAction({
        snapshot: snap,
        action: {
          timing: "F",
          kind: "stimStep",
          color: "w",
          from: "e6",
          to: "e7",
        },
      }),
    ).toThrow(/last rank|promotion/i);
  });

  it("rejects B+C rewrite onto last rank without a promotion choice", () => {
    let snap = parseScFen(
      "SCFEN|k7/8/4P3/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "stimStep",
        color: "w",
        from: "e6",
        to: "e7",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e6",
        to: "e7",
      },
    }).snapshot;
    expect(() => endScTurn(snap)).toThrow(/promotion/i);
  });

  it("B+C with promotion rewrites and deploys", () => {
    let snap = parseScFen(
      "SCFEN|k7/8/4P3/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "stimStep",
        color: "w",
        from: "e6",
        to: "e7",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e6",
        to: "e7",
        promotion: "q",
      },
    }).snapshot;
    const r = endScTurn(snap);
    expect(r.resolved.promotions).toEqual([
      expect.objectContaining({ at: "e8", unit: "q", color: "w" }),
    ]);
    expect(placementToMap(r.next.placement).get("e8")).toEqual({
      type: "q",
      color: "w",
    });
    // The deployed unit is not a spent special — U: never stamps the landing.
    expect(r.next.specialsUsed ?? []).not.toContain("e8");
  });

  it("rejects gas-only (B) onto the last rank without a promotion choice", () => {
    const snap = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(() =>
      addScAction({
        snapshot: snap,
        action: {
          timing: "B",
          kind: "stimStep",
          color: "w",
          from: "e7",
          to: "e8",
        },
      }),
    ).toThrow(/promotion|last rank/i);
  });

  it("gas-only from approach rank promotes with picker choice", () => {
    let snap = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "stimStep",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "n",
      },
    }).snapshot;
    const r = endScTurn(snap);
    expect(r.bMoves).toEqual([
      expect.objectContaining({ from: "e7", to: "e8", piece: "p" }),
    ]);
    expect(r.resolved.promotions).toEqual([
      expect.objectContaining({ at: "e8", unit: "n", color: "w" }),
    ]);
    expect(placementToMap(r.next.placement).get("e8")).toEqual({
      type: "n",
      color: "w",
    });
    // The deployed unit is not a spent special — U: never stamps the landing.
    expect(r.next.specialsUsed ?? []).not.toContain("e8");
  });

  it("gas-only tank choice deploys a tank, not a battleship", () => {
    let snap = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "stimStep",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "r",
      },
    }).snapshot;
    const r = endScTurn(snap);
    expect(r.resolved.promotions).toEqual([
      expect.objectContaining({ at: "e8", unit: "r", color: "w" }),
    ]);
    expect(placementToMap(r.next.placement).get("e8")).toEqual({
      type: "r",
      color: "w",
    });
  });

  it("B+C tank choice rewrites onto the last rank as a tank", () => {
    let snap = parseScFen(
      "SCFEN|k7/8/4P3/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "stimStep",
        color: "w",
        from: "e6",
        to: "e7",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e6",
        to: "e7",
        promotion: "r",
      },
    }).snapshot;
    const r = endScTurn(snap);
    expect(r.resolved.promotions).toEqual([
      expect.objectContaining({ at: "e8", unit: "r", color: "w" }),
    ]);
    expect(placementToMap(r.next.placement).get("e8")).toEqual({
      type: "r",
      color: "w",
    });
  });

});
