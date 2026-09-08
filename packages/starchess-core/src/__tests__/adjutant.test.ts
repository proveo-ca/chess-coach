import { describe, expect, it } from "vitest";

import {
  adjutant,
  endScTurn,
  parseScFen,
  placementToMap,
  UNIT_COST,
} from "../index";
import { squareColor } from "../ai/strategies/economy";

describe("adjutant", () => {
  it("stacks pawn gas + classical as two steps ahead (not a lone gas step)", () => {
    // Black pawn on e6 (not start rank — no free classical double). Gas enables
    // e6→e5 (B) + rewrite C → e5→e4. Prefer that over a 1-step classical.
    const snap = parseScFen(
      "SCFEN|4k3/8/4p3/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions ?? [];
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timing: "B",
          kind: "pawnDouble",
          color: "b",
          from: "e6",
          to: "e5",
        }),
        expect.objectContaining({
          timing: "C",
          kind: "classical",
          color: "b",
          from: "e6",
          to: "e5",
        }),
      ]),
    );

    const resolved = endScTurn(plan.snapshot, { skipTurnStartChecks: true });
    const map = placementToMap(resolved.next.placement);
    expect(map.get("e4")).toEqual({ type: "p", color: "b" });
    expect(map.get("e6")).toBeUndefined();
    expect(map.get("e5")).toBeUndefined();
  });

  it("does not spend gas when a free classical double already reaches far", () => {
    // Black pawn on e7 — classical e7→e5 is legal; stack should not win.
    const snap = parseScFen(
      "SCFEN|4k3/4p3/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions ?? [];
    expect(actions.some((a) => a.kind === "pawnDouble")).toBe(false);
  });

  it("stacks Command Center spawn + King classical in the same turn", () => {
    // Open board, minerals for a pawn, gas for spawn. Spawn alone or King stroll
    // alone should lose to doing both (scores add).
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "spawn" && a.timing === "B")).toBe(true);
    expect(
      actions.some(
        (a) => a.timing === "C" && a.kind === "classical" && a.from === "e8",
      ),
    ).toBe(true);
    expect(plan.spendMinerals).toEqual({ color: "b", amount: expect.any(Number) });

    const spawnTo = actions.find((a) => a.kind === "spawn")?.to;
    const kingTo = actions.find((a) => a.timing === "C")?.to;
    expect(spawnTo).toBeTruthy();
    expect(kingTo).toBeTruthy();
    expect(kingTo).not.toBe(spawnTo);

    const resolved = endScTurn(plan.snapshot, { skipTurnStartChecks: true });
    const map = placementToMap(resolved.next.placement);
    expect(map.get(spawnTo!)).toMatchObject({ color: "b" });
    expect(map.get(kingTo!)).toEqual({ type: "k", color: "b" });
    expect(map.get("e8")).toBeUndefined();
  });

  it("plants a Spider Mine with a Hoverbike on the d4–e5 hub", () => {
    // Knight on e5 asserts hub; White King on e1 is outside N vision → seek.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/4n3/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "knightMine" && a.from === "e5")).toBe(
      true,
    );
  });

  it("plants a Spider Mine on the a-file only after the hub is mined", () => {
    // Hub already mined (e5); Hoverbike on a5 → flank corridor.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/n7/8/8/8/4K3|0|33|P|G:11:11|M:w:;b:e5|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "knightMine" && a.from === "a5")).toBe(
      true,
    );
  });

  it("does not mine the a-file while the hub is still free", () => {
    // No hub mine yet — hop toward centre rather than planting on a5.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/n7/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "knightMine")).toBe(false);
    expect(
      actions.some(
        (a) =>
          a.kind === "classical" &&
          a.from === "a5" &&
          (a.to === "b3" || a.to === "c4" || a.to === "c6" || a.to === "b7"),
      ),
    ).toBe(true);
  });

  it("packs a Siege Tank on the centre hub", () => {
    // Rook on d4 — expand/develop map control via siege pack.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/3r4/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "rookSiege" && a.from === "d4")).toBe(
      true,
    );
  });

  it("warps a threatened BattleShip to safety (queenWarp)", () => {
    // Turn 21 → gas tier 3 (Tactical Jump costs 3). White rook eyes d8.
    const snap = parseScFen(
      "SCFEN|3qk3/8/8/8/8/8/8/3RK3|21|33|P|G:33:33|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    const warp = actions.find((a) => a.kind === "queenWarp");
    expect(warp).toMatchObject({ timing: "B", from: "d8" });
    expect(warp?.to).toBeTruthy();
    expect(warp!.to).not.toBe("d8");
  });

  it("stacks Charon snipe (B) with a second classical strike (C)", () => {
    // Turn 11 → gas 2. Bishop f8 → unique *white* queen a3; knight g4×h2.
    const snap = parseScFen(
      "SCFEN|5b1k/8/8/8/6n1/Q7/7p/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "bishopSnipe" && a.to === "a3")).toBe(
      true,
    );
    // Same-turn second strike (gas spent on Charon; classical still queues).
    expect(actions.some((a) => a.timing === "C" && a.kind === "classical")).toBe(
      true,
    );
  });

  it("takes the centre hub before a distant pawn push", () => {
    // expand — pawn on a4 is 3 steps out (no near-promote rush); knight takes hub.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/p7/2n5/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(
      actions.some(
        (a) =>
          a.kind === "classical" &&
          a.from === "c3" &&
          (a.to === "d5" || a.to === "e4"),
      ),
    ).toBe(true);
  });

  it("seeks the King toward a visible pawn clump (siege vision)", () => {
    // seek — hub rook d4 lights b2–d2 pawns; King on h1 fogged. Packing 9×9
    // would reveal the King — prefer siege over a quiet king stroll.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/3r4/8/1ppp4/7K|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "rookSiege" && a.from === "d4")).toBe(
      true,
    );
  });

  it("seeks toward a visible enemy deploy before a distant pawn push", () => {
    // seek — hub knight e5; White knight on c4 (lit). Distant a4 pawn (3 steps).
    const snap = parseScFen(
      "SCFEN|4k3/8/8/4n3/p1N5/8/8/7K|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(
      actions.some(
        (a) =>
          a.kind === "classical" &&
          a.from === "e5" &&
          (a.to === "c4" || a.to === "d3" || a.to === "c6" || a.to === "d7"),
      ),
    ).toBe(true);
  });

  it("seeks along a visible enemy pawn file (King deploy corridor)", () => {
    // seek — hub knight e5 lights White pawn on c4; distant a4 is not a rush.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/4n3/p1P5/8/8/7K|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(
      actions.some(
        (a) =>
          a.kind === "classical" &&
          a.from === "e5" &&
          (a.to === "c4" || a.to === "d3" || a.to === "c6"),
      ),
    ).toBe(true);
  });

  it("as White seeks along a visible black pawn file toward ranks 7–8", () => {
    // Hub knight e4 lights black pawn on c5; white pawn on a5 is 3 steps out.
    const snap = parseScFen(
      "SCFEN|k7/8/8/P1p5/4N3/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { color: "w" });
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "w") ?? [];
    expect(
      actions.some(
        (a) =>
          a.kind === "classical" &&
          a.from === "e4" &&
          (a.to === "c5" || a.to === "d6" || a.to === "c3"),
      ),
    ).toBe(true);
  });

  it("hunts the visible King once map control is asserted", () => {
    // hunt — hub knight e5 lights d3; rook f3→e3 checks (no near-promote bait).
    const snap = parseScFen(
      "SCFEN|4k3/8/8/4n3/8/3K1r2/8/8|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(
      actions.some(
        (a) => a.kind === "classical" && a.from === "f3" && a.to === "e3",
      ),
    ).toBe(true);
  });

  it("rushes gas+move when a pawn is 2 steps from promotion", () => {
    // Black pawn e3 → B e3→e2 + C rewrite e2→e1 promote. King off the file.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/4n3/8/4p3/8/3K4|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timing: "B",
          kind: "pawnDouble",
          from: "e3",
          to: "e2",
        }),
        expect.objectContaining({
          timing: "C",
          kind: "classical",
          from: "e3",
          to: "e2",
          promotion: "q",
        }),
      ]),
    );
  });

  it("prioritises finishing promotion from 1 step out over map control", () => {
    // Black pawn e2→e1; hub knight on e5 would rather mine — rush wins.
    // Gas-only B+promotion or classical C+promotion both finish the job.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/4n3/8/8/4p3/3K4|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(
      actions.some(
        (a) =>
          a.from === "e2" &&
          a.to === "e1" &&
          a.promotion != null &&
          (a.kind === "classical" || a.kind === "pawnDouble"),
      ),
    ).toBe(true);
  });

  it("always takes an equal-material trade when in range", () => {
    // Black knight d4 × white knight e2 — same cost → attack over mine/quiet.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/3n4/8/4N3/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(
      actions.some(
        (a) =>
          a.kind === "classical" && a.from === "d4" && a.to === "e2",
      ),
    ).toBe(true);
  });

  it("defends a threatened non-queen by fleeing to safety", () => {
    // White rook pins the a-file; black knight on a3 can hop off to safety.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/n7/8/R3K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    const flee = actions.find((a) => a.kind === "classical" && a.from === "a3");
    expect(flee).toBeTruthy();
    // Leave the rook's a-file (a2/a4 still burn).
    expect(flee!.to?.[0]).not.toBe("a");
  });

  it("spawns a queen when the mineral bank can afford one", () => {
    // Already has a bishop — heavy preference may pick queen.
    const snap = parseScFen(
      "SCFEN|4kb2/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a) => a.color === "b" && a.kind === "spawn",
    );
    expect(spawn).toMatchObject({ unit: "q" });
    expect(plan.spendMinerals).toEqual({ color: "b", amount: 9 });
  });

  it("spawns a rook when bank covers rook but not queen", () => {
    const snap = parseScFen(
      "SCFEN|4kb2/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 5 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a) => a.color === "b" && a.kind === "spawn",
    );
    expect(spawn).toMatchObject({ unit: "r" });
    expect(plan.spendMinerals).toEqual({ color: "b", amount: 5 });
  });

  it("still spawns light units when bank is below rook cost", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 3 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a) => a.color === "b" && a.kind === "spawn",
    );
    expect(spawn?.unit).toMatch(/^[pnb]$/);
    expect(plan.spendMinerals?.amount).toBeLessThan(UNIT_COST.r);
  });

  it("prioritises the first bishop before queens/rooks", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a) => a.color === "b" && a.kind === "spawn",
    );
    expect(spawn).toMatchObject({ unit: "b" });
    expect(plan.spendMinerals).toEqual({ color: "b", amount: 3 });
  });

  it("spawns more bishops when an enemy queen is visible", () => {
    const snap = parseScFen(
      "SCFEN|4kb2/8/8/3Q4/4n3/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a) => a.color === "b" && a.kind === "spawn",
    );
    expect(spawn).toMatchObject({ unit: "b" });
    expect(plan.spendMinerals).toEqual({ color: "b", amount: 3 });
  });

  it("spawns a rook instead of a third knight once two Hoverbikes exist", () => {
    const snap = parseScFen(
      "SCFEN|4kb2/8/2n5/3n4/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 5 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a) => a.color === "b" && a.kind === "spawn",
    );
    expect(spawn).toMatchObject({ unit: "r" });
    expect(plan.spendMinerals).toEqual({ color: "b", amount: 5 });
  });

  it("trades pawn-for-pawn when pawns are file-clustered", () => {
    // Seven black pawns packed on files c–e (3 consecutive) → congested cluster.
    // Prefer d6×e5 (pawn trade) over quieter moves / non-pawn captures.
    const snap = parseScFen(
      "SCFEN|4k3/2ppp3/2ppp3/2p1P3/8/3n4/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(
      actions.some(
        (a) => a.kind === "classical" && a.from === "d6" && a.to === "e5",
      ),
    ).toBe(true);
  });

  it("sneak-checks with a knight onto an uncovered square", () => {
    // Nb4→d3 checks Ke1; d3 is not covered by the lone king.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/1n6/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(
      actions.some(
        (a) => a.kind === "classical" && a.from === "b4" && a.to === "d3",
      ),
    ).toBe(true);
  });

  it("survives back-rank check by deploy rook + capture (material win)", () => {
    // Rh8 checks Ke8 — spawn rook on f8 then take the checker.
    const snap = parseScFen(
      "SCFEN|4k2R/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timing: "B",
          kind: "spawn",
          unit: "r",
          to: "f8",
        }),
        expect.objectContaining({
          timing: "C",
          kind: "classical",
          from: "f8",
          to: "h8",
        }),
      ]),
    );
    expect(plan.spendMinerals).toEqual({ color: "b", amount: 5 });
  });

  it("steps the King off the back rank when a file-rook threatens check", () => {
    // Rh1 can slide to h8 — leave rank 8 (e8→e7) rather than hang for mate.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K2R|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(
      actions.some(
        (a) => a.kind === "classical" && a.from === "e8" && a.to === "e7",
      ),
    ).toBe(true);
  });
});

