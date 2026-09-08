/**
 * Strategic ally-crush deploys — the Command Center may replace its own
 * non-king ring units. The scorer prices the victim (no free self-eating)
 * and only outbids an empty square for defense: urgent-runner answers,
 * ring-full heavier-guard upgrades, and fresh cover on lit, threatened own
 * passed pawns / ships.
 * // SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-economy.puml
 */
import { describe, expect, it } from "vitest";

import { parseScFen, UNIT_COST } from "../../index";
import { strategicAdjutant } from "../../ai/strategic";
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
        a.color === opts.color && a.kind === "spawn",
    ) ?? []
  );
};

describe("strategic ally-crush deploys", () => {
  it("never eats its own units for free — empty squares win when quiet", () => {
    // Black CC e8, own pawn d7, nothing threatening, bank for anything.
    const spawns = spawnsFor("SCFEN|4k3/3p4/8/8/8/8/8/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "b",
      stored: 12,
      kvs: seedKnownVsSeen(),
    });
    expect(spawns.length).toBeGreaterThan(0);
    // The ally pawn square is never the drop.
    expect(spawns.every((a) => a.to !== "d7")).toBe(true);
  });

  it("never generates a king crush, even face-to-face", () => {
    // White CC e1 with the black king standing on its ring.
    const spawns = spawnsFor("SCFEN|8/8/8/8/8/8/4k3/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "w",
      stored: 12,
      kvs: seedKnownVsSeen(),
    });
    expect(spawns.every((a) => a.to !== "e2")).toBe(true);
  });

  it("ring full + defending: upgrades the cheapest ally in place", () => {
    // Black ring full (pawns d7/e7/f7, rook d8, queen f8), hidden material.
    const spawns = spawnsFor("SCFEN|3rkq2/3ppp2/8/8/8/8/8/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "b",
      stored: 12,
      kvs: combineKnownVsSeen(9, 2, 0),
    });
    expect(spawns.length).toBeGreaterThan(0);
    for (const s of spawns) {
      // Every ring square is occupied, so every drop is a crush — and the
      // victim is always a cheap pawn, never the rook or the ship.
      expect(["d7", "e7", "f7"]).toContain(s.to);
      expect(UNIT_COST[s.unit!] > UNIT_COST.p).toBe(true);
    }
  });

  it("answers an urgent runner through its own blocker without eating it", () => {
    // Black pawn d3 heading for d1; our white pawn holds its front (d2).
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
    // Own queen d4 under black rook a4; own pawn d2; ring-to-d4 ray is clear.
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
    // Black runner d3 held only by our pawn on d2 — and our queen d4 is lit
    // and threatened down the file a d2 rook would cover. The race wins: the
    // blocker stands.
    const spawns = spawnsFor("SCFEN|4k3/8/8/8/r2Q4/3p4/3P4/4K3|10|33|P|G:11:11|Q:w:;b:", {
      color: "w",
      stored: 12,
      kvs: combineKnownVsSeen(9, 2, 0),
    });
    expect(spawns.every((a) => a.to !== "d2")).toBe(true);
  });

  it("never replaces a non-sole blocker to re-buy the same blockade", () => {
    // Black runner d3 is contained (not passed) behind our pawn d2 AND our
    // rook d1: neither is the sole blocker, so the abandon charge stays
    // holstered — but the runner answer must not pay out on ally-held squares
    // either, or the Command Center eats its own pawn to drop a ship onto an
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
    // Black pawn d2 sits on our ring (and checks the king): the runner answer
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
