/**
 * Last-rank promotion, classical pass: a Marine promotes only with a chosen unit.
 * Gas routes onto the last rank live in `gas/gasLastRank.test.ts`; mine contact
 * lives in `mine/`.
 */
import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  parseScFen,
  placementToMap,
} from "@chess-coach/starchess-core";

describe("last-rank promotion (classical)", () => {
  it("clean last-rank move promotes after landing as a Marine", () => {
    const start = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    const queued = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    }).snapshot;
    const r = endScTurn(queued);
    expect(r.resolved.moves).toEqual([
      { piece: "p", color: "w", from: "e7", to: "e8" },
    ]);
    expect(r.resolved.promotions).toEqual([
      { color: "w", from: "e7", at: "e8", unit: "q" },
    ]);
    expect(placementToMap(r.next.placement).get("e8")).toEqual({
      type: "q",
      color: "w",
    });
  });



  /**
   * Diagonal capture onto the last rank. The quiet push above kept its
   * promotion because the resolver forwarded the plan by reference; the capture
   * bucket used to rebuild the plan literal and drop the choice, so the marine
   * took the piece and stayed a marine.
   */
  it("capturing onto the last rank promotes too", () => {
    const start = parseScFen(
      "SCFEN|k4r2/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    const queued = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "f8",
        promotion: "q",
      },
    }).snapshot;
    const r = endScTurn(queued);
    expect(r.resolved.promotions).toEqual([
      { color: "w", from: "e7", at: "f8", unit: "q" },
    ]);
    expect(placementToMap(r.next.placement).get("f8")).toEqual({
      type: "q",
      color: "w",
    });
  });

  it("honours a tank choice on a quiet last-rank step", () => {
    const start = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    const queued = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "r",
      },
    }).snapshot;
    const r = endScTurn(queued);
    expect(r.resolved.promotions).toEqual([
      { color: "w", from: "e7", at: "e8", unit: "r" },
    ]);
    expect(placementToMap(r.next.placement).get("e8")).toEqual({
      type: "r",
      color: "w",
    });
  });

  it("honours a non-BattleShip choice on a last-rank capture", () => {
    const start = parseScFen(
      "SCFEN|k4r2/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    const queued = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "f8",
        promotion: "n",
      },
    }).snapshot;
    const r = endScTurn(queued);
    expect(placementToMap(r.next.placement).get("f8")).toEqual({
      type: "n",
      color: "w",
    });
  });

  it("rejects classical last-rank without a promotion choice", () => {
    const snap = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(() =>
      addScAction({
        snapshot: snap,
        action: {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "e7",
          to: "e8",
        },
      }),
    ).toThrow(/promotion/i);
  });

  it("rejects a last-rank capture without a promotion choice", () => {
    const snap = parseScFen(
      "SCFEN|k4r2/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(() =>
      addScAction({
        snapshot: snap,
        action: {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "e7",
          to: "f8",
        },
      }),
    ).toThrow(/promotion/i);
  });
});
