import { describe, expect, it } from "vitest";

import {
  adjutant,
  endScTurn,
  parseScFen,
  placementToMap,
} from "../src/index";

describe("adjutant", () => {
  it("stacks pawn gas + classical as two steps ahead (not a lone gas step)", () => {
    // Black pawn on e6 (not start rank — no free classical double). Gas enables
    // e6→e5 (B) + rewrite C → e5→e4. Prefer that over a 1-step classical.
    const snap = parseScFen(
      "SCFEN|4k3/8/4p3/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions ?? [];
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timing: "B",
          kind: "pawnDouble",
          color: "b",
          from: "e6",
          to: "e5",
        }),
        expect.objectContaining({
          timing: "C",
          kind: "classical",
          color: "b",
          from: "e6",
          to: "e5",
        }),
      ]),
    );

    const resolved = endScTurn(plan.snapshot, { skipTurnStartChecks: true });
    const map = placementToMap(resolved.next.placement);
    expect(map.get("e4")).toEqual({ type: "p", color: "b" });
    expect(map.get("e6")).toBeUndefined();
    expect(map.get("e5")).toBeUndefined();
  });

  it("does not spend gas when a free classical double already reaches far", () => {
    // Black pawn on e7 — classical e7→e5 is legal; stack should not win.
    const snap = parseScFen(
      "SCFEN|4k3/4p3/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions ?? [];
    expect(actions.some((a) => a.kind === "pawnDouble")).toBe(false);
  });

  it("stacks Command Center spawn + King classical in the same turn", () => {
    // Open board, minerals for a pawn, gas for spawn. Spawn alone or King stroll
    // alone should lose to doing both (scores add).
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
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
});
