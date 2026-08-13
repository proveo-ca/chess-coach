/**
 * Coverage for `useBoardInput` branches that were previously untested at the
 * app level: spawn targeting (adjacent/refund/timing-F), bishop snipe, queen
 * warp, the selection state machine, phase/pending-promotion guards, and
 * `resolvePromotion` via-gas / `cancelPromotion`.
 */
import { render } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { describe, expect, it } from "vitest";

import { createMatchStateFromScfen } from "~/app/matchReducer";
import { createMatchStore, MatchStoreProvider } from "~/app/MatchStoreContext";
import { useBoardInput } from "~/presentation/board/hooks/useBoardInput";
import type { MatchStore } from "~/types/match";

/** Black king a8 + white king e1 — no checks, no blocked e-file. */
const PAWN_BOARD = "k7/8/8/8/8/8/4P3/4K3";
/** White king e4 with an open ring for spawn adjacency. */
const SPAWN_BOARD = "k7/8/8/8/4K3/8/8/8";
/** White bishop b2 → black queen g7 on the same diagonal (unique Charon). */
const SNIPE_BOARD = "k7/6q/8/8/8/8/1B6/4K3";
/** White queen e4 with empty warp destinations e5/d5. */
const WARP_BOARD = "k7/8/8/8/4Q3/8/8/4K3";
/** White pawn e7 for gas promotion via-rank. */
const GAS_PROMO_BOARD = "k7/4P3/8/8/8/8/8/4K3";

const makeStore = (fen: string, stored = 12, gas = "11", turn = 1): MatchStore =>
  createMatchStore({
    initial: createMatchStateFromScfen(`SCFEN|${fen}|${turn}|33|P|G:${gas}:${gas}|Q:w:;b:`, stored),
  });

const BoardClickHarness = (props: {
  onReady: (api: ReturnType<typeof useBoardInput>) => void;
}): JSX.Element => {
  const input = useBoardInput();
  props.onReady(input);
  return <div data-testid="board-click-harness" />;
};

const mountInput = (store: MatchStore): ReturnType<typeof useBoardInput> => {
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
  if (!api) throw new Error("board click harness did not mount");
  return api;
};

const queued = (store: MatchStore) => store.state().liveSnapshot.queue?.actions ?? [];

describe("useBoardInput — spawn targeting", () => {
  it("queues a B spawn on an adjacent square, spends material, marks king", () => {
    const store = makeStore(SPAWN_BOARD);
    store.dispatch({ type: "OPEN_SPAWN", unit: "p", color: "w" });
    expect(store.state().targeting).toEqual({ kind: "spawn", unit: "p", color: "w" });
    const stored = store.state().economies.w.stored;

    mountInput(store).onSquareClick("e5");

    expect(queued(store)).toEqual([
      expect.objectContaining({
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "e4",
        to: "e5",
        unit: "p",
      }),
    ]);
    expect(store.state().economies.w.stored).toBe(stored - 1);
    expect(store.state().specialsUsed.has("e4")).toBe(true);
    expect(store.state().targeting).toBeNull();
  });

  it("ignores non-adjacent clicks (targeting stays, nothing spent)", () => {
    const store = makeStore(SPAWN_BOARD);
    store.dispatch({ type: "OPEN_SPAWN", unit: "p", color: "w" });
    const stored = store.state().economies.w.stored;

    mountInput(store).onSquareClick("a4");

    expect(queued(store)).toEqual([]);
    expect(store.state().economies.w.stored).toBe(stored);
    expect(store.state().targeting).toEqual({ kind: "spawn", unit: "p", color: "w" });
  });

  it("insufficient material: no spawn, no refund drift", () => {
    const store = makeStore(SPAWN_BOARD, 0);
    store.dispatch({ type: "OPEN_SPAWN", unit: "p", color: "w" });

    mountInput(store).onSquareClick("e5");

    expect(queued(store)).toEqual([]);
    expect(store.state().economies.w.stored).toBe(0);
    expect(store.state().targeting).toEqual({ kind: "spawn", unit: "p", color: "w" });
  });

  it("queues an F spawn when the same color already has a C queued", () => {
    const store = makeStore("k7/8/8/8/4K3/8/4P3/8");
    store.dispatch({
      type: "QUEUE_ACTION",
      action: { timing: "C", kind: "classical", color: "w", from: "e2", to: "e3" },
    });
    store.dispatch({ type: "OPEN_SPAWN", unit: "p", color: "w" });

    mountInput(store).onSquareClick("e5");

    expect(queued(store).map((a) => a.timing)).toEqual(["C", "F"]);
    expect(queued(store)[1]).toMatchObject({ kind: "spawn", from: "e4", to: "e5" });
  });
});

describe("useBoardInput — bishop snipe targeting", () => {
  it("queues B Charon on the exact queen square and marks the bishop", () => {
    const store = makeStore(SNIPE_BOARD, 12, "22", 11);
    store.dispatch({ type: "OPEN_BISHOP_SNIPE", from: "b2", to: "g7", color: "w" });
    expect(store.state().phase).toBe("targeting");

    mountInput(store).onSquareClick("g7");

    expect(queued(store)).toEqual([
      expect.objectContaining({
        timing: "B",
        kind: "bishopSnipe",
        color: "w",
        from: "b2",
        to: "g7",
      }),
    ]);
    expect(store.state().specialsUsed.has("b2")).toBe(true);
  });

  it("ignores clicks on non-target squares", () => {
    const store = makeStore(SNIPE_BOARD, 12, "22", 11);
    store.dispatch({ type: "OPEN_BISHOP_SNIPE", from: "b2", to: "g7", color: "w" });

    mountInput(store).onSquareClick("h7");

    expect(queued(store)).toEqual([]);
    expect(store.state().specialsUsed.size).toBe(0);
  });
});

