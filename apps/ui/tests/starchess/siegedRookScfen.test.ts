import { describe, expect, it } from "vitest";

import { AddScActionError, addScAction } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { formatScFen, parseScFen } from "~/starchess/scfen";

describe("sieged rook SCFEN (S:)", () => {
  it("round-trips S: extras", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|0|33|P|G:33:33|S:c4|Q:w:;b:",
    );
    expect(snap.siegedRooks).toEqual(["c4"]);
    expect(formatScFen(snap)).toContain("S:c4");
  });

  it("rejects classical relocate from a sieged square", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|0|33|P|G:33:33|S:c4|Q:w:;b:",
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
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|0|33|P|G:33:33|Q:w:;b:",
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
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|0|33|P|G:33:33|S:c4|Q:w:;b:",
    );
    const q = addScAction({
      snapshot: { ...start, queue: { actions: [] } },
      action: { timing: "F", kind: "rookSiege", color: "w", from: "c4" },
    }).snapshot;
    const { next } = endScTurn(q);
    expect(next.siegedRooks).toBeUndefined();
  });
});
