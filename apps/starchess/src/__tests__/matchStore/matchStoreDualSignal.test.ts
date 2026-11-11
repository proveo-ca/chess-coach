import { describe, expect, it } from "vitest";

import { createMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";

const SCFEN = "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:";

describe("createMatchStore dual-signal", () => {
  it("exposes shell and timeline readers", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(SCFEN, 1),
      autoArmTimer: false,
    });
    expect(store.shell().phase).toBe("planning");
    expect(store.timeline().active).toBe(false);
    expect(store.state().timeline).toBe(store.timeline());
    expect(store.state().phase).toBe(store.shell().phase);
  });

  it("TIMELINE_COMMIT overlay-only keeps shell object identity", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(SCFEN, 1),
      autoArmTimer: false,
    });
    store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
    const result = store.state().lastResolve!;
    store.dispatch({
      type: "TIMELINE_START",
      cues: [
        {
          id: "m1",
          kind: "move",
          piece: "p",
          color: "w",
          from: "e2",
          to: "e4",
        },
      ],
      placement: result.afterPending.placement,
    });
    // START may touch phase → new shell; capture after start
    const shellAfterStart = store.shell();
    const tlAfterStart = store.timeline();

    store.dispatch({
      type: "TIMELINE_COMMIT",
      playingIds: ["m1"],
      moveProgress: { m1: 0 },
      hidden: ["e2"],
    });
    expect(store.shell()).toBe(shellAfterStart);
    expect(store.shell().phase).toBe(shellAfterStart.phase);
    expect(store.timeline()).not.toBe(tlAfterStart);
    expect(store.timeline().playingIds).toEqual(["m1"]);
    expect(store.timeline().moveProgress).toEqual({ m1: 0 });
  });

  it("shell-only actions keep timeline object identity", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(SCFEN, 1),
      autoArmTimer: false,
    });
    const tl0 = store.timeline();
    store.dispatch({ type: "SELECT_SQUARE", square: "e2" });
    expect(store.timeline()).toBe(tl0);
    expect(store.shell().selected).toBe("e2");
  });
});
