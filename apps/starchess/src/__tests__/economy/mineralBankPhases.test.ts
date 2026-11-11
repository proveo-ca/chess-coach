/**
 * Integration: mineral bank through intent → resolve → income turns.
 * Mecha (3) then later marine (1); bank must not snap back during resolve.
 */
import { describe, expect, it } from "vitest";
import {
  UNIT_COST,
  addScAction,
  parseScFen,
} from "@chess-coach/starchess-core";

import { createMatchStateFromScfen } from "~/app/matchReducer";
import {
  OPENING_STORED_MATERIAL,
  displayedStoredMaterial,
} from "~/app/matchEconomy";
import { createMatchStore } from "~/app/MatchStoreContext";
import { buildReviewHistory } from "~/app/reviewHistory";
import { displayedSnapshot } from "~/app/selectors";
import { isCheckOnlyResolve } from "~/presentation/hud/isCheckOnlyResolve";
import type { MatchStore } from "~/types/match";
import { STAR_STARTING_SCFEN } from "~/app/seeds";

const bank = (store: MatchStore, color: "w" | "b" = "w") =>
  displayedStoredMaterial(store, color, displayedSnapshot(store.state()));

const endResolve = (store: MatchStore) => {
  store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
  const result = store.state().lastResolve;
  expect(result).not.toBeNull();
  store.dispatch({
    type: "TIMELINE_START",
    cues: [],
    placement: result!.next.placement,
  });
  store.dispatch({ type: "TIMELINE_DONE" });
};

describe("mineral bank across phases", () => {
  it("Mecha spend stays 0 through resolve; income then marine spend", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(STAR_STARTING_SCFEN, OPENING_STORED_MATERIAL),
      autoArmTimer: false,
    });

    expect(bank(store)).toBe(3);
    expect(store.state().economies.w.stored).toBe(3);
    expect(displayedSnapshot(store.state()).stored?.w).toBe(3);

    const costB = UNIT_COST.b;
    expect(costB).toBe(3);
    store.dispatch({ type: "SPEND_STORED", color: "w", amount: costB });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "B",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "d1",
        unit: "b",
      },
    });

    expect(store.state().phase).toBe("planning");
    expect(bank(store)).toBe(0);
    expect(store.state().economies.w.stored).toBe(0);
    expect(displayedSnapshot(store.state()).stored?.w).toBe(0);

    // Resolve carries intent bank (0) — not opening 3.
    store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
    expect(store.state().phase).toBe("resolving");
    expect(bank(store)).toBe(0);
    expect(store.state().economies.w.stored).toBe(0);

    store.dispatch({
      type: "TIMELINE_START",
      cues: [],
      placement: store.state().lastResolve!.next.placement,
    });
    expect(store.state().phase).toBe("resolving");
    expect(bank(store)).toBe(0);

    store.dispatch({ type: "TIMELINE_DONE" });
    expect(store.state().phase).toBe("planning");
    expect(bank(store)).toBe(1);
    expect(store.state().economies.w.stored).toBe(1);
    expect(displayedSnapshot(store.state()).stored?.w).toBe(1);

    const turnAfterMecha = store.state().liveSnapshot.turn;
    endResolve(store);
    const turnAfterIdle = store.state().liveSnapshot.turn;
    if (turnAfterIdle > turnAfterMecha) {
      expect(bank(store)).toBe(2);
    } else {
      expect(bank(store)).toBe(1);
    }

    while (bank(store) < 2 && store.state().phase === "planning") {
      const t0 = store.state().liveSnapshot.turn;
      endResolve(store);
      if (store.state().liveSnapshot.turn <= t0) break;
    }
    expect(bank(store)).toBeGreaterThanOrEqual(2);
    if (bank(store) > 2) {
      store.dispatch({
        type: "SPEND_STORED",
        color: "w",
        amount: bank(store) - 2,
      });
    }
    expect(bank(store)).toBe(2);

    store.dispatch({ type: "SPEND_STORED", color: "w", amount: UNIT_COST.p });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "B",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "f1",
        unit: "p",
      },
    });
    expect(bank(store)).toBe(1);
    expect(displayedSnapshot(store.state()).stored?.w).toBe(1);

    store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
    expect(store.state().phase).toBe("resolving");
    expect(bank(store)).toBe(1);

    store.dispatch({
      type: "TIMELINE_START",
      cues: [],
      placement: store.state().lastResolve!.next.placement,
    });
    expect(bank(store)).toBe(1);
  });

  it("DualNav intent+resolve carry post-spawn bank (spawn-only is not check-only)", () => {
    const start = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:",
    );
    const history = buildReviewHistory({
      start,
      steps: [{ caption: "deploy Mecha" }],
      startCaption: "start",
      includeTurnOpenChecks: false,
      queueStep: (snap) =>
        addScAction({
          snapshot: snap,
          action: {
            timing: "B",
            kind: "deploy",
            color: "w",
            from: "e1",
            to: "d1",
            unit: "b",
          },
        }).snapshot,
    });

    expect(history.settledResolves).toHaveLength(1);
    expect(isCheckOnlyResolve(history.settledResolves[0]!)).toBe(false);

    // Start snap B:3; after End bank is 0+income=1.
    expect(history.settledSnapshots[0]!.stored?.w).toBe(3);
    expect(history.settledSnapshots[1]!.stored?.w).toBe(1);

    const base = createMatchStateFromScfen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|O|G:11:11|B:1:4|Q:w:;b:",
      1,
    );
    const store = createMatchStore({
      initial: {
        ...base,
        phase: "gameOver",
        outcome: { winner: "w" },
        economies: {
          w: { stored: 1, deployed: 3 },
          b: { stored: 4, deployed: 0 },
        },
        settledSnapshots: history.settledSnapshots,
        settledResolves: history.settledResolves,
        reviewIndex: 0,
      },
      autoArmTimer: false,
    });

    // Start phase — opening bank on cursor snap.
    store.reviewSetPhase("start");
    expect(bank(store)).toBe(3);

    // Intent + resolve both preview the spend (3 − 3 = 0). Income lands after.
    store.reviewSetPhase("intent");
    expect(bank(store)).toBe(0);

    store.reviewSetPhase("resolve");
    expect(bank(store)).toBe(0);
  });
});
