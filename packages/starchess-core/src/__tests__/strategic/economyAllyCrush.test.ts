/**
 * Strategic ally-crush deploys — the Command Center may replace its own
 * non-Command Center ring units. The scorer prices the victim (no free self-eating)
 * and only outbids an empty square for defense: urgent-runner answers,
 * ring-full heavier-guard upgrades, and fresh cover on lit, threatened own
 * passed Marines / ships.
 * // SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-economy.puml
 */
import { describe, expect, it } from "vitest";

import { parseScFen, placementToMap, UNIT_COST } from "../../index";
import { strategicAdjutant, strategicCandidates } from "../../ai/strategic";
import { combineKnownVsSeen, seedKnownVsSeen } from "../../ai/strategic/intel";
import type { ScAction } from "../../index";

const spawnsFor = (
  scfen: string,
  opts: { color: "w" | "b"; stored: number; kvs: Parameters<typeof strategicAdjutant>[1]["kvs"] },
) => {
  const plan = strategicAdjutant(parseScFen(scfen), {
    color: opts.color,
    storedFor: () => opts.stored,
    kvs: opts.kvs,
  });
  return (
    plan.snapshot.queue?.actions.filter(
      (a): a is Extract<ScAction, { timing: "B" | "F" }> =>
        a.color === opts.color && a.kind === "deploy",
    ) ?? []
  );
};

