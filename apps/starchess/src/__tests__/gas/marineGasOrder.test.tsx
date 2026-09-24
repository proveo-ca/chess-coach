/**
 * Marine gas stack order-independence at the input layer: gas-then-move and
 * move-then-gas (real gas drop + real board clicks) must resolve the same
 * square. Start-rank marines advance 3 (classical double + gas), others 2.
 */
import { render } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { describe, expect, it } from "vitest";

import { placementToMap, type Square } from "@chess-coach/starchess-core";

import { createMatchStateFromScfen } from "~/app/matchReducer";
import { createMatchStore, MatchStoreProvider } from "~/app/MatchStoreContext";
import { useBoardInput } from "~/presentation/board/hooks/useBoardInput";
import { armPieceSpecial } from "~/presentation/specials/pieceSpecials";
import { marineGasArm } from "~/presentation/specials/arms/marineGas";
import type { MatchStore } from "~/types/match";

/** Black Command Center a8, white Command Center e1 — e-file Marine paths stay clear. */
const START_RANK = "SCFEN|k7/8/8/8/8/8/4P3/4K3|1|33|P|G:11:11|Q:w:;b:";
const NON_START = "SCFEN|k7/8/8/8/8/4P3/8/4K3|1|33|P|G:11:11|Q:w:;b:";
/** Enemy Tank on e5 — the start-rank double+gas landing square is blocked. */
const BLOCKED = "SCFEN|k7/8/8/4r3/8/8/4P3/4K3|1|33|P|G:11:11|Q:w:;b:";

const makeStore = (fen: string): MatchStore =>
  createMatchStore({ initial: createMatchStateFromScfen(fen, 1) });

const finalWhiteMarine = (store: MatchStore): Square => {
  const placement = store.state().lastResolve!.next.placement;
  const map = placementToMap(placement);
  const sq = [...map.entries()].find(([, p]) => p.type === "p" && p.color === "w")?.[0];
  if (!sq) throw new Error("no white Marine after resolve");
  return sq;
};

/** Real gas-drop path: drop the canister on `square` via armPieceSpecial. */
const dropGas = (store: MatchStore, square: Square): void => {
  armPieceSpecial(
    store,
    { square, piece: "p" },
    { p: (ctx) => marineGasArm(store, store.state().liveSnapshot, ctx) },
  );
};

const BoardClickHarness = (props: {
  onReady: (api: ReturnType<typeof useBoardInput>) => void;
}): JSX.Element => {
  const input = useBoardInput();
  props.onReady(input);
  return <div data-testid="board-click-harness" />;
};

const clickPath = (store: MatchStore, from: Square, to: Square) => {
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
  api!.onSquareClick(from);
  api!.onSquareClick(to);
  return api!;
};

describe("Marine gas stack — input order independence", () => {
  it("start rank (e2): gas-move and move-gas both land e5 (3 squares)", () => {
    // Gas-then-move: drop gas (B e2→e3), then click the classical double e2→e4.
    const gasMove = makeStore(START_RANK);
    dropGas(gasMove, "e2");
    expect(gasMove.state().liveSnapshot.queue?.actions.map((a) => a.timing)).toEqual(["B"]);
    clickPath(gasMove, "e2", "e4");
    expect(gasMove.state().liveSnapshot.queue?.actions.map((a) => a.timing)).toEqual(["B", "C"]);

    // Move-then-gas: click the classical double e2→e4, then drop gas (F).
    const moveGas = makeStore(START_RANK);
    clickPath(moveGas, "e2", "e4");
    expect(moveGas.state().liveSnapshot.queue?.actions.map((a) => a.timing)).toEqual(["C"]);
    dropGas(moveGas, "e2");
    expect(moveGas.state().liveSnapshot.queue?.actions.map((a) => a.timing)).toEqual(["C", "F"]);

    for (const store of [gasMove, moveGas]) {
      store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
    }
    expect(finalWhiteMarine(gasMove)).toBe("e5");
    expect(finalWhiteMarine(moveGas)).toBe("e5");
    expect(gasMove.state().lastResolve!.next.placement).toBe(
      moveGas.state().lastResolve!.next.placement,
    );
  });

  it("non-start (e3): gas-move and move-gas both land e5 (2 squares)", () => {
    const gasMove = makeStore(NON_START);
    dropGas(gasMove, "e3");
    clickPath(gasMove, "e3", "e4");

    const moveGas = makeStore(NON_START);
    clickPath(moveGas, "e3", "e4");
    dropGas(moveGas, "e3");

    for (const store of [gasMove, moveGas]) {
      store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
    }
    expect(finalWhiteMarine(gasMove)).toBe("e5");
    expect(finalWhiteMarine(moveGas)).toBe("e5");
    expect(gasMove.state().lastResolve!.next.placement).toBe(
      moveGas.state().lastResolve!.next.placement,
    );
  });

  it("blocked landing square (Tank on e5): neither order captures, both fizzle", () => {
    // Gas-then-move: B e2→e3, then the double C e2→e4 — rewritten C e3→e5 is
    // blocked by the Tank, so the marine fizzles on the gas step (e3).
    const gasMove = makeStore(BLOCKED);
    dropGas(gasMove, "e2");
    clickPath(gasMove, "e2", "e4");

    // Move-then-gas: C e2→e4 lands, post-C gas F e4→e5 fizzles (e4).
    const moveGas = makeStore(BLOCKED);
    clickPath(moveGas, "e2", "e4");
    dropGas(moveGas, "e2");

    for (const store of [gasMove, moveGas]) {
      store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
    }
    expect(finalWhiteMarine(gasMove)).toBe("e3");
    expect(finalWhiteMarine(moveGas)).toBe("e4");
    // Neither order captures the blocker.
    expect(gasMove.state().lastResolve!.next.placement).toContain("r");
    expect(moveGas.state().lastResolve!.next.placement).toContain("r");
  });
});
