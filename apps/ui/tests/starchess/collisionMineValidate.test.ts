import { describe, expect, it } from "vitest";

import { addScAction, AddScActionError } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { formatScFen, parseScFen } from "~/starchess/scfen";

describe("SC-COLLISION-1 king-shot ray", () => {
  it("arms pending on king-aimed C; next End after B kills blocker, king spared", () => {
    // Queen a1 → king e5; black knight on c3 blocks the diagonal.
    const start = parseScFen(
      "SCFEN|8/8/8/4k3/8/2n5/8/Q3K3|1|33|P|G:33:33|Q:w:;b:",
    );
    const planned = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a1",
        to: "e5",
      },
    }).snapshot;
    expect(planned.queue?.actions[0]).toMatchObject({ from: "a1", to: "e5" });

    const armed = endScTurn(planned);
    expect(armed.next.kingLives.b).toBe(3);
    expect(armed.next.pendingKingShots).toEqual([
      { color: "w", piece: "q", from: "a1", to: "e5" },
    ]);
    expect(armed.next.placement).toBe("8/8/8/4k3/8/2n5/8/Q3K3");

    const r = endScTurn(armed.next);
    expect(r.next.placement).toBe("8/8/8/4k3/8/8/8/Q3K3");
    expect(r.next.kingLives.b).toBe(3);
    expect(r.resolved.attacks[0]).toMatchObject({
      kind: "capture",
      to: "c3",
      collision: true,
      occupies: false,
    });
    expect(r.resolved.moves).toEqual([]);
    expect(r.next.pendingKingShots).toBeUndefined();
  });

  it("knight king-shot arms then chips HP next turn — leap cannot be blocked", () => {
    // Knight d6 → king e8; black pawn e7 sits on a nearby square (would matter for a slide).
    const start = parseScFen(
      "SCFEN|4k3/4p3/3N4/8/8/8/8/4K3|1|33|P|G:33:33|Q:w:;b:",
    );
    const planned = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d6",
        to: "e8",
      },
    }).snapshot;
    expect(planned.queue?.actions[0]).toMatchObject({ to: "e8" });

    const armed = endScTurn(planned);
    expect(armed.resolved.attacks).toEqual([]);
    expect(armed.next.pendingKingShots).toEqual([
      { color: "w", piece: "n", from: "d6", to: "e8" },
    ]);
    expect(armed.next.kingLives.b).toBe(3);

    const r = endScTurn(armed.next);
    expect(r.resolved.attacks[0]).toMatchObject({
      kind: "kingShot",
      piece: "n",
      from: "d6",
      to: "e8",
      livesAfter: 2,
    });
    expect(r.next.kingLives.b).toBe(2);
    expect(r.next.placement).toBe("4k3/4p3/3N4/8/8/8/8/4K3");
  });
});

describe("SC-MINE-1", () => {
  it("round-trips M: in SCFEN", () => {
    const s = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:33:33|M:w:c3d4;b:f5",
    );
    expect(s.mines).toEqual([
      { color: "w", at: "c3" },
      { color: "w", at: "d4" },
      { color: "b", at: "f5" },
    ]);
    expect(formatScFen(s)).toContain("M:w:c3d4;b:f5");
  });

  it("path cross wakes mine chase — boom at destination, not mid-path", () => {
    // Rook a1→a4 crosses black mine on a2: relocate to a4, then blast at a4.
    const start = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/R3K3|1|33|P|G:33:33|M:b:a2|Q:w:;b:",
    );
    const withMove = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a1",
        to: "a4",
      },
    }).snapshot;
    const r = endScTurn(withMove);
    expect(r.resolved.moves).toEqual([
      expect.objectContaining({ piece: "r", from: "a1", to: "a4" }),
    ]);
    expect(r.resolved.mineTriggers).toHaveLength(1);
    expect(r.resolved.mineTriggers[0]).toMatchObject({
      kind: "mineBlast",
      to: "a4",
      mineColor: "b",
      victim: { piece: "r", color: "w" },
      chaseFrom: "a2",
    });
    expect(r.next.placement).toBe("4k3/8/8/8/8/8/8/4K3");
    expect(r.next.mines ?? []).toEqual([]);
  });

  it("hostile mine on destination is attacked then occupied (attacker survives)", () => {
    const withMove = addScAction({
      snapshot: parseScFen(
        "SCFEN|4k3/8/8/8/8/8/8/1N2K3|1|33|P|G:33:33|M:b:c3|Q:w:;b:",
      ),
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "b1",
        to: "c3",
      },
    }).snapshot;
    const r = endScTurn(withMove);
    expect(r.resolved.attacks[0]).toMatchObject({
      kind: "mineBlast",
      from: "b1",
      to: "c3",
      mineColor: "b",
    });
    expect(r.resolved.attacks[0]).not.toHaveProperty("victim");
    expect(r.resolved.mineTriggers).toEqual([]);
    expect(r.resolved.moves).toEqual([
      { piece: "n", color: "w", from: "b1", to: "c3" },
    ]);
    expect(r.next.placement).toBe("4k3/8/8/8/8/2N5/8/4K3");
    expect(r.next.mines ?? []).toEqual([]);
  });

  it("friendly-fire: attack on ally standing on a mine explodes both then occupies", () => {
    // White rook e4 on white mine; white queen a4 attacks e4.
    const start = parseScFen(
      "SCFEN|4k3/8/8/8/Q3R3/8/8/4K3|1|33|P|G:33:33|M:w:e4|Q:w:;b:",
    );
    const withMove = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a4",
        to: "e4",
      },
    }).snapshot;
    const r = endScTurn(withMove);
    expect(r.resolved.attacks[0]).toMatchObject({
      kind: "mineBlast",
      to: "e4",
      victim: { piece: "r", color: "w" },
    });
    expect(r.resolved.moves).toEqual([
      expect.objectContaining({ piece: "q", from: "a4", to: "e4" }),
    ]);
    expect(r.next.mines ?? []).toEqual([]);
    expect(r.next.placement).toBe("4k3/8/8/8/4Q3/8/8/4K3");
  });

  it("caps mines at 2 per side when planting via knightMine", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/1N2K3|1|33|P|G:33:33|M:w:a3b3|Q:w:;b:",
    );
    expect(() =>
      addScAction({
        snapshot: snap,
        action: { timing: "F", kind: "knightMine", color: "w", from: "b1", to: "c3" },
      }),
    ).toThrow(AddScActionError);
  });
});

describe("SC-BASELINE-1 / SC-SPECIAL-1", () => {
  it("rejects classical with no piece on from", () => {
    const snap = parseScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:33:33|Q:w:;b:");
    try {
      addScAction({
        snapshot: snap,
        action: {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "a2",
          to: "a3",
        },
      });
      expect.unreachable();
    } catch (e) {
      expect((e as AddScActionError).code).toBe("SC_BASELINE_FEN");
    }
  });

  it("rejects bishopSnipe without enemy queen on ray", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/3B4/8/8/4K3|0|33|P|G:33:33|Q:w:;b:",
    );
    try {
      addScAction({
        snapshot: snap,
        action: {
          timing: "B",
          kind: "bishopSnipe",
          color: "w",
          from: "d4",
          to: "h8",
        },
      });
      expect.unreachable();
    } catch (e) {
      expect((e as AddScActionError).code).toBe("SC_SPECIAL");
    }
  });
});
