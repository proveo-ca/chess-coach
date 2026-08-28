/**
 * Spider mines: what contact does.
 *  - a unit that **attacks** a visible mine tile clears it and occupies
 *    (marines only attack front diagonals; sieged tanks fire without moving),
 *  - walking onto one — marine forward step, or a mine still fogged at contact —
 *    kills the mover with the mine,
 *  - crossing one mid-slide wakes it (chase) and kills the mover,
 *  - allied mines never arm; a king never trades — its contact is an attack in
 *    every mode, so it clears the tile and moves in.
 *
 * Special-phase routes (gas step, deploy, Tactical Jump, fog approach) live in
 * `mineContactRoutes.test.ts` — this file is the classical pass only.
 * // SPEC: _spec/packages/starchess-core/resolve.puml
 */
import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  parseScFen,
  placementToMap,
  type ScFenSnapshot,
} from "../../index";

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

/** Attack phase clears the mine; the attacker survives (and occupies unless sieged). */
const assertMineCleared = (
  r: {
    resolved: { attacks: unknown[]; mineTriggers: unknown[] };
    next: ScFenSnapshot;
  },
  opts: {
    unitFrom: string;
    unitTo: string;
    piece: string;
    color: "w" | "b";
    mineColor: "w" | "b";
    /** Sieged tanks fire in place — the unit stays on `unitFrom`. */
    occupies?: boolean;
  },
) => {
  const occupies = opts.occupies !== false;
  expect(r.resolved.attacks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "mineBlast",
        piece: opts.piece,
        color: opts.color,
        from: opts.unitFrom,
        to: opts.unitTo,
        mineColor: opts.mineColor,
      }),
    ]),
  );
  expect(r.resolved.mineTriggers).toEqual([]);
  const map = placementToMap(r.next.placement);
  const at = occupies ? opts.unitTo : opts.unitFrom;
  const vacated = occupies ? opts.unitFrom : opts.unitTo;
  expect(map.get(at as never)).toEqual({ type: opts.piece, color: opts.color });
  expect(map.get(vacated as never)).toBeUndefined();
  expect((r.next.mines ?? []).some((m) => m.at === opts.unitTo)).toBe(false);
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

describe("mine targeting — a unit that attacks the tile clears it and occupies", () => {
  it.each([
    {
      name: "hoverbike attacks the mine it lands on",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/3NK3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:c3",
      from: "d1",
      to: "c3",
      piece: "n",
    },
    {
      name: "mecha attacks the mine it lands on",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/B3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:c3",
      from: "a1",
      to: "c3",
      piece: "b",
    },
    {
      name: "battleship attacks the mine it lands on",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/Q3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:d4",
      from: "a1",
      to: "d4",
      piece: "q",
    },
    {
      name: "marine attacks a mine on its front diagonal",
      scfen: "SCFEN|4k3/8/8/8/8/8/3P4/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:e3",
      from: "d2",
      to: "e3",
      piece: "p",
    },
  ] as const)("$name", (row) => {
    const r = resolveClassical(row.scfen, row.from, row.to);
    assertMineCleared(r, {
      unitFrom: row.from,
      unitTo: row.to,
      piece: row.piece,
      color: "w",
      mineColor: "b",
    });
  });

  it("sieged tank clears a mine on its ray without relocating", () => {
    const r = resolveClassical(
      "SCFEN|4k3/8/8/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:|S:a1|M:w:;b:a4",
      "a1",
      "a4",
    );
    assertMineCleared(r, {
      unitFrom: "a1",
      unitTo: "a4",
      piece: "r",
      color: "w",
      mineColor: "b",
      occupies: false,
    });
  });

  it("marine promotes after clearing a last-rank mine diagonally", () => {
    const r = resolveClassical(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|M:b:d8|Q:w:;b:",
      "e7",
      "d8",
      "w",
      "q",
    );
    expect(r.resolved.promotions).toEqual([
      expect.objectContaining({ at: "d8", unit: "q", color: "w" }),
    ]);
    expect(placementToMap(r.next.placement).get("d8")).toEqual({
      type: "q",
      color: "w",
    });
    expect((r.next.mines ?? []).some((m) => m.at === "d8")).toBe(false);
  });
});

