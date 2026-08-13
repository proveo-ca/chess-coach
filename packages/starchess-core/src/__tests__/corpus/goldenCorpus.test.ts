/**
 * Golden SCFEN corpus — lock Combat Chain / promotion / gas-step / notation
 * contracts in the extracted package (PLAN Phase 1 exit).
 */
import { describe, expect, it } from "vitest";

import {
  AddScActionError,
  addScAction,
  addScMove,
  endScTurn,
  formatScFen,
  parseScFen,
  placementToMap,
  replayScFen,
  scMovesFrom,
  validateScFen,
  validateScFenHistory,
  type ScFenSnapshot,
  type ScMove,
} from "@chess-coach/starchess-core";

const COMBAT_START =
  "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:;b:";

const tos = (moves: ScMove[]) => moves.map((m) => m.to).sort();

describe("golden — SCFEN notation", () => {
  it("round-trips Combat Chain start", () => {
    const snap = parseScFen(COMBAT_START);
    expect(formatScFen(snap)).toBe(COMBAT_START);
  });

  it("rejects missing G: and dual classical on one side", () => {
    expect(validateScFen("SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|Q:w:;b:").ok).toBe(
      false,
    );
    const dual = validateScFen(
      "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:C=d2d4,C=e2e4;b:",
    );
    expect(dual.ok).toBe(false);
    if (!dual.ok) expect(dual.error.code).toBe("SC_QUEUE_SHAPE");
  });
});

describe("golden — Combat Chain resolve", () => {
  it("three classical plies via queues only", () => {
    let snap = parseScFen(COMBAT_START);

    snap = addScMove(snap, { color: "w", from: "d2", to: "d4" });
    snap = addScMove(snap, { color: "b", from: "e8", to: "c6" });
    let r = endScTurn(snap);
    expect(r.next.placement).toBe("5k2/8/2b2n2/4p3/3P4/2R5/8/4K3");
    expect(r.next.turn).toBe(1);

    snap = r.next;
    snap = addScMove(snap, { color: "w", from: "d4", to: "e5" });
    snap = addScMove(snap, { color: "b", from: "f6", to: "e4" });
    r = endScTurn(snap);
    expect(r.next.placement).toBe("5k2/8/2b5/4P3/4n3/2R5/8/4K3");

    snap = r.next;
    snap = addScMove(snap, { color: "w", from: "c3", to: "c6" });
    snap = addScMove(snap, { color: "b", from: "e4", to: "c3" });
    r = endScTurn(snap);
    expect(r.next.placement).toBe("5k2/8/2b5/4P3/8/2n5/8/4K3");
    expect(r.next.turn).toBe(3);
  });

  it("validateScFenHistory accepts Combat Chain built from endScTurn", () => {
    let snap = addScMove(
      addScMove(parseScFen(COMBAT_START), { color: "w", from: "d2", to: "d4" }),
      { color: "b", from: "e8", to: "c6" },
    );
    const s0 = formatScFen(snap);
    const t1 = endScTurn(snap).next;

    snap = addScMove(
      addScMove({ ...t1, queue: { actions: [] } }, { color: "w", from: "d4", to: "e5" }),
      { color: "b", from: "f6", to: "e4" },
    );
    const s1 = formatScFen(snap);
    const t2 = endScTurn(snap).next;

    snap = addScMove(
      addScMove({ ...t2, queue: { actions: [] } }, { color: "w", from: "c3", to: "c6" }),
      { color: "b", from: "e4", to: "c3" },
    );
    const s2 = formatScFen(snap);
    const t3 = endScTurn(snap).next;
    const s3 = formatScFen({ ...t3, queue: { actions: [] } });

    const v = validateScFenHistory(s0, [s1, s2, s3]);
    expect(v.ok).toBe(true);
    expect(v.replay).toBe("ok");
  });

  it("replayScFen folds classical steps", () => {
    const start: ScFenSnapshot = {
      placement: "4bk2/8/5n2/4p3/8/2R5/3P4/4K3",
      turn: 0,
      kingLives: { w: 3, b: 3 },
      phase: "P",
      gas: { w: 1, b: 1 },
      gasIncome: { w: 1, b: 1 },
    };
    const final = replayScFen(start, [
      [
        { timing: "C", kind: "classical", color: "w", from: "d2", to: "d4", seq: 0 },
        { timing: "C", kind: "classical", color: "b", from: "e8", to: "c6", seq: 1 },
      ],
    ]);
    expect(final.placement).toBe("5k2/8/2b2n2/4p3/3P4/2R5/8/4K3");
    expect(final.turn).toBe(1);
  });
});

describe("golden — pawnDouble gas-step events", () => {
  const start = () =>
    parseScFen("SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:");

  it("rejects multi-rank gas step at queue time", () => {
    expect(() =>
      addScAction({
        snapshot: start(),
        action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e4" },
      }),
    ).toThrow(AddScActionError);
  });

  it("B-only emits bMoves and lands pawn one rank up", () => {
    let snap = start();
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    const { next, bMoves } = endScTurn(snap);
    expect(bMoves).toEqual([{ piece: "p", color: "w", from: "e2", to: "e3" }]);
    expect(next.placement).toBe("4k3/8/8/8/8/4P3/8/4K3");
    // Green aura square follows the gas-stepped pawn for the next planning window.
    expect(next.specialsUsed).toEqual(["e3"]);
  });

  it("B+C advances two ranks with gas then classical rewrite", () => {
    let snap = start();
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e2",
        to: "e3",
      },
    }).snapshot;
    const { next, bMoves } = endScTurn(snap);
    expect(bMoves).toEqual([{ piece: "p", color: "w", from: "e2", to: "e3" }]);
    expect(next.placement).toBe("4k3/8/8/8/4P3/8/8/4K3");
    // Glow migrates with B then rewritten classical (e2→e3→e4).
    expect(next.specialsUsed).toEqual(["e4"]);
  });
});

describe("golden — scMoves", () => {
  it("pawn start-rank double and promotion flag", () => {
    expect(tos(scMovesFrom(placementToMap("8/8/8/8/8/8/4P3/4K3"), "e2", "w"))).toEqual([
      "e3",
      "e4",
    ]);
    const promo = scMovesFrom(placementToMap("8/4P3/8/8/8/8/8/4K3"), "e7", "w").find(
      (m) => m.to === "e8",
    );
    expect(promo?.promotes).toBe(true);
  });
});
