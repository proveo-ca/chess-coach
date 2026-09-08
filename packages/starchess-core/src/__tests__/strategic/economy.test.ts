import { describe, expect, it } from "vitest";

import { parseScFen } from "../../index";
import { buildStrategicCtx, strategicAdjutant } from "../../ai/strategic";
import { combineKnownVsSeen, seedKnownVsSeen } from "../../ai/strategic/intel";
import { economy as strategicEconomy } from "../../ai/strategic/strategies/economy";
import { squareColor } from "../../ai/strategies/economy";

const openSnap = (turn = 10) =>
  parseScFen(
    `SCFEN|4k3/8/8/8/8/8/8/4K3|${turn}|33|P|G:11:11|Q:w:;b:`,
  );

// Board is empty except both kings, so:
//   ourBoard = 0, countedForUs = ourBoard + captured.
// winning ⇔ captured > known ⇔ captured > 12 on turn 10.
// nothing hidden ⇔ gap ≤ 0 ⇔ scouted ≥ known + captured = 27.
const WINNING_CLEAN = combineKnownVsSeen(12, 27, 15);

describe("strategic economy (known-vs-seen dials)", () => {
  it("deploys a BattleShip to close the game when winning and nothing hidden", () => {
    const snap = openSnap(10);
    const plan = strategicAdjutant(snap, {
      color: "b",
      storedFor: () => 12,
      kvs: WINNING_CLEAN,
    });
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "spawn" && a.unit === "q")).toBe(true);
  });

  it("saves light drops while the bank gathers toward a ship", () => {
    // Winning, nothing hidden, but the bank cannot pay for a queen yet —
    // pawn / hoverbike drops are suppressed so the Command Center saves.
    const snap = openSnap(10);
    const plan = strategicAdjutant(snap, {
      color: "b",
      storedFor: () => 4,
      kvs: WINNING_CLEAN,
    });
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    const spawns = actions.filter((a) => a.kind === "spawn");
    expect(spawns.every((a) => a.unit !== "p" && a.unit !== "n")).toBe(true);
  });

  it("reacts to hidden enemy material with defense, not a saving spree", () => {
    // gap positive (cheese window, turn ≥ 7) — defense outranks saving: it
    // must never spend the bank toward a queen while hidden material exists.
    const snap = openSnap(7);
    const plan = strategicAdjutant(snap, {
      color: "b",
      storedFor: () => 8,
      kvs: combineKnownVsSeen(9, 2, 0), // gap 7 → hidden
    });
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    const spawns = actions.filter((a) => a.kind === "spawn");
    expect(spawns.every((a) => a.unit !== "q")).toBe(true);
  });

  it("caps same-color mechas at two at plan level", () => {
    // Black dark pair b6 + d4; any bishop drop must land light.
    const snap = parseScFen("SCFEN|4k3/8/1b6/8/3b4/8/8/4K3|10|33|P|G:11:11|Q:w:;b:");
    const plan = strategicAdjutant(snap, {
      color: "b",
      storedFor: () => 12,
      kvs: seedKnownVsSeen(),
    });
    const bishops = (plan.snapshot.queue?.actions ?? []).filter(
      (a) => a.color === "b" && a.kind === "spawn" && (a as { unit?: string }).unit === "b",
    );
    for (const b of bishops) {
      expect(squareColor((b as { to: Parameters<typeof squareColor>[0] }).to)).toBe("light");
    }
  });

  it("caps total mechas at four at plan level", () => {
    // b6 + d4 dark, a4 + g2 light.
    const snap = parseScFen("SCFEN|4k3/8/1b6/8/b2b4/8/6b1/4K3|10|33|P|G:11:11|Q:w:;b:");
    const plan = strategicAdjutant(snap, {
      color: "b",
      storedFor: () => 12,
      kvs: seedKnownVsSeen(),
    });
    const bishops = (plan.snapshot.queue?.actions ?? []).filter(
      (a) => a.color === "b" && a.kind === "spawn" && (a as { unit?: string }).unit === "b",
    );
    expect(bishops).toHaveLength(0);
  });

  it("keeps the instant queen-capture bishop in the candidate pool", () => {
    // Dark pair complete, but a bishop dropped on e7 takes the queen on c5:
    // the per-color gate admits exactly that square.
    const build = (placement: string) => {
      const ctx = buildStrategicCtx(parseScFen(placement), {
        color: "b",
        storedFor: () => 3,
        kvs: seedKnownVsSeen(),
      });
      if (!ctx) throw new Error("no ctx");
      return strategicEconomy
        .generate!(ctx)
        .map((c) => c.actions[0])
        .filter((a) => a.kind === "spawn" && (a as { unit?: string }).unit === "b")
        .map((a) => (a as { to?: string }).to);
    };
    const withQueen = build("SCFEN|4k3/8/1b6/2Q5/3b4/8/8/4K3|10|33|P|G:11:11|Q:w:;b:");
    expect(withQueen).toContain("e7");
    const calm = build("SCFEN|4k3/8/1b6/8/3b4/8/8/4K3|10|33|P|G:11:11|Q:w:;b:");
    expect(calm.filter((to) => to != null && squareColor(to as never) === "dark")).toEqual([]);
  });

  it("uses a host-threaded accumulator when provided and seeds otherwise", () => {
    const snap = openSnap(10);
    const threaded = strategicAdjutant(snap, {
      color: "b",
      storedFor: () => 12,
      kvs: WINNING_CLEAN,
    });
    expect(
      threaded.snapshot.queue?.actions.some((a) => a.kind === "spawn"),
    ).toBe(true);

    const seeded = strategicAdjutant(snap, {
      color: "b",
      storedFor: () => 12,
      kvs: seedKnownVsSeen(),
    });
    expect(seeded.snapshot.queue?.actions.some((a) => a.kind === "spawn")).toBe(
      true,
    );
  });
});