describe("spider mine hit — enemy unit + mine both dead", () => {
  it.each([
    {
      name: "marine walks forward onto a mine (no front-diagonal attack)",
      scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:e3",
      from: "e2",
      to: "e3",
      piece: "p",
      mineAt: "e3",
    },
    {
      name: "tank lands on a mine it cannot see (fogged tile — never a target)",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:a4",
      from: "a1",
      to: "a4",
      piece: "r",
      mineAt: "a4",
    },
    {
      name: "mecha crosses mid-path mine (diagonal chase)",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/B3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:c3",
      from: "a1",
      to: "h8",
      piece: "b",
      mineAt: "c3",
    },
    {
      name: "tank crosses mid-path mine (file chase)",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:a4",
      from: "a1",
      to: "a8",
      piece: "r",
      mineAt: "a4",
    },
    {
      name: "battleship crosses mid-path mine (diagonal chase)",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/Q3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:c3",
      from: "a1",
      to: "h8",
      piece: "q",
      mineAt: "c3",
    },
  ] as const)("$name — unit and mine both gone", (row) => {
    const r = resolveClassical(row.scfen, row.from, row.to);
    assertUnitAndMineDead(r, {
      unitFrom: row.from,
      unitTo: row.to,
      mineAt: row.mineAt,
      piece: row.piece,
      color: "w",
      mineColor: "b",
    });
  });

  it("king steps onto hostile mine — attack/move (mine dies, king lands)", () => {
    const r = resolveClassical(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:e2",
      "e1",
      "e2",
    );
    // The Command Center shoots the tile and moves in — never a trade.
    expect(r.resolved.attacks).toEqual([
      {
        kind: "mineBlast",
        piece: "k",
        color: "w",
        from: "e1",
        to: "e2",
        mineColor: "b",
      },
    ]);
    expect(r.resolved.mineTriggers).toEqual([]);
    expect(placementToMap(r.next.placement).get("e2")).toEqual({
      type: "k",
      color: "w",
    });
    expect(r.next.mines ?? []).toEqual([]);
  });

  it("king captures a unit standing on a mine — unit and mine both die", () => {
    const r = resolveClassical(
      "SCFEN|4k3/8/8/8/8/8/4p3/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:e2",
      "e1",
      "e2",
    );
    // `mineColor` is what tells the timeline a second wreck belongs on this
    // tile: one shot, two deaths (the victim and the mine it was standing on).
    expect(r.resolved.attacks).toEqual([
      {
        kind: "capture",
        piece: "k",
        color: "w",
        from: "e1",
        to: "e2",
        victim: { piece: "p", color: "b" },
        occupies: true,
        mineColor: "b",
      },
    ]);
    expect(placementToMap(r.next.placement).get("e2")).toEqual({
      type: "k",
      color: "w",
    });
    expect(r.next.mines ?? []).toEqual([]);
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

  it("ally landing on own mine — inert (unit and mine both remain)", () => {
    const r = resolveClassical(
      "SCFEN|4k3/8/8/8/8/8/8/3NK3|0|33|P|G:11:11|Q:w:;b:|M:w:c3;b:",
      "d1",
      "c3",
    );
    expect(r.resolved.mineTriggers).toEqual([]);
    expect(r.resolved.attacks).toEqual([]);
    expect(placementToMap(r.next.placement).get("c3")).toEqual({
      type: "n",
      color: "w",
    });
    expect(r.next.mines).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: "w", at: "c3" })]),
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
    // A pawn cannot attack straight ahead: the mine takes it in the walk-over
    // pass, so the move stands and nothing promotes behind the blast.
    expect(r.resolved.attacks.filter((a) => a.kind === "mineBlast")).toEqual([]);
    expect(r.resolved.moves).toEqual([
      { piece: "p", color: "w", from: "e7", to: "e8" },
    ]);
    expect(r.resolved.promotions).toEqual([]);
  });
});

