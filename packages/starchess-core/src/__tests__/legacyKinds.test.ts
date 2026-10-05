import { describe, expect, it } from "vitest";

import { formatScFen, historyFromRecord, parseScFen } from "../index";
import { currentKind, migrateLegacyNames } from "../scfen/legacyKinds";

describe("special kinds renamed off the chess words", () => {
  it("keeps prototype-shaped unknown names as data", () => {
    for (const name of ["constructor", "toString", "__proto__"]) expect(currentKind(name)).toBe(name);
    expect(migrateLegacyNames({ kind: "constructor", constructor: "data", toString: "label" })).toEqual({
      kind: "constructor", constructor: "data", toString: "label",
    });
  });
  it("copies own prototype-shaped JSON fields without changing ordinary object prototypes", () => {
    const input = JSON.parse('{"__proto__":{"polluted":true},"items":[{"__proto__":{"nested":true},"constructor":"data"}]}');
    const result = migrateLegacyNames(input);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.items[0])).toBe(Object.prototype);
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(Object.hasOwn(result.items[0], "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(result, "__proto__")).toMatchObject({ enumerable: true, configurable: true, writable: true, value: { polluted: true } });
    expect(JSON.parse(JSON.stringify(result))).toEqual(input);
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });
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
