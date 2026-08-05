import { describe, expect, it } from "vitest";

import { addScAction, AddScActionError } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { formatScFen, parseScFen } from "~/starchess/scfen";

describe("SC-COLLISION-1 / implicit checks", () => {
  it("blocked slider is not a legal check; king-aimed C does not invent one", () => {
    // Queen a1 → king e5 blocked by knight on c3 — not a legal check.
    const start = parseScFen(
      "SCFEN|8/8/8/4k3/8/2n5/8/Q3K3|1|33|P|G:11:11|Q:w:;b:",
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
    const r = endScTurn(planned);
    expect(r.next.kingLives.b).toBe(3);
    expect(r.resolved.attacks).toEqual([]);
    expect(r.next.placement).toBe("8/8/8/4k3/8/2n5/8/Q3K3");
  });

  it("knight legal check chips HP on empty End — leap cannot be blocked", () => {
    const start = parseScFen(
      "SCFEN|4k3/4p3/3N4/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    const r = endScTurn(start);
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
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|M:w:c3d4;b:f5",
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
      "SCFEN|4k3/8/8/8/8/8/8/R3K3|1|33|P|G:11:11|M:b:a2|Q:w:;b:",
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
        "SCFEN|4k3/8/8/8/8/8/8/1N2K3|1|33|P|G:11:11|M:b:c3|Q:w:;b:",
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

  it("mines ignore allies — classical onto ally is illegal even with a mine", () => {
    const start = parseScFen(
      "SCFEN|7k/8/8/8/Q3R3/8/8/4K3|1|33|P|G:11:11|M:w:e4|Q:w:;b:",
    );
    expect(() =>
      addScAction({
        snapshot: start,
        action: {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "a4",
          to: "e4",
        },
      }),
    ).toThrow(/ally/);
  });

  it("king is immune to hostile mine on destination — mine stays, king lives", () => {
    const withMove = addScAction({
      snapshot: parseScFen(
        "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|M:b:e2|Q:w:;b:",
      ),
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e1",
        to: "e2",
      },
    }).snapshot;
    const r = endScTurn(withMove);
    expect(r.resolved.attacks).toEqual([]);
    expect(r.resolved.mineTriggers).toEqual([]);
    expect(r.resolved.moves).toEqual([
      { piece: "k", color: "w", from: "e1", to: "e2" },
    ]);
    expect(r.next.placement).toBe("4k3/8/8/8/8/8/4K3/8");
    expect(r.next.mines).toEqual([{ color: "b", at: "e2" }]);
    expect(r.next.kingLives.w).toBe(3);
  });

  it("king path does not wake a chase mine", () => {
    const withMove = addScAction({
      snapshot: parseScFen(
        "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|M:b:e2|Q:w:;b:",
      ),
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e1",
        to: "e3",
      },
    }).snapshot;
    const r = endScTurn(withMove);
    expect(r.resolved.mineTriggers).toEqual([]);
    expect(r.resolved.moves).toEqual([
      { piece: "k", color: "w", from: "e1", to: "e3" },
    ]);
    expect(r.next.mines).toEqual([{ color: "b", at: "e2" }]);
    expect(r.next.placement).toBe("4k3/8/8/8/8/4K3/8/8");
  });

  it("caps mines at 2 per side when planting via knightMine", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/1N2K3|1|33|P|G:11:11|M:w:a3b3|Q:w:;b:",
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
    const snap = parseScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:");
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
      "SCFEN|4k3/8/8/8/3B4/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
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
