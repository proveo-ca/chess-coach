/**
 * pawnDouble gas step +1; stacks with classical B+C / C+F.
 */
import { describe, expect, it } from "vitest";

import { addScAction, AddScActionError } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { parseScFen } from "~/starchess/scfen";

// Turn 11 → income tier 2 so B+C gas + classical fit.
const start = () =>
  parseScFen("SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:");

describe("pawnDouble resolve", () => {
  it("rejects multi-rank gas step at queue time", () => {
    const snap = start();
    expect(() =>
      addScAction({
        snapshot: snap,
        action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e4" },
      }),
    ).toThrow(AddScActionError);
  });

  it("B+C advances two ranks (gas then classical rewrite)", () => {
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
    const { next } = endScTurn(snap);
    // B e2→e3, rewrite C→e3e4, move to e4
    expect(next.placement).toBe("4k3/8/8/8/4P3/8/8/4K3");
  });

  it("C+F advances two ranks (classical then gas ride)", () => {
    let snap = start();
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
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    const { next } = endScTurn(snap);
    expect(next.placement).toBe("4k3/8/8/8/4P3/8/8/4K3");
  });

  it("B-only gas step advances one rank", () => {
    let snap = start();
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    const { next } = endScTurn(snap);
    expect(next.placement).toBe("4k3/8/8/8/8/4P3/8/4K3");
  });
});
