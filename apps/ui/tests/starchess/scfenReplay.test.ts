import { describe, expect, it } from "vitest";

import { addScAction, addScMove } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import {
  formatScFen,
  parseScFen,
  replayScFen,
  validateScFenHistory,
} from "~/starchess/scfen";
import type { ScFenSnapshot } from "~/types/starchess";

const withEmptyQ = (snap: ScFenSnapshot): string =>
  formatScFen({ ...snap, queue: { actions: [] } });

describe("validateScFenHistory / replayScFen", () => {
  it("accepts Combat Chain history built from addScMove + endScTurn", () => {
    let snap = addScMove(
      addScMove(
        {
          placement: "4bk2/8/5n2/4p3/8/2R5/3P4/4K3",
          turn: 0,
          kingLives: { w: 3, b: 3 },
          phase: "P",
          gas: { w: 1, b: 1 },
          gasIncome: { w: 1, b: 1 },
          queue: { actions: [] },
        },
        { color: "w", from: "d2", to: "d4" },
      ),
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
    const s3 = withEmptyQ(t3);

    // Each entry is a planning snap; queues on s0/s1/s2 prove the next placement.
    const v = validateScFenHistory(s0, [s1, s2, s3]);
    expect(v.ok).toBe(true);
    expect(v.replay).toBe("ok");
    expect(t3.placement).toBe("5k2/8/8/4P3/8/2n5/8/4K3");
  });

  it("marks snapshot-only histories", () => {
    const start = "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11";
    const next = "SCFEN|5k2/8/2b2n2/4p3/3P4/2R5/8/4K3|1|33|P|G:11:11";
    const v = validateScFenHistory(start, [next]);
    expect(v.ok).toBe(true);
    expect(v.replay).toBe("snapshot-only");
  });

  it("rejects drifted placement", () => {
    const s0 =
      "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:C=d2d4;b:C=e8c6";
    const wrong =
      "SCFEN|8/8/8/8/8/8/8/4K2k|1|33|P|G:11:11|Q:w:;b:";
    const v = validateScFenHistory(s0, [wrong]);
    expect(v.ok).toBe(false);
    expect(v.replay).toBe("failed");
    expect(v.error?.code).toBe("SC_REPLAY");
  });

  it("replayScFen folds action steps", () => {
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

  it("resolves B specials as w-then-b even if black was queued first", () => {
    // Both pawns relocate to e4 — wire order is w then b (black overwrites).
    let snap = parseScFen(
      "SCFEN|4k3/4p3/8/8/8/8/4P3/4K3|0|33|P|G:33:33|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "b", from: "e7", to: "e4" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e4" },
    }).snapshot;
    const inMemory = endScTurn(snap).next.placement;
    const viaWire = endScTurn(parseScFen(formatScFen(snap))).next.placement;
    expect(viaWire).toBe(inMemory);
    // Rank 4 (index 4): black pawn remains after w-then-b overwrite.
    expect(inMemory.split("/")[4]).toMatch(/p/);
  });

  it("rejects gas drift in history replay", () => {
    const s0 =
      "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:C=d2d4;b:C=e8c6";
    const wrong =
      "SCFEN|5k2/8/2b2n2/4p3/3P4/2R5/8/4K3|1|33|P|G:00:11|Q:w:;b:";
    const v = validateScFenHistory(s0, [wrong]);
    expect(v.ok).toBe(false);
    expect(v.error?.code).toBe("SC_REPLAY");
  });

  it("King Hunt first ply via history", () => {
    const s0 =
      "SCFEN|k7/5r2/8/2n5/4K3/8/7b/8|0|33|P|G:11:11|Q:w:;b:C=c5e4";
    const s1 =
      "SCFEN|k7/5r2/8/2n5/4K3/8/7b/8|1|23|P|G:11:11|Q:w:;b:";
    const v = validateScFenHistory(s0, [s1]);
    expect(v.ok).toBe(true);
    expect(v.replay).toBe("ok");
  });
});
