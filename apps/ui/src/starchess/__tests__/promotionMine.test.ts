/**
 * Promotion settles after attack/move/mines.
 * Promoting onto an enemy spider mine: mutual destruction — no deploy.
 */
import { describe, expect, it } from "vitest";

import { addScAction } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { parseScFen } from "~/starchess/scfen";
import { placementToMap } from "~/starchess/board";

describe("promotion after move / mine interrupt", () => {
  it("clean last-rank move promotes after landing as a pawn", () => {
    const start = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    const queued = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    }).snapshot;
    const r = endScTurn(queued);

    expect(r.resolved.moves).toEqual([
      { piece: "p", color: "w", from: "e7", to: "e8" },
    ]);
    expect(r.resolved.promotions).toEqual([
      { color: "w", from: "e7", at: "e8", unit: "q" },
    ]);
    // Intermediate after-move board still shows the pawn.
    expect(placementToMap(r.resolved.afterMove.placement).get("e8")).toEqual({
      type: "p",
      color: "w",
    });
    expect(placementToMap(r.next.placement).get("e8")).toEqual({
      type: "q",
      color: "w",
    });
  });

  it("enemy spider mine on promotion square kills the pawn — no promote deploy", () => {
    // White pawn e7 → e8=q, black mine on e8 (king away on a8).
    const start = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|M:b:e8|Q:w:;b:",
    );
    const queued = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    }).snapshot;
    const r = endScTurn(queued);

    expect(r.resolved.attacks[0]).toMatchObject({
      kind: "mineBlast",
      from: "e7",
      to: "e8",
      mineColor: "b",
      victim: { piece: "p", color: "w" },
    });
    expect(r.resolved.moves).toEqual([]);
    expect(r.resolved.promotions).toEqual([]);
    expect(placementToMap(r.next.placement).get("e8")).toBeUndefined();
    expect(placementToMap(r.next.placement).get("e7")).toBeUndefined();
    expect(r.next.mines ?? []).toEqual([]);
  });

  it("non-promoting step onto mine still clears mine and occupies", () => {
    const withMove = addScAction({
      snapshot: parseScFen(
        "SCFEN|4k3/8/8/8/8/4P3/8/4K3|1|33|P|G:11:11|M:b:e4|Q:w:;b:",
      ),
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e3",
        to: "e4",
      },
    }).snapshot;
    const r = endScTurn(withMove);
    expect(r.resolved.attacks[0]).toMatchObject({
      kind: "mineBlast",
      from: "e3",
      to: "e4",
      mineColor: "b",
    });
    expect(r.resolved.attacks[0]).not.toHaveProperty("victim");
    expect(r.resolved.promotions).toEqual([]);
    expect(placementToMap(r.next.placement).get("e4")).toEqual({
      type: "p",
      color: "w",
    });
  });
});
