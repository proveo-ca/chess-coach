import { describe, expect, it } from "vitest";

import { addScAction, addScMove, addScMoveSan, AddScActionError } from "~/starchess/scActions";
import { formatScFen, parseScFen } from "~/starchess/scfen";
import type { ScFenSnapshot } from "~/starchess/types";

const start = (): ScFenSnapshot =>
  parseScFen("SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:;b:");

/** Turn 11 → income tier 2 (Charon / Jump cost 2). */
const midGame = (placement: string, gas = "22:22") =>
  parseScFen(`SCFEN|${placement}|11|33|P|G:${gas}|Q:w:;b:`);

describe("addScAction / addScMove", () => {
  it("queues dual classical moves without spending gas", () => {
    let snap = start();
    snap = addScMove(snap, { color: "w", from: "d2", to: "d4" });
    snap = addScMove(snap, { color: "b", from: "e8", to: "c6" });
    expect(snap.gas).toEqual({ w: 1, b: 1 });
    expect(formatScFen(snap)).toBe(
      "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:C=d2d4;b:C=e8c6",
    );
  });

  it("rejects a second classical for the same side", () => {
    let snap = start();
    snap = addScMove(snap, { color: "w", from: "d2", to: "d4" });
    expect(() => addScMove(snap, { color: "w", from: "c3", to: "c4" })).toThrow(AddScActionError);
    try {
      addScMove(snap, { color: "w", from: "c3", to: "c4" });
    } catch (e) {
      expect((e as AddScActionError).code).toBe("SC_QUEUE_SHAPE");
    }
  });

  it("spends 2 gas for bishopSnipe and rejects when insufficient", () => {
    const poor = parseScFen(
      "SCFEN|4k2q/8/8/8/3B4/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    expect(() =>
      addScAction({
        snapshot: poor,
        action: {
          timing: "B",
          kind: "bishopSnipe",
          color: "w",
          from: "d4",
          to: "h8",
        },
      }),
    ).toThrow(AddScActionError);

    const rich = midGame("4k2q/8/8/8/3B4/8/8/4K3");
    const { snapshot, action } = addScAction({
      snapshot: rich,
      action: {
        timing: "B",
        kind: "bishopSnipe",
        color: "w",
        from: "d4",
        to: "h8",
      },
    });
    expect(action.seq).toBe(0);
    expect(snapshot.gas.w).toBe(0);
    expect(formatScFen(snapshot)).toContain("B=bishopSnipe:d4:h8");
    expect(formatScFen(snapshot)).toContain("G:02:22");
  });

  it("spends 2 gas for queenWarp", () => {
    const snap = midGame("4k3/8/8/8/8/8/8/Q3K3");
    const { snapshot } = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "queenWarp", color: "w", from: "a1", to: "c3" },
    });
    expect(snapshot.gas.w).toBe(0);
  });

  it("rejects second special on same side", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    expect(() =>
      addScAction({
        snapshot: snap,
        action: { timing: "F", kind: "rookSiege", color: "w", from: "a1" },
      }),
    ).toThrow(AddScActionError);
  });

  it("rejects non-P phase", () => {
    const snap = parseScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|A|G:11:11");
    expect(() =>
      addScMove(snap, { color: "w", from: "e2", to: "e4" }),
    ).toThrow(AddScActionError);
  });

  it("addScMoveSan accepts coordinate moves", () => {
    const snap = addScMoveSan(start(), "d2d4", "w");
    expect(snap.queue?.actions[0]).toMatchObject({
      timing: "C",
      from: "d2",
      to: "d4",
      color: "w",
    });
  });

  it("classical does not spend gas; F special after C spends gas", () => {
    let snap = start();
    snap = addScMove(snap, { color: "w", from: "d2", to: "d4" });
    expect(snap.gas.w).toBe(1);
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "rookSiege", color: "w", from: "c3" },
    }).snapshot;
    expect(snap.gas.w).toBe(0);
  });
});
