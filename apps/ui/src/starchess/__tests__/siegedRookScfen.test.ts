import { describe, expect, it } from "vitest";

import { AddScActionError, addScAction } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { formatScFen, parseScFen } from "~/starchess/scfen";

describe("sieged rook SCFEN (S:)", () => {
  it("round-trips S: extras", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|0|33|P|G:11:11|S:c4|Q:w:;b:",
    );
    expect(snap.siegedRooks).toEqual(["c4"]);
    expect(formatScFen(snap)).toContain("S:c4");
  });

  it("rejects classical relocate from a sieged square", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|0|33|P|G:11:11|S:c4|Q:w:;b:",
    );
    expect(() =>
      addScAction({
        snapshot: snap,
        action: { timing: "C", kind: "classical", color: "w", from: "c4", to: "c8" },
      }),
    ).toThrow(AddScActionError);
    expect(() =>
      addScAction({
        snapshot: snap,
        action: { timing: "C", kind: "classical", color: "w", from: "c4", to: "c8" },
      }),
    ).toThrow(/sieged rook/);
  });

  it("tank-mode rook may relocate; F rookSiege packs into S:", () => {
    const start = parseScFen(
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    let q = addScAction({
      snapshot: { ...start, queue: { actions: [] } },
      action: { timing: "C", kind: "classical", color: "w", from: "c4", to: "c5" },
    }).snapshot;
    q = addScAction({
      snapshot: q,
      action: { timing: "F", kind: "rookSiege", color: "w", from: "c4" },
    }).snapshot;
    const { next } = endScTurn(q);
    expect(next.placement).toBe("4k3/8/8/2R5/8/8/8/4K3");
    expect(next.siegedRooks).toEqual(["c5"]);
  });

  it("F rookSiege toggles off an existing S: square", () => {
    const start = parseScFen(
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|0|33|P|G:11:11|S:c4|Q:w:;b:",
    );
    const q = addScAction({
      snapshot: { ...start, queue: { actions: [] } },
      action: { timing: "F", kind: "rookSiege", color: "w", from: "c4" },
    }).snapshot;
    const { next } = endScTurn(q);
    expect(next.siegedRooks).toBeUndefined();
  });

  it("B rookSiege alone packs into S: (special-before classical)", () => {
    const start = parseScFen(
      "SCFEN|4k3/8/5R2/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const q = addScAction({
      snapshot: { ...start, queue: { actions: [] } },
      action: { timing: "B", kind: "rookSiege", color: "w", from: "f6" },
    }).snapshot;
    const { next, siegedThisTurn, afterB } = endScTurn(q);
    expect(siegedThisTurn).toEqual(["f6"]);
    expect(afterB.siegedRooks).toEqual(["f6"]);
    expect(next.siegedRooks).toEqual(["f6"]);
    expect(formatScFen(next)).toContain("S:f6");
  });

  it("B siege before classical: siege applies first — rook attacks but does not relocate", () => {
    // Intent siege on c4, then classical capture on c7 — sieged tank shoots, stays put.
    let snap = parseScFen(
      "SCFEN|4k3/2n5/8/8/2R5/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "rookSiege", color: "w", from: "c4" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "c4", to: "c7" },
    }).snapshot;
    const { resolved, next, afterB } = endScTurn(snap);
    expect(afterB.siegedRooks).toEqual(["c4"]);
    expect(resolved.attacks[0]).toMatchObject({
      kind: "capture",
      from: "c4",
      to: "c7",
      victim: { piece: "n", color: "b" },
    });
    expect(resolved.moves).toEqual([]);
    expect(next.placement).toBe("4k3/8/8/8/2R5/8/8/4K3");
    expect(next.siegedRooks).toEqual(["c4"]);
  });

  it("rejects classical relocate when B intent enters siege (tank cannot move)", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "rookSiege", color: "w", from: "c4" },
    }).snapshot;
    expect(() =>
      addScAction({
        snapshot: snap,
        action: { timing: "C", kind: "classical", color: "w", from: "c4", to: "c5" },
      }),
    ).toThrow(/sieged rook/);
  });

  it("B unsiege unlocks classical relocate; destination packs as tank", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|0|33|P|G:11:11|S:c4|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "rookSiege", color: "w", from: "c4" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "c4", to: "c5" },
    }).snapshot;
    const { resolved, next, afterB } = endScTurn(snap);
    expect(afterB.siegedRooks).toEqual([]);
    expect(resolved.moves).toEqual([
      { piece: "r", color: "w", from: "c4", to: "c5" },
    ]);
    expect(next.placement).toBe("4k3/8/8/2R5/8/8/8/4K3");
    expect(next.siegedRooks).toBeUndefined();
  });

  it("B siege before classical lights siege vision for fogged attacks", () => {
    // Tank d4 (5×5) cannot see nh7; B siege (9×9) can — attack cue from d4, no relocate.
    let snap = parseScFen(
      "SCFEN|7k/7n/8/8/3R4/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "rookSiege", color: "w", from: "d4" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "d4", to: "h7" },
    }).snapshot;
    const { resolved, next } = endScTurn(snap);
    expect(resolved.attacks[0]).toMatchObject({
      kind: "capture",
      from: "d4",
      to: "h7",
      victim: { piece: "n", color: "b" },
    });
    expect(resolved.attacks[0]).not.toMatchObject({ moveCollision: true });
    expect(resolved.moves).toEqual([]);
    expect(next.placement).toBe("7k/8/8/8/3R4/8/8/4K3");
    expect(next.siegedRooks).toEqual(["d4"]);
  });
});
