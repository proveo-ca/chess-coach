import { describe, expect, it } from "vitest";
import { parseScFen, addScAction, type ScAction } from "@chess-coach/starchess-core";

import { gasRemainingFor } from "~/app/matchEconomy";

describe("gasRemainingFor", () => {
  it("reads snap.gas after queue spends (same as GasDeploy)", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    expect(gasRemainingFor(snap, "w")).toBe(2);
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    expect(snap.gas.w).toBe(1);
    expect(gasRemainingFor(snap, "w")).toBe(1);
  });

  it("debits DualNav overlay specials that are not on the snap queue", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    const overlay: ScAction[] = [
      {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "e2",
        to: "e3",
        seq: 0,
      },
    ];
    expect(gasRemainingFor(snap, "w", overlay)).toBe(1);
    expect(gasRemainingFor(snap, "b", overlay)).toBe(2);
  });

  it("does not double-debit overlays already present on snap.queue", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    const overlay = snap.queue?.actions ?? [];
    expect(gasRemainingFor(snap, "w", overlay)).toBe(1);
  });
});
