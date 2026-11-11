import { describe, expect, it } from "vitest";

import { formatScFen, historyFromRecord, parseScFen } from "../index";

describe("special kinds renamed off the chess words", () => {
  it("reads a save written with the old names and writes it back with the new ones", () => {
    const legacy =
      "SCFEN|4k3/8/8/8/q7/8/8/3BK3|21|33|P|G:13:33|Q:w:B=bishopSnipe:d1:a4;b:";
    const snap = parseScFen(legacy);
    expect(snap.queue?.actions[0]).toMatchObject({ kind: "charonMissiles", from: "d1", to: "a4" });
    expect(formatScFen(snap)).toContain("B=charonMissiles:d1:a4");
  });

  it("maps every legacy kind, deploy included", () => {
    const legacy =
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:00:11|B:3:3|Q:w:B=spawn:e1:d2:n;b:";
    expect(parseScFen(legacy).queue?.actions[0]?.kind).toBe("deploy");
  });

  it("rewrites old kinds inside a stored record's resolves", () => {
    const history = historyFromRecord({
      scfens: ["SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:"],
      resolves: [
        {
          queue: [{ timing: "B", kind: "queenWarp", color: "w", from: "a1", to: "a4", seq: 1 }],
          events: [{ id: "ev-0", phase: "specialBefore", color: "w", kind: "queenWarp" }],
          resolved: { attacks: [{ kind: "kingShot", color: "w", from: "e7", to: "e8" }] },
        } as never,
      ],
    });
    const esr = history.settledResolves[0]!;
    expect(esr.queue[0]!.kind).toBe("tacticalJump");
    expect(esr.events[0]!.kind).toBe("tacticalJump");
    expect(esr.resolved.attacks[0]!.kind).toBe("ccShot");
  });

  it("renames legacy field names inside a stored resolve", () => {
    const history = historyFromRecord({
      scfens: ["SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:"],
      resolves: [
        {
          next: { kingLives: { w: 3, b: 2 }, siegedRooks: ["a1"], pendingKingShots: [] },
          resolved: { afterAttack: { kingLives: { w: 3, b: 2 } }, pendingKingShotsArmed: [] },
        } as never,
      ],
    });
    const esr = history.settledResolves[0]! as unknown as Record<string, Record<string, unknown>>;
    expect(esr.next).toEqual({ ccLives: { w: 3, b: 2 }, siegedTanks: ["a1"], pendingCCShots: [] });
    expect(esr.resolved).toEqual({
      afterAttack: { ccLives: { w: 3, b: 2 } },
      pendingCCShotsArmed: [],
    });
  });
});