describe("strategic ally-crush deploys", () => {
  it("never eats its own units for free — empty squares win when quiet", () => {
    // Black CC e8, own Marine d7, nothing threatening, bank for anything.
    const spawns = spawnsFor("SCFEN|4k3/3p4/8/8/8/8/8/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "b",
      stored: 12,
      kvs: seedKnownVsSeen(),
    });
    expect(spawns.length).toBeGreaterThan(0);
    // The ally Marine square is never the drop.
    expect(spawns.every((a) => a.to !== "d7")).toBe(true);
  });

  it("never generates a Command Center crush, even face-to-face", () => {
    // White CC e1 with the black Command Center standing on its ring.
    const spawns = spawnsFor("SCFEN|8/8/8/8/8/8/4k3/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "w",
      stored: 12,
      kvs: seedKnownVsSeen(),
    });
    expect(spawns.every((a) => a.to !== "e2")).toBe(true);
  });

  it("ring full + defending: upgrades the cheapest ally in place", () => {
    // Black ring full (Marines d7/e7/f7, Tank d8, BattleShip f8), hidden material.
    const spawns = spawnsFor("SCFEN|3rkq2/3ppp2/8/8/8/8/8/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "b",
      stored: 12,
      kvs: combineKnownVsSeen(9, 2, 0),
    });
    expect(spawns.length).toBeGreaterThan(0);
    for (const s of spawns) {
      // Every ring square is occupied, so every drop is a crush — and the
      // victim is always a cheap Marine, never the Tank or the ship.
      expect(["d7", "e7", "f7"]).toContain(s.to);
      expect(UNIT_COST[s.unit!] > UNIT_COST.p).toBe(true);
    }
  });

  it("answers an urgent runner through its own blocker without eating it", () => {
    // Black Marine d3 heading for d1; our white Marine holds its front (d2).
    const spawns = spawnsFor("SCFEN|4k3/8/8/8/8/3p4/3P4/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "w",
      stored: 12,
      kvs: seedKnownVsSeen(),
    });
    expect(spawns.length).toBeGreaterThan(0);
    // The answer lands on the runner's path/front — and the sole blocker on
    // d2 is preserved (abandon charge), so the drop covers from d1.
    expect(spawns.some((a) => a.to === "d1" || a.to === "d2")).toBe(true);
    expect(spawns.every((a) => a.to !== "d2")).toBe(true);
  });

  it("shields a lit, threatened own ship by replacing a cheap guard", () => {
    // Own BattleShip d4 under black Tank a4; own Marine d2; ring-to-d4 ray is clear.
    const spawns = spawnsFor("SCFEN|4k3/8/8/8/r2Q4/8/3P4/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "w",
      stored: 6,
      kvs: combineKnownVsSeen(9, 2, 0),
    });
    const crush = spawns.find((a) => a.to === "d2");
    expect(crush).toBeDefined();
    expect(crush!.unit).toBe("r");
  });

  it("holds fire when threatened but not in a defending posture", () => {
    // Same threat as above, but a quiet ledger (no hidden gap, not winning):
    // without a defending posture the shield stays holstered.
    const spawns = spawnsFor("SCFEN|4k3/8/8/8/r2Q4/8/3P4/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "w",
      stored: 6,
      kvs: seedKnownVsSeen(),
    });
    expect(spawns.every((a) => a.to !== "d2")).toBe(true);
  });

  it("never eats a sole blocker to shield elsewhere", () => {
    // Black runner d3 held only by our Marine on d2 — and our BattleShip d4 is lit
    // and threatened down the file a d2 Tank would cover. The race wins: the
    // blocker stands.
    const spawns = spawnsFor("SCFEN|4k3/8/8/8/r2Q4/3p4/3P4/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "w",
      stored: 12,
      kvs: combineKnownVsSeen(9, 2, 0),
    });
    expect(spawns.every((a) => a.to !== "d2")).toBe(true);
  });

  it("never replaces a non-sole blocker to re-buy the same blockade", () => {
    // Black runner d3 is contained (not passed) behind our Marine d2 AND our
    // Tank d1: neither is the sole blocker, so the abandon charge stays
    // holstered — but the runner answer must not pay out on ally-held squares
    // either, or the Command Center eats its own Marine to drop a ship onto an
    // already-answered square.
    const spawns = spawnsFor("SCFEN|4k3/8/8/8/8/3p4/3PR3/3RK3|10|33|P|G:11:11|Q:w:;b:", {
      color: "w",
      stored: 12,
      kvs: seedKnownVsSeen(),
    });
    expect(spawns.length).toBeGreaterThan(0);
    // Empty ring squares (f1/f2) outbid every crush; both blockers stand.
    expect(spawns.every((a) => a.to !== "d2" && a.to !== "d1")).toBe(true);
  });

  it("still crushes an enemy runner standing on the ring", () => {
    // Black Marine d2 sits on our ring (and checks the Command Center): the runner answer
    // pays on enemy-held squares — suppression applies to ally-held only.
    const spawns = spawnsFor("SCFEN|4k3/8/8/8/8/8/3p4/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "w",
      stored: 12,
      kvs: seedKnownVsSeen(),
    });
    expect(spawns.length).toBeGreaterThan(0);
    expect(spawns.some((a) => a.to === "d2")).toBe(true);
  });

  it("leaves the same guard alone when the ship is safe", () => {
    // Same board minus the attacker: no threat, no shield, empty preferred.
    const spawns = spawnsFor("SCFEN|4k3/8/8/8/3Q4/8/3P4/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "w",
      stored: 6,
      kvs: combineKnownVsSeen(9, 2, 0),
    });
    expect(spawns.every((a) => a.to !== "d2")).toBe(true);
  });
});

