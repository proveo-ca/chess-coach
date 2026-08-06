import { describe, expect, it } from "vitest";

import { addScAction, addScMove } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { formatScFen, parseScFen } from "~/starchess/scfen";
import type { ScFenSnapshot } from "~/starchess/types";

const combatStart = (): ScFenSnapshot =>
  parseScFen("SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:;b:");

describe("endScTurn", () => {
  it("Combat Chain: three classical plies via queues only", () => {
    let snap = combatStart();

    snap = addScMove(snap, { color: "w", from: "d2", to: "d4" });
    snap = addScMove(snap, { color: "b", from: "e8", to: "c6" });
    let r = endScTurn(snap);
    expect(r.next.placement).toBe("5k2/8/2b2n2/4p3/3P4/2R5/8/4K3");
    expect(r.next.turn).toBe(1);
    expect(r.next.queue?.actions).toEqual([]);
    expect(r.next.gas).toEqual({ w: 1, b: 1 });

    snap = r.next;
    snap = addScMove(snap, { color: "w", from: "d4", to: "e5" });
    snap = addScMove(snap, { color: "b", from: "f6", to: "e4" });
    r = endScTurn(snap);
    expect(r.next.placement).toBe("5k2/8/2b5/4P3/4n3/2R5/8/4K3");
    expect(r.next.turn).toBe(2);

    snap = r.next;
    snap = addScMove(snap, { color: "w", from: "c3", to: "c6" });
    snap = addScMove(snap, { color: "b", from: "e4", to: "c3" });
    r = endScTurn(snap);
    expect(r.next.placement).toBe("5k2/8/2b5/4P3/8/2n5/8/4K3");
    expect(r.next.turn).toBe(3);
    expect(r.next.kingLives).toEqual({ w: 3, b: 3 });
  });

  it("king-aimed C does not arm HP when the ray is clear (implicit checks)", () => {
    let snap = parseScFen(
      "SCFEN|k7/5r2/8/2n5/4K3/8/7b/8|0|33|P|G:11:11|Q:w:;b:",
    );
    // Standing Nc5 already checks — End chips via geometry; C=c5e4 is a no-op relocate.
    snap = addScMove(snap, { color: "b", from: "c5", to: "e4" });
    const r = endScTurn(snap);
    expect(r.resolved.attacks[0]).toMatchObject({
      kind: "kingShot",
      from: "c5",
      to: "e4",
      livesAfter: 2,
    });
    expect(r.next.kingLives.w).toBe(2);
    expect(r.next.pendingKingShots).toBeUndefined();
    // Knight never occupied the king square.
    expect(r.next.placement).toBe("k7/5r2/8/2n5/4K3/8/7b/8");
  });

  it("empty queue applies legal standing check HP −1", () => {
    // Nc5 legally checks Ke4 — no H: / no king-aimed C=.
    const snap = parseScFen(
      "SCFEN|k7/5r2/8/2n5/4K3/8/7b/8|1|33|P|G:11:11|Q:w:;b:",
    );
    const r = endScTurn(snap);
    expect(r.resolved.attacks[0]).toMatchObject({
      kind: "kingShot",
      from: "c5",
      to: "e4",
      livesAfter: 2,
    });
    expect(r.next.kingLives.w).toBe(2);
    expect(r.next.pendingKingShots).toBeUndefined();
    expect(r.next.phase).toBe("P");
  });

  it("legal check resolves before B=spawn beside the king", () => {
    // Qd1 sees/checks kd4 (file); black spawns on e3 after HP.
    let snap = parseScFen(
      "SCFEN|8/8/8/8/3k4/8/8/3QK3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "spawn",
        color: "b",
        from: "d4",
        to: "e3",
        unit: "n",
      },
    }).snapshot;
    const r = endScTurn(snap);
    expect(r.afterPending.kingLives.b).toBe(2);
    expect(r.resolved.attacks[0]).toMatchObject({
      kind: "kingShot",
      from: "d1",
      to: "d4",
      livesAfter: 2,
    });
    expect(r.next.kingLives.b).toBe(2);
    expect(r.next.placement).toBe("8/8/8/8/3k4/4n3/8/3QK3");
  });

  it("blocked slider is not a legal check — no HP", () => {
    // Queen a1 → e5 blocked by knight on c3.
    const snap = parseScFen(
      "SCFEN|8/8/8/4k3/8/2n5/8/Q3K3|1|33|P|G:11:11|Q:w:;b:",
    );
    const r = endScTurn(snap);
    expect(r.resolved.attacks).toEqual([]);
    expect(r.next.kingLives.b).toBe(3);
    expect(r.next.placement).toBe("8/8/8/4k3/8/2n5/8/Q3K3");
  });

  it("B rookSiege toggles S: without a classical move", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/5R2/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "rookSiege", color: "w", from: "f6" },
    }).snapshot;
    const r = endScTurn(snap);
    expect(r.siegedThisTurn).toEqual(["f6"]);
    expect(r.next.siegedRooks).toEqual(["f6"]);
    expect(r.next.placement).toBe("4k3/8/5R2/8/8/8/8/4K3");
    expect(formatScFen(r.next)).toContain("S:f6");
  });

  it("lethal fog-visible check emits phase O", () => {
    // Sieged Rf6 sees/checks Kc6 with 1 life (tank 5×5 would miss file c).
    const snap = parseScFen(
      "SCFEN|k7/8/2K2r2/8/8/8/8/6b1|4|13|P|G:11:11|S:f6|Q:w:;b:",
    );
    const r = endScTurn(snap);
    expect(r.next.kingLives.w).toBe(0);
    expect(r.next.phase).toBe("O");
  });

  it("tank-mode rook does not check a fogged king; siege does", () => {
    const tank = parseScFen(
      "SCFEN|k7/8/2K3r1/8/8/8/8/8|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(endScTurn(tank).next.kingLives.w).toBe(3);

    const siege = parseScFen(
      "SCFEN|k7/8/2K3r1/8/8/8/8/8|1|33|P|G:11:11|S:g6|Q:w:;b:",
    );
    const r = endScTurn(siege);
    expect(r.resolved.attacks[0]).toMatchObject({
      kind: "kingShot",
      from: "g6",
      to: "c6",
      livesAfter: 2,
    });
    expect(r.next.kingLives.w).toBe(2);
  });

  it("bishop checks via siege-tank side vision (attack range unlimited on the diagonal)", () => {
    // Bg1→c5 diagonal; bishop 5×5 alone cannot light c5. Sieged Rg6 lights c5.
    const fogged = parseScFen(
      "SCFEN|k7/8/6r1/2K5/8/8/8/6b1|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(endScTurn(fogged).resolved.attacks).toEqual([]);
    expect(endScTurn(fogged).next.kingLives.w).toBe(3);

    const lit = parseScFen(
      "SCFEN|k7/8/6r1/2K5/8/8/8/6b1|1|33|P|G:11:11|S:g6|Q:w:;b:",
    );
    const r = endScTurn(lit);
    expect(r.resolved.attacks.some((a) => a.kind === "kingShot" && a.from === "g1")).toBe(
      true,
    );
    // Sieged rook on g6 does not attack c5 (not same rank/file) — only bishop chips.
    expect(r.next.kingLives.w).toBe(2);
  });

  it("H: still round-trips in parse/format (legacy; unused by endScTurn)", () => {
    const raw =
      "SCFEN|K7/6R1/8/2N5/4k3/8/7B/8|0|33|P|G:11:11|Q:w:;b:|H:w:n:c5e4";
    const snap = parseScFen(raw);
    expect(snap.pendingKingShots).toEqual([
      { color: "w", piece: "n", from: "c5", to: "e4" },
    ]);
    expect(formatScFen(snap)).toContain("H:w:n:c5e4");
  });

  it("queenWarp marks origin immune and relocates before classical", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/Q3K2r|11|33|P|G:22:22|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "queenWarp", color: "w", from: "a1", to: "c3" },
    }).snapshot;
    snap = addScMove(snap, { color: "b", from: "h1", to: "a1" });
    const r = endScTurn(snap);
    expect(r.ignoreAttacksOn).toContain("a1");
    const rank3 = r.next.placement.split("/")[5]!;
    expect(rank3).toMatch(/Q/);
  });

  it("bishopSnipe removes queen without relocating bishop", () => {
    let snap = parseScFen(
      "SCFEN|4k2q/8/8/8/3B4/8/8/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "bishopSnipe", color: "w", from: "d4", to: "h8" },
    }).snapshot;
    const r = endScTurn(snap);
    expect(r.next.placement).toBe("4k3/8/8/8/3B4/8/8/4K3");
  });

  it("empty queue still advances turn and refills gas", () => {
    const r = endScTurn(combatStart());
    expect(r.next.turn).toBe(1);
    expect(r.next.placement).toBe(combatStart().placement);
    expect(formatScFen(r.next)).toContain("G:11:11");
  });
});
