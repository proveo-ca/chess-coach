import { describe, expect, it } from "vitest";

import { marineGasArm } from "~/presentation/specials/arms/marineGas";
import { specialTimingFor, tryQueue } from "~/presentation/specials/queue";
import { createMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";

describe("marineGasArm", () => {
  it("specialTimingFor switches B→F after classical", () => {
    expect(specialTimingFor(undefined, "w")).toBe("B");
    expect(specialTimingFor({ actions: [] }, "w")).toBe("B");
    expect(
      specialTimingFor(
        {
          actions: [
            {
              timing: "C",
              kind: "classical",
              color: "w",
              from: "e2",
              to: "e4",
              seq: 0,
            },
          ],
        },
        "w",
      ),
    ).toBe("F");
  });

  it("tryQueue and marineGasArm happy path", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(
        "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
        3,
      ),
    });
    expect(
      tryQueue(
        store,
        { timing: "B", kind: "stimStep", color: "w", from: "e2", to: "e3" },
        "ok",
      ),
    ).toBe(true);
    expect(store.state().statusText).toBe("ok");
    const store2 = createMatchStore({
      initial: createMatchStateFromScfen(
        "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
        3,
      ),
    });
    expect(
      marineGasArm(store2, store2.state().liveSnapshot, {
        square: "e2",
        piece: "p",
      }),
    ).toBe("armed");
  });

  it("last-rank gas opens pending promotion", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(
        "SCFEN|k7/4P3/8/8/8/8/8/4K3|11|33|P|G:22:22|Q:w:;b:",
        3,
      ),
    });
    expect(
      marineGasArm(store, store.state().liveSnapshot, {
        square: "e7",
        piece: "p",
      }),
    ).toBe("pending");
    expect(store.state().pendingPromotion?.via).toBe("gas");
  });

  it("off-board step rejects", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(
        "SCFEN|4k3/8/8/8/8/8/8/4K3|11|33|P|G:22:22|Q:w:;b:",
        3,
      ),
    });
    // no Marine — use a1 as nonsense
    expect(
      marineGasArm(store, store.state().liveSnapshot, {
        square: "a8",
        piece: "p",
      }),
    ).toBe(false);
  });

  it("arms a special before and after the same classical (B → C → F)", () => {
    // Nb4, Re4, Pe2 — two 1-gas specials fit in G:22.
    const store = createMatchStore({
      initial: createMatchStateFromScfen(
        "SCFEN|4k3/8/8/8/1N2R3/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
        3,
      ),
    });
    const timing = () => specialTimingFor(store.state().liveSnapshot.queue, "w");
    expect(timing()).toBe("B");
    expect(
      tryQueue(
        store,
        { timing: timing(), kind: "spiderMine", color: "w", from: "b4", to: "b4" },
        "mine",
      ),
    ).toBe(true);
    store.dispatch({
      type: "QUEUE_ACTION",
      action: { timing: "C", kind: "classical", color: "w", from: "e2", to: "e3" },
    });
    expect(timing()).toBe("F");
    expect(
      tryQueue(
        store,
        { timing: timing(), kind: "siegeMode", color: "w", from: "e4" },
        "siege",
      ),
    ).toBe(true);
    expect(
      store.state().liveSnapshot.queue?.actions.map((a) => a.timing),
    ).toEqual(["B", "C", "F"]);
  });

  it("move-then-gas convert peels C and arms B + promotion", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(
        "SCFEN|k7/8/7P/8/8/8/8/4K3|11|33|P|G:22:22|Q:w:;b:",
        3,
      ),
    });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "h6",
        to: "h7",
      },
    });
    const snap = store.state().liveSnapshot;
    expect(
      marineGasArm(store, snap, { square: "h6", piece: "p" }),
    ).toBe("armed");
    expect(store.state().pendingPromotion).toBeTruthy();
  });
});
