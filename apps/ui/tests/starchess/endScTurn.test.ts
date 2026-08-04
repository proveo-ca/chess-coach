import { describe, expect, it } from "vitest";

import { addScAction, addScMove } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { formatScFen, parseScFen } from "~/starchess/scfen";
import type { ScFenSnapshot } from "~/types/starchess";

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
    expect(r.next.placement).toBe("5k2/8/8/4P3/8/2n5/8/4K3");
    expect(r.next.turn).toBe(3);
    expect(r.next.kingLives).toEqual({ w: 3, b: 3 });
  });

  it("king-aimed C arms pending; HP unchanged this turn", () => {
    let snap = parseScFen(
      "SCFEN|k7/5r2/8/2n5/4K3/8/7b/8|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScMove(snap, { color: "b", from: "c5", to: "e4" });
    const r = endScTurn(snap);
    expect(r.resolved.attacks).toEqual([]);
    expect(r.next.pendingKingShots).toEqual([
      { color: "b", piece: "n", from: "c5", to: "e4" },
    ]);
    expect(r.next.kingLives.w).toBe(3);
    expect(r.next.placement).toBe("k7/5r2/8/2n5/4K3/8/7b/8");
    expect(r.next.gas).toEqual(r.next.gasIncome);
    expect(r.next.phase).toBe("P");
    expect(formatScFen(r.next)).toContain("H:b:n:c5e4");
  });

  it("next turn empty queue applies pending HP −1", () => {
    const snap = parseScFen(
      "SCFEN|k7/5r2/8/2n5/4K3/8/7b/8|1|33|P|G:11:11|Q:w:;b:|H:b:n:c5e4",
    );
    const r = endScTurn(snap);
    expect(r.resolved.attacks[0]).toMatchObject({ kind: "kingShot", livesAfter: 2 });
    expect(r.next.kingLives.w).toBe(2);
    expect(r.next.pendingKingShots).toBeUndefined();
    expect(r.next.phase).toBe("P");
  });

  it("next turn B=spawn on sliding ray blocks pending — collision, no HP", () => {
    // Queen a1 → king e5 pending; black spawns on d4 (adjacent to king, on the ray).
    let snap = parseScFen(
      "SCFEN|8/8/8/4k3/8/8/8/Q3K3|1|33|P|G:33:33|Q:w:;b:|H:w:q:a1e5",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "spawn",
        color: "b",
        from: "e5",
        to: "d4",
        unit: "n",
      },
    }).snapshot;
    const r = endScTurn(snap);
    expect(r.next.kingLives.b).toBe(3);
    expect(r.resolved.attacks[0]).toMatchObject({
      kind: "capture",
      to: "d4",
      collision: true,
      occupies: false,
    });
    expect(r.next.placement).toBe("8/8/8/4k3/8/8/8/Q3K3");
    expect(r.next.pendingKingShots).toBeUndefined();
  });

  it("lethal pending king-shot emits phase O", () => {
    const snap = parseScFen(
      "SCFEN|k7/8/2K2r2/8/8/8/8/6b1|4|13|P|G:11:11|Q:w:;b:|H:b:r:f6c6",
    );
    const r = endScTurn(snap);
    expect(r.next.kingLives.w).toBe(0);
    expect(r.next.phase).toBe("O");
  });

  it("H: round-trips in parse/format", () => {
    const raw =
      "SCFEN|K7/6R1/8/2N5/4k3/8/7B/8|0|33|P|G:33:33|Q:w:;b:|H:w:n:c5e4";
    const snap = parseScFen(raw);
    expect(snap.pendingKingShots).toEqual([
      { color: "w", piece: "n", from: "c5", to: "e4" },
    ]);
    expect(formatScFen(snap)).toContain("H:w:n:c5e4");
  });
  it("queenWarp marks origin immune and relocates before classical", () => {
    // White queen a1 jumps to c3; black rook tries a1 (would capture queen origin) — whiff.
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/Q3K2r|0|33|P|G:23:33|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "queenWarp", color: "w", from: "a1", to: "c3" },
    }).snapshot;
    snap = addScMove(snap, { color: "b", from: "h1", to: "a1" });
    const r = endScTurn(snap);
    expect(r.ignoreAttacksOn).toContain("a1");
    // Rank 3 is the 6th field (0-based index 5) — queen should be on c3.
    const rank3 = r.next.placement.split("/")[5]!;
    expect(rank3).toMatch(/Q/);
  });

  it("bishopSnipe removes queen without relocating bishop", () => {
    let snap = parseScFen(
      "SCFEN|4k2q/8/8/8/3B4/8/8/4K3|0|33|P|G:23:33|Q:w:;b:",
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
