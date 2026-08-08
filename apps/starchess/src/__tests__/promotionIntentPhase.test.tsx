/**
 * Intent-phase contract: pawn two squares from last rank + gas + classical
 * MUST open PromotionModal (pendingPromotion) before End — never park a
 * marine on 8/1 without a picker.
 */
import { describe, expect, it } from "vitest";
import { render } from "@solidjs/testing-library";
import type { Square } from "chess.js";
import type { JSX } from "solid-js";

import {
  createMatchStore,
  MatchStoreProvider,
} from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import {
  gasStackPromotes,
  moveThenGasPromotes,
  useBoardInput,
} from "~/presentation/board/useBoardInput";
import type { MatchStore } from "~/types/match";

/** White marine on rank 6 — two steps from promotion (gas mid h7 + C → h8). */
const TWO_FROM_PROMO =
  "SCFEN|k7/8/7P/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:";

const intentPhase = (store: MatchStore) => {
  const s = store.state();
  return liveMatchPhase({
    phase: s.phase,
    lastResolve: s.lastResolve,
    timelineActive: s.timeline.active,
    pendingPromotion: !!s.pendingPromotion,
  });
};

const BoardClickHarness = (props: {
  onReady: (api: ReturnType<typeof useBoardInput>) => void;
}): JSX.Element => {
  const input = useBoardInput();
  props.onReady(input);
  return <div data-testid="board-click-harness" />;
};

describe("promotion modal — two squares away (intent phase)", () => {
  it("detects gas-then-move and move-then-gas stacks from rank 6", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(TWO_FROM_PROMO, 1),
    });
    let snap = store.state().liveSnapshot;

    expect(gasStackPromotes(snap, "w", "h6", "h7")).toBe(false);
    expect(moveThenGasPromotes(snap, "w", "h6", "h7")).toBeNull();

    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "h6",
        to: "h7",
      },
    });
    snap = store.state().liveSnapshot;
    expect(gasStackPromotes(snap, "w", "h6", "h7")).toBe(true);

    const moveFirst = createMatchStore({
      initial: createMatchStateFromScfen(TWO_FROM_PROMO, 1),
    });
    moveFirst.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "h6",
        to: "h7",
      },
    });
    expect(
      moveThenGasPromotes(moveFirst.state().liveSnapshot, "w", "h6", "h7"),
    ).toEqual({ seq: expect.any(Number) });
  });

  it("gas-then-move: board click opens pendingPromotion in intent (useBoardInput)", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(TWO_FROM_PROMO, 1),
    });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "h6",
        to: "h7",
      },
    });

    let api: ReturnType<typeof useBoardInput> | undefined;
    render(() => (
      <MatchStoreProvider store={store}>
        <BoardClickHarness
          onReady={(input) => {
            api = input;
          }}
        />
      </MatchStoreProvider>
    ));
    expect(api).toBeDefined();

    api!.onSquareClick("h6" as Square);
    expect(store.state().selected).toBe("h6");
    api!.onSquareClick("h7" as Square);

    expect(store.state().pendingPromotion).toEqual({
      color: "w",
      from: "h6",
      to: "h7",
    });
    expect(store.state().phase).toBe("targeting");
    expect(intentPhase(store)).toBe("intent");
    // Classical not queued until the picker commits.
    expect(
      store.state().liveSnapshot.queue?.actions.some((a) => a.timing === "C"),
    ).toBe(false);

    api!.resolvePromotion("q");
    expect(store.state().pendingPromotion).toBeNull();
    const classical = store
      .state()
      .liveSnapshot.queue?.actions.find((a) => a.timing === "C");
    expect(classical).toMatchObject({
      kind: "classical",
      from: "h6",
      to: "h7",
      promotion: "q",
    });
  });

  it("move-then-gas: convert peels C, queues B, opens pendingPromotion in intent", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(TWO_FROM_PROMO, 1),
    });
    // Classical mid-step first (as if the player clicked h7 before gas).
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
    const seq = store.state().liveSnapshot.queue!.actions[0]!.seq;
    expect(moveThenGasPromotes(store.state().liveSnapshot, "w", "h6", "h7")).toEqual(
      { seq },
    );

    // StarChessScreen pawn gas path when moveThenGasPromotes hits.
    store.dispatch({ type: "REMOVE_ACTION", seq });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "h6",
        to: "h7",
      },
    });
    store.dispatch({
      type: "SET_PENDING_PROMOTION",
      pending: { color: "w", from: "h6", to: "h7" },
    });

    expect(store.state().pendingPromotion).toEqual({
      color: "w",
      from: "h6",
      to: "h7",
    });
    expect(store.state().phase).toBe("targeting");
    expect(intentPhase(store)).toBe("intent");
    expect(
      store.state().liveSnapshot.queue?.actions.map((a) => a.timing),
    ).toEqual(["B"]);

    // Picker commit (StarChessScreen.resolvePromotion).
    store.dispatch({ type: "CLEAR_PENDING_PROMOTION" });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "h6",
        to: "h7",
        promotion: "n",
      },
    });
    store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
    expect(store.state().phase).toBe("resolving");
    expect(store.state().lastResolve?.resolved.promotions).toEqual([
      expect.objectContaining({ at: "h8", unit: "n", color: "w" }),
    ]);
  });

  it("gas-then-move after picker: End promotes on h8 (intent → resolve)", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(TWO_FROM_PROMO, 1),
    });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "h6",
        to: "h7",
      },
    });
    store.dispatch({
      type: "SET_PENDING_PROMOTION",
      pending: { color: "w", from: "h6", to: "h7" },
    });
    expect(intentPhase(store)).toBe("intent");

    store.dispatch({ type: "CLEAR_PENDING_PROMOTION" });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "h6",
        to: "h7",
        promotion: "q",
      },
    });
    store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
    expect(store.state().lastResolve?.resolved.promotions).toEqual([
      expect.objectContaining({ at: "h8", unit: "q", color: "w" }),
    ]);
  });

  it("End while modal is open still defaults to queen (timeout / skip picker)", () => {
    const store = createMatchStore({
      initial: {
        ...createMatchStateFromScfen(TWO_FROM_PROMO, 1),
        turnStartChecksApplied: true,
      },
    });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "h6",
        to: "h7",
      },
    });
    store.dispatch({
      type: "SET_PENDING_PROMOTION",
      pending: { color: "w", from: "h6", to: "h7" },
    });
    expect(intentPhase(store)).toBe("intent");

    store.dispatch({ type: "SUBMIT_TURN", reason: "timeout" });
    expect(store.state().pendingPromotion).toBeNull();
    expect(store.state().lastResolve?.resolved.promotions).toEqual([
      expect.objectContaining({ at: "h8", unit: "q", color: "w" }),
    ]);
  });
});
