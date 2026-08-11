import { describe, expect, it } from "vitest";
import {
  addScAction,
  endScTurn,
  parseScFen,
  type EndScTurnResult,
} from "@chess-coach/starchess-core";

import {
  OPENING_STORED_MATERIAL,
  canPawnDoubleFree,
  classicFenForViewer,
  currentQueue,
  deployedMaterial,
  energyCapacity,
  energyRemaining,
  estimateStoredFromSnap,
  hasUsedSpecialThisTurn,
  materialIncome,
  maxDeployedSupply,
  reconstructStoredBanks,
  spawnSpendFromResolve,
  storedMaterial,
  turnDeadlineAt,
  turnSecondsRemaining,
  viewerColor,
} from "~/app/matchEconomy";
import { createMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";

describe("matchEconomy integration", () => {
  it("estimateStoredFromSnap caps opening + income", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|3|33|P|G:11:11|Q:w:;b:",
    );
    const v = estimateStoredFromSnap(snap);
    expect(v).toBeGreaterThanOrEqual(OPENING_STORED_MATERIAL);
    expect(v).toBeLessThanOrEqual(99);
  });

  it("reconstructStoredBanks fills missing B: and respects existing", () => {
    const a = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:",
    );
    const b = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3P4/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    const out = reconstructStoredBanks([a, b]);
    expect(out).toHaveLength(2);
    expect(out[0]!.stored).toEqual({ w: 3, b: 3 });
    expect(out[1]!.stored).toBeTruthy();
    expect(reconstructStoredBanks([])).toEqual([]);
  });

  it("spawnSpendFromResolve and store selectors", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|B:9:9|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "d1",
        unit: "n",
      },
    }).snapshot;
    const result = endScTurn(snap) as EndScTurnResult;
    expect(spawnSpendFromResolve(snap, result, "w")).toBeGreaterThanOrEqual(0);

    const store = createMatchStore({
      initial: createMatchStateFromScfen(
        "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:11:11|Q:w:;b:",
        5,
      ),
    });
    expect(viewerColor(store)).toBe("w");
    expect(storedMaterial(store)).toBe(5);
    expect(materialIncome(store)).toBeGreaterThan(0);
    expect(energyCapacity(store)).toBeGreaterThan(0);
    expect(energyRemaining(store)).toBeGreaterThanOrEqual(0);
    expect(maxDeployedSupply).toBeGreaterThan(0);
    expect(deployedMaterial(store)).toBeGreaterThan(0);
    expect(hasUsedSpecialThisTurn(store, "e2")).toBe(false);
    expect(classicFenForViewer(store)).toContain("K");
    expect(canPawnDoubleFree(store, "e2")).toBeTypeOf("boolean");
    expect(currentQueue(store)).toEqual([]);
    expect(turnDeadlineAt(store)).toBeNull();
    expect(turnSecondsRemaining(store, Date.now())).toBe(0);
    store.dispatch({ type: "SET_DEADLINE", at: Date.now() + 5000 });
    expect(turnSecondsRemaining(store, Date.now())).toBeGreaterThan(0);
  });

  it("reconstruct prefers snap.stored when present mid-history", () => {
    const a = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const b = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:11:11|B:7:4|Q:w:;b:",
    );
    const out = reconstructStoredBanks([a, b], 3);
    expect(out[1]!.stored).toEqual({ w: 7, b: 4 });
  });
});