describe("useBoardInput — queen warp targeting", () => {
  it("queues B Tactical Jump on a valid destination and marks the queen", () => {
    const store = makeStore(WARP_BOARD, 12, "33", 21);
    store.dispatch({
      type: "OPEN_QUEEN_WARP",
      from: "e4",
      targets: ["e5", "d5"],
      color: "w",
    });

    mountInput(store).onSquareClick("e5");

    expect(queued(store)).toEqual([
      expect.objectContaining({ timing: "B", kind: "queenWarp", color: "w", from: "e4", to: "e5" }),
    ]);
    expect(store.state().specialsUsed.has("e4")).toBe(true);
  });

  it("ignores clicks outside the warp targets", () => {
    const store = makeStore(WARP_BOARD, 12, "33", 21);
    store.dispatch({
      type: "OPEN_QUEEN_WARP",
      from: "e4",
      targets: ["e5", "d5"],
      color: "w",
    });

    mountInput(store).onSquareClick("e6");

    expect(queued(store)).toEqual([]);
    expect(store.state().specialsUsed.size).toBe(0);
  });
});

describe("useBoardInput — selection state machine", () => {
  it("selects an own piece and shows its legal destinations", () => {
    const store = makeStore(PAWN_BOARD);
    mountInput(store).onSquareClick("e2");
    expect(store.state().selected).toBe("e2");
    // Player fog: pawn front-diagonals stay attack intents without a visible victim.
    expect([...store.state().legalDests].sort()).toEqual(["d3", "e3", "e4", "f3"]);
  });

  it("clicking an empty square with no selection stays unselected", () => {
    const store = makeStore(PAWN_BOARD);
    mountInput(store).onSquareClick("c4");
    expect(store.state().selected).toBeNull();
    expect(store.state().legalDests).toEqual([]);
  });

  it("clicking the selected square again clears the selection", () => {
    const store = makeStore(PAWN_BOARD);
    const api = mountInput(store);
    api.onSquareClick("e2");
    api.onSquareClick("e2");
    expect(store.state().selected).toBeNull();
    expect(store.state().legalDests).toEqual([]);
  });

  it("clicking a legal destination queues the classical move", () => {
    const store = makeStore(PAWN_BOARD);
    const api = mountInput(store);
    api.onSquareClick("e2");
    api.onSquareClick("e4");
    expect(queued(store)).toEqual([
      expect.objectContaining({ timing: "C", kind: "classical", color: "w", from: "e2", to: "e4" }),
    ]);
  });

  it("clicking an own piece that cannot move there re-selects that piece", () => {
    const store = makeStore(PAWN_BOARD);
    const api = mountInput(store);
    api.onSquareClick("e2");
    api.onSquareClick("e1");
    expect(store.state().selected).toBe("e1");
    expect([...store.state().legalDests].sort()).toEqual(["d1", "d2", "f1", "f2"]);
  });

  it("clicking an illegal empty square clears the selection", () => {
    const store = makeStore(PAWN_BOARD);
    const api = mountInput(store);
    api.onSquareClick("e2");
    api.onSquareClick("c4");
    expect(store.state().selected).toBeNull();
    expect(store.state().legalDests).toEqual([]);
  });
});

describe("useBoardInput — guards", () => {
  it("ignores clicks outside the planning/targeting phases", () => {
    const store = makeStore(PAWN_BOARD);
    store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
    expect(store.state().phase).toBe("resolving");

    mountInput(store).onSquareClick("e2");

    expect(store.state().selected).toBeNull();
    expect(queued(store)).toEqual([]);
  });

  it("ignores clicks while the promotion picker is open", () => {
    const store = makeStore(PAWN_BOARD);
    store.dispatch({
      type: "SET_PENDING_PROMOTION",
      pending: { color: "w", from: "e7", to: "e8" },
    });

    mountInput(store).onSquareClick("e2");

    expect(store.state().selected).toBeNull();
    expect(queued(store)).toEqual([]);
  });
});

describe("useBoardInput — resolvePromotion / cancelPromotion", () => {
  it("via=gas queues the B pawnDouble with the chosen promotion and marks used", () => {
    const store = makeStore(GAS_PROMO_BOARD);
    store.dispatch({
      type: "SET_PENDING_PROMOTION",
      pending: { color: "w", from: "e7", to: "e8", via: "gas" },
    });

    mountInput(store).resolvePromotion("q");

    expect(store.state().pendingPromotion).toBeNull();
    expect(queued(store)).toEqual([
      expect.objectContaining({
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      }),
    ]);
    expect(store.state().specialsUsed.has("e7")).toBe(true);
  });

  it("cancelPromotion clears the pending promotion without queueing", () => {
    const store = makeStore(PAWN_BOARD);
    store.dispatch({
      type: "SET_PENDING_PROMOTION",
      pending: { color: "w", from: "e7", to: "e8" },
    });

    mountInput(store).cancelPromotion();

    expect(store.state().pendingPromotion).toBeNull();
    expect(queued(store)).toEqual([]);
  });
});
