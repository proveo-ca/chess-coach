/**
 * Spider mines: hostile contact kills the enemy unit and the mine.
 * Allies and kings never arm.
 */
import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  parseScFen,
  placementToMap,
  type ScFenSnapshot,
} from "../src/index";

const assertUnitAndMineDead = (
  r: { resolved: { mineTriggers: unknown[] }; next: ScFenSnapshot },
  opts: {
    unitFrom: string;
    unitTo: string;
    mineAt: string;
    piece: string;
    color: "w" | "b";
    mineColor: "w" | "b";
  },
) => {
  expect(r.resolved.mineTriggers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "mineBlast",
        mineColor: opts.mineColor,
        victim: { piece: opts.piece, color: opts.color },
      }),
    ]),
  );
  const map = placementToMap(r.next.placement);
  expect(map.get(opts.unitFrom as never)).toBeUndefined();
  expect(map.get(opts.unitTo as never)).toBeUndefined();
  expect(r.next.mines ?? []).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ at: opts.mineAt, color: opts.mineColor }),
    ]),
  );
  expect((r.next.mines ?? []).some((m) => m.at === opts.mineAt)).toBe(false);
};

const resolveClassical = (
  scfen: string,
  from: string,
  to: string,
  color: "w" | "b" = "w",
  promotion?: "q" | "r" | "b" | "n",
) => {
  let snap = parseScFen(scfen);
  snap = addScAction({
    snapshot: snap,
    action: {
      timing: "C",
      kind: "classical",
      color,
      from: from as never,
      to: to as never,
      ...(promotion ? { promotion } : {}),
    },
  }).snapshot;
  return endScTurn(snap, { skipTurnStartChecks: true });
};

describe("spider mine hit — enemy unit + mine both dead (all pieces except king)", () => {
  /**
   * Table: each non-king piece type lands on or crosses a black mine.
   * Placement keeps a lone white unit + kings; mine is always black.
   */
  it.each([
    {
      name: "pawn lands on mine (forward walk-over)",
      scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:e3",
      from: "e2",
      to: "e3",
      piece: "p",
      mineAt: "e3",
    },
    {
      name: "knight lands on mine",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/3NK3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:c3",
      from: "d1",
      to: "c3",
      piece: "n",
      mineAt: "c3",
    },
    {
      name: "bishop lands on mine",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/B3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:c3",
      from: "a1",
      to: "c3",
      piece: "b",
      mineAt: "c3",
    },
    {
      name: "bishop crosses mid-path mine (diagonal chase)",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/B3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:c3",
      from: "a1",
      to: "h8",
      piece: "b",
      mineAt: "c3",
    },
    {
      name: "rook lands on mine",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:a4",
      from: "a1",
      to: "a4",
      piece: "r",
      mineAt: "a4",
    },
    {
      name: "rook crosses mid-path mine (file chase)",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:a4",
      from: "a1",
      to: "a8",
      piece: "r",
      mineAt: "a4",
    },
    {
      name: "queen lands on mine",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/Q3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:d1",
      // Wait Q and K both on rank 1 - Qd1 invalid with K. Use Qa1 mine d4 land.
      // Fix in row below via replace
      from: "a1",
      to: "d4",
      piece: "q",
      mineAt: "d4",
    },
    {
      name: "queen crosses mid-path mine (diagonal chase)",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/Q3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:c3",
      from: "a1",
      to: "h8",
      piece: "q",
      mineAt: "c3",
    },
  ] as const)("$name — unit and mine both gone", (row) => {
    // Fix queen land scfen (Qa1 + Ke1 + mine d4)
    const scfen =
      row.piece === "q" && row.to === "d4"
        ? "SCFEN|4k3/8/8/8/8/8/8/Q3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:d4"
        : row.scfen;
    const r = resolveClassical(scfen, row.from, row.to);
    assertUnitAndMineDead(r, {
      unitFrom: row.from,
      unitTo: row.to,
      mineAt: row.mineAt,
      piece: row.piece,
      color: "w",
      mineColor: "b",
    });
  });

  it("king steps onto hostile mine — immune (king and mine both remain)", () => {
    const r = resolveClassical(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:e2",
      "e1",
      "e2",
    );
    expect(r.resolved.mineTriggers).toEqual([]);
    expect(placementToMap(r.next.placement).get("e2")).toEqual({
      type: "k",
      color: "w",
    });
    expect(r.next.mines).toEqual(
      expect.arrayContaining([expect.objectContaining({ at: "e2", color: "b" })]),
    );
  });

  it("ally sliding over own mine — inert (unit and mine both remain)", () => {
    const r = resolveClassical(
      "SCFEN|4k3/8/8/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:|M:w:a4;b:",
      "a1",
      "a8",
    );
    expect(r.resolved.mineTriggers).toEqual([]);
    expect(placementToMap(r.next.placement).get("a8")).toEqual({
      type: "r",
      color: "w",
    });
    expect(r.next.mines).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: "w", at: "a4" })]),
    );
  });

  it("promoting onto enemy mine — pawn and mine both dead, no deploy", () => {
    const r = resolveClassical(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|M:b:e8|Q:w:;b:",
      "e7",
      "e8",
      "w",
      "q",
    );
    assertUnitAndMineDead(r, {
      unitFrom: "e7",
      unitTo: "e8",
      mineAt: "e8",
      piece: "p",
      color: "w",
      mineColor: "b",
    });
    expect(r.resolved.promotions).toEqual([]);
  });
});