describe("same-type crush census", () => {
  /**
   * A same-type ally replace is an identical board minus bank + gas, so
   * generation skips it outright (all types, not just marines). This battery
   * plays the strategic adjutant across quiet / runner-pressure / hot-CC /
   * ring-full / winning / bank-starved postures for both colors and asserts no
   * committed spawn — and no generated single — replaces an ally with its own
   * type. Per-row commit expectations keep quiet rows from passing vacuously;
   * the bank-starved full ring expects no spawn at all (gas correctly unspent
   * rather than burned on an identical board).
   */
  const BATTERY: {
    scfen: string;
    color: "w" | "b";
    stored: number;
    kvs: Parameters<typeof spawnsFor>[1]["kvs"];
    expectSpawn: boolean;
  }[] = [
    // Quiet, own marine on ring, empties available.
    { scfen: "SCFEN|4k3/3p4/8/8/8/8/8/4K3|10|33|P|G:11:11|Q:w:;b:", color: "b", stored: 12, kvs: seedKnownVsSeen(), expectSpawn: true },
    // Runner pressure, double-blocked (white to move).
    { scfen: "SCFEN|4k3/8/8/8/8/3p4/3PR3/3RK3|10|33|P|G:11:11|Q:w:;b:", color: "w", stored: 12, kvs: seedKnownVsSeen(), expectSpawn: true },
    // Runner pressure mirrored (black to move).
    { scfen: "SCFEN|3rk3/3p4/3P4/8/8/8/8/4K3|10|33|P|G:11:11|Q:w:;b:", color: "b", stored: 12, kvs: seedKnownVsSeen(), expectSpawn: true },
    // Hot CC with a marine on the ring.
    { scfen: "SCFEN|k3r3/8/8/8/8/8/3P4/4K3|10|33|P|G:11:11|Q:w:;b:", color: "w", stored: 12, kvs: seedKnownVsSeen(), expectSpawn: true },
    // Ring full of marines, quiet.
    { scfen: "SCFEN|4k3/8/8/8/8/8/3PPP2/3PKP2|10|33|P|G:11:11|Q:w:;b:", color: "w", stored: 12, kvs: seedKnownVsSeen(), expectSpawn: true },
    // Ring full of marines, hidden-material defense.
    { scfen: "SCFEN|4k3/8/8/8/8/8/3PPP2/3PKP2|10|33|P|G:11:11|Q:w:;b:", color: "w", stored: 12, kvs: combineKnownVsSeen(9, 2, 0), expectSpawn: true },
    // Winning with marines sheltering the Command Center.
    { scfen: "SCFEN|4k3/8/8/8/8/8/3PP3/4K3|10|33|P|G:11:11|Q:w:;b:", color: "w", stored: 12, kvs: combineKnownVsSeen(12, 27, 15), expectSpawn: true },
    // Shield path: own ship c3 threatened, own marine d2 covering it, bank for
    // marines only — the shield bonus must not buy a same-type replace.
    { scfen: "SCFEN|4k3/8/8/8/1b6/2Q5/3P4/4K3|10|33|P|G:11:11|Q:w:;b:", color: "w", stored: 1, kvs: combineKnownVsSeen(9, 2, 0), expectSpawn: true },
    // Ring full, bank for marines only: nothing worth deploying — hold gas.
    { scfen: "SCFEN|4k3/8/8/8/8/8/3PPP2/3PKP2|10|33|P|G:11:11|Q:w:;b:", color: "w", stored: 1, kvs: seedKnownVsSeen(), expectSpawn: false },
  ];

  it("commits and generates zero same-type ally crushes across the battery", () => {
    let sameType = 0;
    for (const spot of BATTERY) {
      const before = placementToMap(parseScFen(spot.scfen).placement);
      const spawns = spawnsFor(spot.scfen, spot);
      expect(spawns.length > 0).toBe(spot.expectSpawn);
      for (const a of spawns) {
        const occ = before.get(a.to!);
        if (a.unit !== undefined && occ?.type === a.unit && occ.color === spot.color) {
          sameType += 1;
        }
      }
      // Generation level: no emitted single replaces an ally with its own type.
      const listed = strategicCandidates(parseScFen(spot.scfen), {
        color: spot.color,
        storedFor: () => spot.stored,
        kvs: spot.kvs,
      });
      for (const c of listed?.candidates ?? []) {
        const [first] = c.actions;
        if (!first || first.kind !== "deploy" || first.timing !== "B" || !first.to) continue;
        const occ = before.get(first.to);
        if (first.unit !== undefined && occ?.type === first.unit && occ.color === spot.color) {
          sameType += 1;
        }
      }
    }
    expect(sameType).toBe(0);
  });
});
