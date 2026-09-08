import { describe, expect, it } from "vitest";

import { endScTurn, parseScFen, placementToMap } from "../../index";
import { strategicAdjutant } from "../../ai/strategic";
import { combineKnownVsSeen } from "../../ai/strategic/intel";

describe("strategicAdjutant orchestrator", () => {
  it("stacks Command Center spawn + King classical in the same turn", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = strategicAdjutant(snap, { storedFor: () => 12 });
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "spawn" && a.timing === "B")).toBe(true);
    expect(
      actions.some(
        (a) => a.timing === "C" && a.kind === "classical" && a.from === "e8",
      ),
    ).toBe(true);
    expect(plan.spendMinerals).toEqual({ color: "b", amount: expect.any(Number) });

    const spawnTo = actions.find((a) => a.kind === "spawn")?.to;
    const kingTo = actions.find((a) => a.timing === "C")?.to;
    expect(spawnTo).toBeTruthy();
    expect(kingTo).toBeTruthy();
    expect(kingTo).not.toBe(spawnTo);

    const resolved = endScTurn(plan.snapshot, { skipTurnStartChecks: true });
    const map = placementToMap(resolved.next.placement);
    expect(map.get(spawnTo!)).toMatchObject({ color: "b" });
    expect(map.get(kingTo!)).toEqual({ type: "k", color: "b" });
    expect(map.get("e8")).toBeUndefined();
  });

  it("returns the snapshot untouched outside the planning phase", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|O|G:11:11|Q:w:;b:",
    );
    expect(strategicAdjutant(snap)).toEqual({ snapshot: snap });
  });

  it("returns the snapshot untouched when our side already queued", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:C=e8d8",
    );
    expect(
      strategicAdjutant(snap, { color: "b" }).snapshot.queue?.actions,
    ).toEqual([expect.objectContaining({ color: "b" })]);
  });

  it("is deterministic for the same input", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const a = strategicAdjutant(snap, { storedFor: () => 12 });
    const b = strategicAdjutant(snap, { storedFor: () => 12 });
    expect(a.snapshot.queue).toEqual(b.snapshot.queue);
    expect(a.spendMinerals).toEqual(b.spendMinerals);
  });

  it("threads the host known-vs-seen accumulator through decisions", () => {
    // Winning + rich → the queen-finish deploy; the exact scatter of the spawn
    // differs from a losing/locked account because the weight table changes.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|10|33|P|G:11:11|Q:w:;b:",
    );
    // Winning (counted 15 > known 12), nothing hidden (gap 0) → ship rush.
    const winning = strategicAdjutant(snap, {
      color: "b",
      storedFor: () => 12,
      kvs: combineKnownVsSeen(12, 27, 15),
    });
    const expected = strategicAdjutant(snap, {
      color: "b",
      storedFor: () => 12,
      kvs: combineKnownVsSeen(12, 27, 15),
    });
    expect(winning).toEqual(expected);

    const spawnsWinning =
      winning.snapshot.queue?.actions.filter((a) => a.kind === "spawn") ?? [];
    expect(spawnsWinning.some((a) => a.unit === "q")).toBe(true);
  });
});