describe("adjutant mecha deploy caps", () => {
  // Black CC e8; dark-square bishops b6 + d4. A visible queen on a5 drives
  // mecha demand (BISHOP_VS_QUEEN) but sits on no dark-ring diagonal, so the
  // per-color cap must hold: any bishop drop lands light.
  const DARK_PAIR = "SCFEN|4k3/8/1b6/Q7/3b4/8/8/4K3|5|33|P|G:11:11|B:0:12|Q:w:;b:";

  const blackSpawns = (scfen: string) => {
    const plan = adjutant(parseScFen(scfen), { storedFor: () => 12 });
    return (plan.snapshot.queue?.actions ?? []).filter(
      (a) => a.color === "b" && a.kind === "spawn",
    );
  };

  it("caps same-color mechas at two", () => {
    const bishops = blackSpawns(DARK_PAIR).filter(
      (a) => (a as { unit?: string }).unit === "b",
    );
    expect(bishops.length).toBeGreaterThan(0);
    for (const b of bishops) {
      expect(squareColor((b as { to: Parameters<typeof squareColor>[0] }).to)).toBe("light");
    }
  });

  it("caps total mechas at four even with a queen in sight", () => {
    // b6 + d4 dark, a4 + g2 light.
    const spawns = blackSpawns(
      "SCFEN|4k3/8/1b6/8/b2b4/8/6b1/4K3|5|33|P|G:11:11|B:0:12|Q:w:;b:",
    );
    expect(spawns.some((a) => (a as { unit?: string }).unit === "b")).toBe(false);
  });

  it("admits the dark-square bishop that instantly answers the queen", () => {
    // Light ring squares held by own pawns, dark pair complete — but a bishop
    // dropped on e7 takes the queen on c5, so the exception admits exactly
    // that square (and it is queued).
    const spawns = blackSpawns(
      "SCFEN|4k3/3p1p2/1b6/2Q5/3b4/8/8/4K3|5|33|P|G:11:11|B:0:3|Q:w:;b:",
    );
    const bishops = spawns.filter((a) => (a as { unit?: string }).unit === "b");
    expect(bishops.length).toBeGreaterThan(0);
    for (const b of bishops) {
      expect((b as { to?: string }).to).toBe("e7");
    }
  });
});
