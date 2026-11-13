import { describe, expect, it } from "vitest";

import {
  adjutant,
  endScTurn,
  parseScFen,
  placementToMap,
  UNIT_COST,
  type ScAction,
} from "../index";
import { squareColor } from "../ai/strategies/economy";

describe("adjutant", () => {
  it("stacks Marine gas + classical as two steps ahead (not a lone gas step)", () => {
    // Black Marine on e6 (not start rank — no free classical double). Gas enables
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
          kind: "stimStep",
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
    // Black Marine on e7 — classical e7→e5 is legal; stack should not win.
    const snap = parseScFen(
      "SCFEN|4k3/4p3/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions ?? [];
    expect(actions.some((a) => a.kind === "stimStep")).toBe(false);
  });

  it("stacks Command Center spawn + Command Center classical in the same turn", () => {
    // Open board, minerals for a Marine, gas for spawn. Spawn alone or Command Center stroll
    // alone should lose to doing both (scores add).
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "deploy" && a.timing === "B")).toBe(true);
    expect(
      actions.some(
        (a) => a.timing === "C" && a.kind === "classical" && a.from === "e8",
      ),
    ).toBe(true);
    expect(plan.spendMinerals).toEqual({ color: "b", amount: expect.any(Number) });

    const spawnTo = actions.find((a) => a.kind === "deploy")?.to;
    const ccTo = actions.find((a) => a.timing === "C")?.to;
    expect(spawnTo).toBeTruthy();
    expect(ccTo).toBeTruthy();
    expect(ccTo).not.toBe(spawnTo);

    const resolved = endScTurn(plan.snapshot, { skipTurnStartChecks: true });
    const map = placementToMap(resolved.next.placement);
    expect(map.get(spawnTo!)).toMatchObject({ color: "b" });
    expect(map.get(ccTo!)).toEqual({ type: "k", color: "b" });
    expect(map.get("e8")).toBeUndefined();
  });

  it("plants a Spider Mine with a Hoverbike on the d4–e5 hub", () => {
    // Hoverbike on e5 asserts hub; White Command Center on e1 is outside N vision → seek.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/4n3/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "spiderMine" && a.from === "e5")).toBe(
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
    expect(actions.some((a) => a.kind === "spiderMine" && a.from === "a5")).toBe(
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
    expect(actions.some((a) => a.kind === "spiderMine")).toBe(false);
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
    // Tank on d4 — expand/develop map control via siege pack.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/3r4/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "siegeMode" && a.from === "d4")).toBe(
      true,
    );
  });

  it("warps a threatened BattleShip to safety (tacticalJump)", () => {
    // Turn 21 → gas tier 3 (Tactical Jump costs 3). White Tank eyes d8.
    const snap = parseScFen(
      "SCFEN|3qk3/8/8/8/8/8/8/3RK3|21|33|P|G:33:33|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    const warp = actions.find((a) => a.kind === "tacticalJump");
    expect(warp).toMatchObject({ timing: "B", from: "d8" });
    expect(warp?.to).toBeTruthy();
    expect(warp!.to).not.toBe("d8");
  });

  it("stacks Charon snipe (B) with a second classical strike (C)", () => {
    // Turn 11 → gas 2. Mecha f8 → unique *white* BattleShip a3; Hoverbike g4×h2.
    const snap = parseScFen(
      "SCFEN|5b1k/8/8/8/6n1/Q7/7p/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "charonMissiles" && a.to === "a3")).toBe(
      true,
    );
    // Same-turn second strike (gas spent on Charon; classical still queues).
    expect(actions.some((a) => a.timing === "C" && a.kind === "classical")).toBe(
      true,
    );
  });

  it("takes the centre hub before a distant Marine push", () => {
    // expand — Marine on a4 is 3 steps out (no near-promote rush); Hoverbike takes hub.
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

  it("seeks the Command Center toward a visible Marine clump (siege vision)", () => {
    // seek — hub Tank d4 lights b2–d2 Marines; Command Center on h1 fogged. Packing 9×9
    // would reveal the Command Center — prefer siege over a quiet Command Center stroll.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/3r4/8/1ppp4/7K|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions.some((a) => a.kind === "siegeMode" && a.from === "d4")).toBe(
      true,
    );
  });

  it("seeks toward a visible enemy deploy before a distant Marine push", () => {
    // seek — hub Hoverbike e5; White Hoverbike on c4 (lit). Distant a4 Marine (3 steps).
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

  it("seeks along a visible enemy Marine file (Command Center deploy corridor)", () => {
    // seek — hub Hoverbike e5 lights White Marine on c4; distant a4 is not a rush.
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

  it("as White seeks along a visible black Marine file toward ranks 7–8", () => {
    // Hub Hoverbike e4 lights black Marine on c5; white Marine on a5 is 3 steps out.
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

  it("hunts the visible Command Center once map control is asserted", () => {
    // hunt — hub Hoverbike e5 lights d3; Tank f3→e3 checks (no near-promote bait).
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

  it("rushes gas+move when a Marine is 2 steps from promotion", () => {
    // Black Marine e3 → B e3→e2 + C rewrite e2→e1 promote. Command Center off the file.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/4n3/8/4p3/8/3K4|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timing: "B",
          kind: "stimStep",
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
    // Black Marine e2→e1; hub Hoverbike on e5 would rather mine — rush wins.
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
          (a.kind === "classical" || a.kind === "stimStep"),
      ),
    ).toBe(true);
  });

  it("always takes an equal-material trade when in range", () => {
    // Black Hoverbike d4 × white Hoverbike e2 — same cost → attack over mine/quiet.
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

  it("defends a threatened non-BattleShip by fleeing to safety", () => {
    // White Tank pins the a-file; black Hoverbike on a3 can hop off to safety.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/n7/8/R3K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    const flee = actions.find((a) => a.kind === "classical" && a.from === "a3");
    expect(flee).toBeTruthy();
    // Leave the Tank's a-file (a2/a4 still burn).
    expect(flee!.to?.[0]).not.toBe("a");
  });

  it("spawns a BattleShip when the mineral bank can afford one", () => {
    // Already has a Mecha — heavy preference may pick BattleShip.
    const snap = parseScFen(
      "SCFEN|4kb2/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a) => a.color === "b" && a.kind === "deploy",
    );
    expect(spawn).toMatchObject({ unit: "q" });
    expect(plan.spendMinerals).toEqual({ color: "b", amount: 9 });
  });

  it("spawns a Tank when bank covers Tank but not BattleShip", () => {
    const snap = parseScFen(
      "SCFEN|4kb2/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 5 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a) => a.color === "b" && a.kind === "deploy",
    );
    expect(spawn).toMatchObject({ unit: "r" });
    expect(plan.spendMinerals).toEqual({ color: "b", amount: 5 });
  });

  it("still spawns light units when bank is below Tank cost", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 3 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a): a is Extract<ScAction, { timing: "B" | "F" }> =>
        a.color === "b" && a.kind === "deploy",
    );
    expect(spawn?.unit).toMatch(/^[pnb]$/);
    expect(plan.spendMinerals?.amount).toBeLessThan(UNIT_COST.r);
  });

  it("prioritises the first Mecha before BattleShips/Tanks", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a) => a.color === "b" && a.kind === "deploy",
    );
    expect(spawn).toMatchObject({ unit: "b" });
    expect(plan.spendMinerals).toEqual({ color: "b", amount: 3 });
  });

  it("spawns more Mechas when an enemy BattleShip is visible", () => {
    const snap = parseScFen(
      "SCFEN|4kb2/8/8/3Q4/4n3/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a) => a.color === "b" && a.kind === "deploy",
    );
    expect(spawn).toMatchObject({ unit: "b" });
    expect(plan.spendMinerals).toEqual({ color: "b", amount: 3 });
  });

  it("spawns a Tank instead of a third Hoverbike once two Hoverbikes exist", () => {
    const snap = parseScFen(
      "SCFEN|4kb2/8/2n5/3n4/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 5 });
    const spawn = plan.snapshot.queue?.actions.find(
      (a) => a.color === "b" && a.kind === "deploy",
    );
    expect(spawn).toMatchObject({ unit: "r" });
    expect(plan.spendMinerals).toEqual({ color: "b", amount: 5 });
  });

  it("trades Marine-for-Marine when Marines are file-clustered", () => {
    // Seven black Marines packed on files c–e (3 consecutive) → congested cluster.
    // Prefer d6×e5 (Marine trade) over quieter moves / non-Marine captures.
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

  it("sneak-checks with a Hoverbike onto an uncovered square", () => {
    // Nb4→d3 checks Ke1; d3 is not covered by the lone Command Center.
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

  it("survives back-rank check by deploy Tank + capture (material win)", () => {
    // Rh8 checks Ke8 — spawn Tank on f8 then take the checker.
    const snap = parseScFen(
      "SCFEN|4k2R/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const plan = adjutant(snap, { storedFor: () => 12 });
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timing: "B",
          kind: "deploy",
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

  it("steps the Command Center off the back rank when a file-Tank threatens check", () => {
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
  // Black CC e8; dark-square Mechas b6 + d4. A visible BattleShip on a5 drives
  // mecha demand (MECHA_VS_BATTLESHIP) but sits on no dark-ring diagonal, so the
  // per-color cap must hold: any Mecha drop lands light.
  const DARK_PAIR = "SCFEN|4k3/8/1b6/Q7/3b4/8/8/4K3|5|33|P|G:11:11|B:0:12|Q:w:;b:";

  const blackSpawns = (scfen: string) => {
    const plan = adjutant(parseScFen(scfen), { storedFor: () => 12 });
    return (plan.snapshot.queue?.actions ?? []).filter(
      (a) => a.color === "b" && a.kind === "deploy",
    );
  };

  it("caps same-color mechas at two", () => {
    const mechas = blackSpawns(DARK_PAIR).filter(
      (a) => (a as { unit?: string }).unit === "b",
    );
    expect(mechas.length).toBeGreaterThan(0);
    for (const b of mechas) {
      expect(squareColor((b as { to: Parameters<typeof squareColor>[0] }).to)).toBe("light");
    }
  });

  it("caps total mechas at four even with a BattleShip in sight", () => {
    // b6 + d4 dark, a4 + g2 light.
    const spawns = blackSpawns(
      "SCFEN|4k3/8/1b6/8/b2b4/8/6b1/4K3|5|33|P|G:11:11|B:0:12|Q:w:;b:",
    );
    expect(spawns.some((a) => (a as { unit?: string }).unit === "b")).toBe(false);
  });

  it("admits the dark-square Mecha that instantly answers the BattleShip", () => {
    // Light ring squares held by own Marines, dark pair complete — but a Mecha
    // dropped on e7 takes the BattleShip on c5, so the exception admits exactly
    // that square (and it is queued).
    const spawns = blackSpawns(
      "SCFEN|4k3/3p1p2/1b6/2Q5/3b4/8/8/4K3|5|33|P|G:11:11|B:0:3|Q:w:;b:",
    );
    const mechas = spawns.filter((a) => (a as { unit?: string }).unit === "b");
    expect(mechas.length).toBeGreaterThan(0);
    for (const b of mechas) {
      expect((b as { to?: string }).to).toBe("e7");
    }
  });
});
