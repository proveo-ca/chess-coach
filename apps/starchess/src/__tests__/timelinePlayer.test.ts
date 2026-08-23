import { describe, expect, it, vi } from "vitest";

import {
  addScAction,
  beginScTurn,
  endScTurn,
  parseScFen,
  placementToMap,
} from "@chess-coach/starchess-core";

import {
  playTimeline,
  projectResolveTimeline,
} from "~/presentation/timeline/timelinePlayer";
import { splitResolveWaves } from "~/presentation/timeline/resolveWaves";
import { laneFor } from "~/presentation/timeline/cueLanes";

describe("cueLanes routing", () => {
  // Every emitted id shape must route to its intended lane — a future prefix
  // rename can silently steal lanes, so pin the whole table.
  const cases: Array<[string, string]> = [
    ["gd0", "gasDrop"],
    ["b0", "move"],
    ["ch0", "bSpecial"],
    ["chd0", "bSpecial"],
    ["qj0", "bSpecial"],
    ["armm0", "bSpecial"],
    ["armd0", "bSpecial"],
    ["spawn-r-e2-0", "deploy"],
    ["spawn-mine0", "deploy"],
    ["spawn-f0", "deploy"],
    ["crush0", "crush"],
    ["fcrush0", "crush"],
    ["farmm0", "arrivalBlast"],
    ["farmd0", "arrivalBlast"],
    ["a0", "phase1Attack"],
    ["d0", "phase1Death"],
    ["dk0", "phase1Death"],
    ["m0", "phase1Death"],
    ["c0", "move"],
    ["mc0", "collision"],
    ["mm0", "mineMissile"],
    ["mt0", "mine"],
    ["prd0", "approach"],
    ["pro0", "approach"],
    ["f0", "move"],
    ["pw0", "promoWalk"],
    ["pd0", "promoDeploy"],
  ];
  for (const [id, lane] of cases) {
    it(`routes ${id} → ${lane}`, () => {
      expect(laneFor(id).lane).toBe(lane);
    });
  }
});

describe("timelinePlayer", () => {
  it("projects B-only pawnDouble as a move cue", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    const result = endScTurn(snap);
    const cues = projectResolveTimeline(result);
    expect(cues.some((c) => c.kind === "move" && c.from === "e2" && c.to === "e3")).toBe(
      true,
    );
    const step = cues.find((c) => c.kind === "move" && c.from === "e2");
    expect(step && "stim" in step && step.stim).toBe(true);
  });

  it("migrates U: green aura with gas-step then classical move", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e2",
        to: "e3",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.next.specialsUsed).toEqual(["e4"]);

    const jobs: { ms: number; fn: () => void }[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => {};
      },
    };
    const commits: Array<{ specialsUsed?: readonly string[] }> = [];
    playTimeline(result, scheduler, {
      onStart: () => {},
      onCommit: (patch) => {
        if (patch.specialsUsed !== undefined) {
          commits.push({ specialsUsed: patch.specialsUsed });
        }
      },
      onDone: () => {},
    });
    // Drain scheduled work (gas → stim → classical).
    for (let i = 0; i < 40 && jobs.length > 0; i++) {
      const batch = jobs.splice(0, jobs.length);
      for (const j of batch) j.fn();
    }
    const usedSeq = commits.map((c) => (c.specialsUsed ?? []).join(","));
    expect(usedSeq.some((s) => s.includes("e2"))).toBe(true);
    expect(usedSeq.some((s) => s === "e3" || s.includes("e3"))).toBe(true);
    expect(usedSeq.at(-1)).toBe("e4");
  });

  it("projects promotion walk-off then deploy", () => {
    let snap = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    }).snapshot;
    const result = endScTurn(snap);
    const cues = projectResolveTimeline(result);
    expect(
      cues.some((c) => {
        if (c.kind !== "move" || !c.id.startsWith("pw") || c.from !== "e8") return false;
        return String(c.to) === "e9";
      }),
    ).toBe(true);
    expect(cues.some((c) => c.kind === "deploy" && c.piece === "q")).toBe(true);
  });

  it("promo walk-off vacates e8 after classical lands the pawn (no ghost)", () => {
    let snap = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    }).snapshot;
    const result = endScTurn(snap);

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    const placements: string[] = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.placement) placements.push(patch.placement);
      },
      onDone: () => undefined,
    });
    while (jobs.length) jobs.shift()!.fn();

    // After classical land: pawn on e8 (not still on e7).
    const withPawnOnE8 = placements.some((p) => {
      const map = placementToMap(p);
      const e8 = map.get("e8");
      return e8?.type === "p" && e8.color === "w" && !map.has("e7");
    });
    expect(withPawnOnE8).toBe(true);
    // After walk-off: e8 vacated before final queen.
    const vacated = placements.some((p) => !placementToMap(p).has("e8"));
    expect(vacated).toBe(true);
    expect(placementToMap(placements.at(-1)!).get("e8")).toMatchObject({
      type: "q",
      color: "w",
    });
  });

  it("places the promoted unit when deploy starts (no late auto-deploy surprise)", () => {
    let snap = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    type Commit = {
      placement?: string;
      playingIds?: readonly string[];
    };
    const commits: Commit[] = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        commits.push({
          placement: patch.placement,
          playingIds: patch.playingIds,
        });
      },
      onDone: () => undefined,
    });

    // Drive until a promo deploy id is playing.
    while (jobs.length) {
      const playing = commits.at(-1)?.playingIds ?? [];
      if (playing.some((id) => id.startsWith("pd"))) break;
      jobs.shift()!.fn();
    }
    const duringDeploy = commits
      .filter((c) => c.playingIds?.some((id) => id.startsWith("pd")))
      .at(-1);
    expect(duringDeploy?.placement).toBeTruthy();
    expect(placementToMap(duringDeploy!.placement!).get("e8")).toMatchObject({
      type: "q",
      color: "w",
    });

    while (jobs.length) jobs.shift()!.fn();
  });

  it("projects post-move mineTrigger death after the walk-on (promotion × mine)", () => {
    let snap = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|M:b:e8|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.resolved.mineTriggers).toEqual([
      expect.objectContaining({ kind: "mineBlast", to: "e8", victim: { piece: "p", color: "w" } }),
    ]);
    expect(result.resolved.promotions).toEqual([]);

    const cues = projectResolveTimeline(result);
    const kinds = cues.map((c) => c.kind);
    expect(kinds).toEqual(["move", "death", "death"]);
    expect(cues[0]).toMatchObject({ kind: "move", from: "e7", to: "e8", piece: "p" });
    expect(cues[1]).toMatchObject({
      kind: "death",
      id: expect.stringMatching(/^mtm/),
      at: "e8",
      mine: true,
    });
    expect(cues[2]).toMatchObject({
      kind: "death",
      id: expect.stringMatching(/^mt\d/),
      piece: "p",
      color: "w",
      at: "e8",
    });

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    const playingLog: string[][] = [];
    const mineLog: Array<unknown> = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.playingIds) playingLog.push([...patch.playingIds]);
        if (patch.mines !== undefined) mineLog.push(patch.mines);
      },
      onDone: () => undefined,
    });
    while (
      jobs.length &&
      !playingLog.some((ids) => ids.some((id) => id.startsWith("mt")))
    ) {
      jobs.shift()!.fn();
    }
    expect(playingLog.some((ids) => ids.some((id) => id.startsWith("mt")))).toBe(true);
    expect(mineLog.some((m) => Array.isArray(m) && m.length === 0)).toBe(true);
  });

  it("projects Command Center spawn as a deploy cue", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "r",
      },
    }).snapshot;
    const result = endScTurn(snap);
    const cues = projectResolveTimeline(result);
    const deploy = cues.find((c) => c.kind === "deploy" && c.id.startsWith("spawn-"));
    expect(deploy).toMatchObject({
      kind: "deploy",
      piece: "r",
      color: "w",
      at: "e2",
    });
  });

  it("projects deploy and crush death cues when spawning onto an enemy unit", () => {
    // White spawns a marine on e2, crushing black knight on e2.
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4n3/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const cues = projectResolveTimeline(result);
    const deploy = cues.find((c) => c.kind === "deploy" && c.at === "e2");
    expect(deploy).toMatchObject({
      kind: "deploy",
      piece: "p",
      color: "w",
      at: "e2",
    });
    const crushDeath = cues.find(
      (c) => c.kind === "death" && c.id.startsWith("crush") && c.at === "e2",
    );
    expect(crushDeath).toMatchObject({
      kind: "death",
      piece: "n",
      color: "b",
      at: "e2",
    });
  });

  it("plays deploy and crush death cues even when the spawned unit dies later the same turn", () => {
    // White spawns marine on e2 (crushing black knight e2 in B).
    // A black spider mine on e2 detonates, killing the spawned marine.
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4n3/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = {
      ...snap,
      mines: [{ at: "e2", color: "b" }],
    };
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const cues = projectResolveTimeline(result);
    // Deploy and crush death cues must be present despite white marine dying on e2.
    expect(cues.some((c) => c.kind === "deploy" && c.at === "e2")).toBe(true);
    expect(
      cues.some((c) => c.kind === "death" && c.id.startsWith("crush") && c.at === "e2"),
    ).toBe(true);
  });

  it("plays boom + hull when a gas step lands on a hostile mine", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|21|33|P|G:33:33|Q:w:;b:|M:w:;b:e3",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    const cues = projectResolveTimeline(endScTurn(snap, { skipTurnStartChecks: true }));
    // The marine still hops, then the mine goes off under it.
    const step = cues.findIndex((c) => c.kind === "move" && c.to === "e3");
    const boom = cues.findIndex(
      (c) => c.kind === "death" && c.id.startsWith("armm") && c.at === "e3",
    );
    const hull = cues.findIndex(
      (c) => c.kind === "death" && c.id.startsWith("armd") && c.piece === "p",
    );
    expect(step).toBeGreaterThanOrEqual(0);
    expect(boom).toBeGreaterThan(step);
    expect(hull).toBeGreaterThan(boom);
  });

  it("plays deploy + boom when a drop lands on a hostile mine", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|21|33|P|G:33:33|Q:w:;b:|M:w:;b:d2",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "spawn", color: "w", from: "e1", to: "d2", unit: "p" },
    }).snapshot;
    const cues = projectResolveTimeline(endScTurn(snap, { skipTurnStartChecks: true }));
    const deploy = cues.findIndex((c) => c.kind === "deploy" && c.at === "d2");
    const boom = cues.findIndex(
      (c) => c.kind === "death" && c.id.startsWith("armm") && c.at === "d2",
    );
    expect(deploy).toBeGreaterThanOrEqual(0);
    expect(boom).toBeGreaterThan(deploy);
    expect(
      cues.some((c) => c.kind === "death" && c.id.startsWith("armd") && c.at === "d2"),
    ).toBe(true);
  });

  it("plays chase missile + boom when a fog approach crosses a mine", () => {
    // Tank a1→a8 discovers the marine on a6, shoots, then the mine on a3
    // chases it onto the landing tile.
    let snap = parseScFen(
      "SCFEN|4k3/8/p7/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:a3",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "a1", to: "a8" },
    }).snapshot;
    const cues = projectResolveTimeline(endScTurn(snap, { skipTurnStartChecks: true }));
    const shot = cues.findIndex((c) => c.kind === "attack" && c.id.startsWith("pra"));
    const missile = cues.findIndex(
      (c) => c.kind === "mineMissile" && c.from === "a3" && c.to === "a6",
    );
    const boom = cues.findIndex((c) => c.id.startsWith("prm") && c.kind === "death");
    const hull = cues.findIndex(
      (c) => c.kind === "death" && c.id.startsWith("prv") && c.piece === "r",
    );
    expect(shot).toBeGreaterThanOrEqual(0);
    expect(missile).toBeGreaterThan(shot);
    expect(boom).toBeGreaterThan(missile);
    expect(hull).toBeGreaterThan(boom);
  });

  it("plays spawn deploy even when the unit dies later the same turn", () => {
    // White spawns a pawn on e2; black rook on e8 finds it mid-ray (path-reveal).
    let snap = parseScFen(
      "SCFEN|4rk2/8/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "p",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "b",
        from: "e8",
        to: "e2",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(placementToMap(result.afterB.placement).get("e2")).toMatchObject({
      type: "p",
      color: "w",
    });
    expect(placementToMap(result.next.placement).get("e2")).toMatchObject({
      type: "r",
      color: "b",
    });
    const cues = projectResolveTimeline(result);
    // The drop always plays; the killing shot lands after it.
    const deploy = cues.findIndex((c) => c.kind === "deploy" && c.at === "e2");
    const death = cues.findIndex((c) => c.kind === "death" && c.at === "e2");
    expect(deploy).toBeGreaterThanOrEqual(0);
    expect(death).toBeGreaterThan(deploy);
  });

  it("keeps the deploy cue when the spawned unit captures and occupies", () => {
    // White spawns a pawn on e2, then C captures the knight on d3.
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/3n4/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "p",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e2",
        to: "d3",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(placementToMap(result.next.placement).get("d3")).toMatchObject({
      type: "p",
      color: "w",
    });
    const cues = projectResolveTimeline(result);
    const deploy = cues.findIndex((c) => c.kind === "deploy" && c.at === "e2");
    const attack = cues.findIndex((c) => c.kind === "attack" && c.to === "d3");
    expect(deploy).toBeGreaterThanOrEqual(0);
    expect(attack).toBeGreaterThan(deploy);
  });

  it("keeps the deploy cue when the spawned unit moves away", () => {
    // White spawns a pawn on e2, then C walks it to e3.
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "p",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e2",
        to: "e3",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const cues = projectResolveTimeline(result);
    const deploy = cues.findIndex((c) => c.kind === "deploy" && c.at === "e2");
    const move = cues.findIndex(
      (c) => c.kind === "move" && !c.stim && c.from === "e2" && c.to === "e3",
    );
    expect(deploy).toBeGreaterThanOrEqual(0);
    expect(move).toBeGreaterThan(deploy);
  });

  it("projects an F-rank spawn deploy after attacks and moves", () => {
    // White moves first (C), then drops a pawn (F) — the deploy plays last.
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/P7/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a2",
        to: "a3",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "F",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const cues = projectResolveTimeline(result);
    const deploy = cues.find((c) => c.kind === "deploy" && c.at === "e2");
    expect(deploy).toBeDefined();
    expect(deploy!.id.startsWith("spawn-f")).toBe(true);
    expect(deploy!.lane).toBe("deploy");
    expect(deploy!.board).toBe("afterMove");
    const move = cues.findIndex(
      (c) => c.kind === "move" && !c.stim && c.to === "a3",
    );
    const deployIdx = cues.findIndex((c) => c.id === deploy!.id);
    expect(deployIdx).toBeGreaterThan(move);
  });

  it("plays F-rank deploy + boom when the late drop lands on a hostile mine", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|21|33|P|G:33:33|Q:w:;b:|M:w:;b:e2",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "spawn", color: "w", from: "e1", to: "e2", unit: "p" },
    }).snapshot;
    const cues = projectResolveTimeline(endScTurn(snap, { skipTurnStartChecks: true }));
    const deploy = cues.findIndex(
      (c) => c.kind === "deploy" && c.id.startsWith("spawn-f"),
    );
    const boom = cues.findIndex(
      (c) => c.kind === "death" && c.id.startsWith("farmm") && c.at === "e2",
    );
    const hull = cues.findIndex(
      (c) => c.kind === "death" && c.id.startsWith("farmd") && c.at === "e2",
    );
    expect(deploy).toBeGreaterThanOrEqual(0);
    expect(boom).toBeGreaterThan(deploy);
    expect(hull).toBeGreaterThan(boom);
  });

  it("an F-rank deploy window never rewinds placement committed by earlier waves", () => {
    // C moves a2→a3, F deploys on e2. While the deploy window plays, the
    // moved pawn must stay on a3 (applyAfterB rewind would resurrect it on a2).
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/P7/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a2",
        to: "a3",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "F",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const jobs: { ms: number; fn: () => void }[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => {};
      },
    };
    type Patch = { placement?: string; playingIds?: readonly string[] };
    const patches: Patch[] = [];
    playTimeline(result, scheduler, {
      onStart: () => {},
      onCommit: (patch) => patches.push(patch),
      onDone: () => {},
    });
    for (let i = 0; i < 80 && jobs.length > 0; i++) {
      const batch = jobs.splice(0, jobs.length);
      for (const j of batch) j.fn();
    }
    const deployStart = patches.findIndex((p) =>
      (p.playingIds ?? []).some((id) => id.startsWith("spawn-f")),
    );
    expect(deployStart).toBeGreaterThanOrEqual(0);
    const board = placementToMap(patches[deployStart]!.placement!);
    // The classical relocate survives into the deploy window…
    expect(board.get("a3")).toMatchObject({ type: "p", color: "w" });
    expect(board.has("a2")).toBe(false);
    // …and the deployed hull is placed forward, not by an afterB rewind.
    expect(board.get("e2")).toMatchObject({ type: "p", color: "w" });
    expect(patches.at(-1)!.placement).toBe(result.next.placement);
  });

  it("plays an F-rank deploy and its crush death after attacks and moves", () => {
    // White moves a2→a3 (C), then late-drops a pawn onto the knight on e2 (F).
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/P3n3/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a2",
        to: "a3",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "F",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const cues = projectResolveTimeline(result);
    const move = cues.findIndex(
      (c) => c.kind === "move" && !c.stim && c.to === "a3",
    );
    const deploy = cues.findIndex(
      (c) => c.kind === "deploy" && c.id.startsWith("spawn-f"),
    );
    const crush = cues.findIndex(
      (c) => c.kind === "death" && c.id.startsWith("fcrush") && c.at === "e2",
    );
    expect(move).toBeGreaterThanOrEqual(0);
    expect(deploy).toBeGreaterThan(move);
    expect(crush).toBe(deploy + 1);
    // Wave bucketing: deploy AND crush land in specialAfter together.
    const waves = splitResolveWaves(result);
    const afterWave = waves.find((w) => w.id === "specialAfter")!;
    expect(afterWave.cues.some((c) => c.kind === "deploy")).toBe(true);
    expect(afterWave.cues.some((c) => c.id.startsWith("fcrush"))).toBe(true);
  });

  it("projects an F-rank pawnDouble mine blast with farmm/farmd ids", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|21|33|P|G:33:33|Q:w:;b:|M:w:;b:e3",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "F",
        kind: "pawnDouble",
        color: "w",
        from: "e2",
        to: "e3",
      },
    }).snapshot;
    const cues = projectResolveTimeline(endScTurn(snap, { skipTurnStartChecks: true }));
    const boom = cues.findIndex(
      (c) => c.kind === "death" && c.id.startsWith("farmm") && c.at === "e3",
    );
    const hull = cues.findIndex(
      (c) => c.kind === "death" && c.id.startsWith("farmd") && c.piece === "p",
    );
    expect(boom).toBeGreaterThanOrEqual(0);
    expect(hull).toBe(boom + 1);
  });

  it("playTimeline advances with injected scheduler", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    const result = endScTurn(snap);
    const queue: Array<() => void> = [];
    const scheduler = {
      delay: (_ms: number, fn: () => void) => {
        queue.push(fn);
        return () => undefined;
      },
    };
    const onDone = vi.fn();
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: () => undefined,
      onDone,
    });
    while (queue.length) queue.shift()!();
    expect(onDone).toHaveBeenCalled();
  });

  it("defers kingShot HP until frag impact", () => {
    const snap = parseScFen(
      "SCFEN|8/8/8/2N5/4k3/8/7B/7K|0|33|P|G:11:11|Q:w:;b:",
    );
    const begun = beginScTurn(snap);
    expect(begun.changed).toBe(true);
    expect(begun.asResolve).toBeTruthy();
    const result = begun.asResolve!;

    // Standing check: attack only — never a move cue before the shot.
    const cues = projectResolveTimeline(result);
    expect(cues.every((c) => c.kind === "attack")).toBe(true);
    expect(cues[0]).toMatchObject({
      kind: "attack",
      from: "c5",
      to: "e4",
      kingShot: { target: "b" },
    });

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    const livesLog: Array<{ w: number; b: number }> = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.kingLives) livesLog.push({ ...patch.kingLives });
      },
      onDone: () => undefined,
    });

    // Start commit: black still at 3 until frag.
    expect(livesLog[0]).toEqual({ w: 3, b: 3 });

    // Flush frag job (250) before attack end (1000).
    const frag = jobs.find((j) => j.ms === 250);
    expect(frag).toBeTruthy();
    frag!.fn();
    expect(livesLog.some((l) => l.b === 2)).toBe(true);
  });

  it("projects phase-1 attacks before deaths (not interleaved)", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3p4/3RK3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d1",
        to: "d2",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.resolved.attacks.some((a) => a.kind === "capture")).toBe(true);
    const cues = projectResolveTimeline(result);
    const kinds = cues.map((c) => c.kind);
    const firstDeath = kinds.indexOf("death");
    const lastAttack = kinds.lastIndexOf("attack");
    expect(firstDeath).toBeGreaterThan(-1);
    expect(lastAttack).toBeGreaterThan(-1);
    expect(lastAttack).toBeLessThan(firstDeath);
  });

  it("starts phase-1 deaths at max batch impactMsFor while attacks still play", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3p4/3RK3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d1",
        to: "d2",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.resolved.attacks.some((a) => a.kind === "capture")).toBe(true);

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    const playingLogs: string[][] = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.playingIds && patch.playingIds.length > 0) {
          playingLogs.push([...patch.playingIds]);
        }
      },
      onDone: () => undefined,
    });

    // Attack-only window first (applyAfterB may commit empty playingIds).
    expect(playingLogs[0]?.some((id) => id.startsWith("a"))).toBe(true);
    expect(playingLogs[0]?.some((id) => id.startsWith("d"))).toBe(false);

    // Rook HE impact ≈ 22% of ATTACK_MS (220ms) — death joins while attack plays.
    const atImpact = jobs.filter((j) => j.ms === 220);
    expect(atImpact.length).toBeGreaterThan(0);
    for (const j of atImpact) j.fn();

    const overlapped = playingLogs.find(
      (ids) =>
        ids.some((id) => id.startsWith("a")) &&
        ids.some((id) => id.startsWith("d")),
    );
    expect(overlapped).toBeTruthy();

    while (jobs.length) jobs.shift()!.fn();
  });

  it("keeps attacks in playingIds until ATTACK_MS when deaths exist", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3p4/3RK3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d1",
        to: "d2",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.resolved.attacks.some((a) => a.kind === "capture")).toBe(true);

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    let playing: readonly string[] = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.playingIds !== undefined) playing = patch.playingIds;
      },
      onDone: () => undefined,
    });

    // Rook HE: impact 220, deathDone 720, phaseDone ATTACK_MS 1000.
    jobs.sort((a, b) => a.ms - b.ms);
    let sawAttacksAfterDeath = false;
    for (const j of jobs) {
      j.fn();
      if (j.ms === 720) {
        expect(playing.some((id) => id.startsWith("a"))).toBe(true);
        expect(playing.some((id) => id.startsWith("d"))).toBe(false);
        sawAttacksAfterDeath = true;
      }
      if (j.ms === 1000) {
        expect(playing.some((id) => id.startsWith("a"))).toBe(false);
      }
    }
    expect(sawAttacksAfterDeath).toBe(true);
  });

  it("sets attackDying at impact when death.at matches attack.from", () => {
    // Mutual diagonal pawn fire — each attacker dies on their own square.
    let snap = parseScFen(
      "SCFEN|4k3/8/8/3p4/4P3/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e4",
        to: "d5",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "b",
        from: "d5",
        to: "e4",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.resolved.attacks.length).toBe(2);

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    let attackDying: Record<string, boolean> = {};
    let playing: readonly string[] = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.playingIds !== undefined) playing = patch.playingIds;
        if (patch.attackDying !== undefined) attackDying = patch.attackDying;
      },
      onDone: () => undefined,
    });

    const cues = projectResolveTimeline(result);
    const attacks = cues.filter((c) => c.kind === "attack");
    expect(attacks.length).toBe(2);

    // Pawn rifle impact = 250ms.
    const atImpact = jobs.filter((j) => j.ms === 250);
    expect(atImpact.length).toBeGreaterThan(0);
    for (const j of atImpact) j.fn();

    for (const a of attacks) {
      expect(attackDying[a.id]).toBe(true);
    }
    expect(
      playing.some((id) => id.startsWith("a")) &&
        playing.some((id) => id.startsWith("d")),
    ).toBe(true);

    jobs.sort((a, b) => a.ms - b.ms);
    for (const j of jobs) {
      if (j.ms === 250) continue;
      j.fn();
    }
    expect(Object.keys(attackDying).length).toBe(0);
  });

  it("never dual-lists moveCollision in phase-1 attacks; projects mc deaths after moves", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/3p4/8/8/3RK3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d1",
        to: "d5",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(
      result.resolved.attacks.every(
        (a) => !("moveCollision" in a && a.moveCollision),
      ),
    ).toBe(true);

    const cues = projectResolveTimeline(result);
    if (result.resolved.moveCollisions.length > 0) {
      const firstMove = cues.findIndex(
        (c) => c.kind === "move" && c.id.startsWith("c"),
      );
      const firstMc = cues.findIndex(
        (c) => c.kind === "death" && c.id.startsWith("mc"),
      );
      expect(firstMc).toBeGreaterThan(-1);
      expect(firstMc).toBeGreaterThan(firstMove);
    }
  });

  it("plays opposing classical moves in one simultaneous window", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e2",
        to: "e4",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "b",
        from: "e8",
        to: "e7",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.resolved.moves.length).toBe(2);

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    const playingLogs: string[][] = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.playingIds && patch.playingIds.length > 0) {
          playingLogs.push([...patch.playingIds]);
        }
      },
      onDone: () => undefined,
    });

    const moveWave = playingLogs.find(
      (ids) => ids.length >= 2 && ids.every((id) => id.startsWith("c")),
    );
    expect(moveWave).toBeTruthy();
    expect(moveWave!.length).toBe(2);

    while (jobs.length) jobs.shift()!.fn();
  });

  it("flips knight moveLeg to short-leg facing at the L elbow", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/1N2K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "b1",
        to: "c3",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.resolved.moves.some((m) => m.piece === "n")).toBe(true);

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    const legLog: Array<Record<string, 0 | 1>> = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.moveLeg && Object.keys(patch.moveLeg).length > 0) {
          legLog.push({ ...patch.moveLeg });
        }
      },
      onDone: () => undefined,
    });

    expect(legLog.length).toBeGreaterThan(0);
    const first = legLog[0]!;
    const knightId = Object.keys(first)[0]!;
    expect(first[knightId]).toBe(0);

    // Flush until elbow (long leg = 2 × knightSquareMs = 200).
    const elbow = jobs.find((j) => j.ms === 200);
    expect(elbow).toBeTruthy();
    elbow!.fn();
    expect(legLog.some((l) => l[knightId] === 1)).toBe(true);

    while (jobs.length) jobs.shift()!.fn();
  });

  it("projects Charon attack+death and Tactical Jump cues from B specials", () => {
    let snap = parseScFen(
      "SCFEN|k6q/8/4P3/4p3/3B4/8/8/K7|11|33|P|G:22:22|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "bishopSnipe",
        color: "w",
        from: "d4",
        to: "h8",
      },
    }).snapshot;
    const charon = endScTurn(snap, { skipTurnStartChecks: true });
    const charonCues = projectResolveTimeline(charon);
    expect(charonCues.some((c) => c.kind === "attack" && c.anim === "bishopCharon")).toBe(
      true,
    );
    expect(charonCues.some((c) => c.kind === "death" && c.at === "h8")).toBe(true);

    let jumpSnap = parseScFen(
      "SCFEN|7k/8/8/8/8/8/8/Q6K|21|33|P|G:33:33|Q:w:;b:",
    );
    jumpSnap = addScAction({
      snapshot: jumpSnap,
      action: {
        timing: "B",
        kind: "queenWarp",
        color: "w",
        from: "a1",
        to: "a3",
      },
    }).snapshot;
    const jump = endScTurn(jumpSnap, { skipTurnStartChecks: true });
    const jumpCues = projectResolveTimeline(jump);
    expect(jumpCues.some((c) => c.kind === "move" && c.queenJump && c.to === "a3")).toBe(
      true,
    );
  });

  it("keeps Tactical Jump trails for 1000ms without blocking onDone", () => {
    let jumpSnap = parseScFen(
      "SCFEN|7k/8/8/8/8/8/8/Q6K|21|33|P|G:33:33|Q:w:;b:",
    );
    jumpSnap = addScAction({
      snapshot: jumpSnap,
      action: {
        timing: "B",
        kind: "queenWarp",
        color: "w",
        from: "a1",
        to: "a3",
      },
    }).snapshot;
    const result = endScTurn(jumpSnap, { skipTurnStartChecks: true });

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    let trails = 0;
    let playing = 0;
    const onDone = vi.fn();
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.jumpTrails !== undefined) trails = patch.jumpTrails.length;
        if (patch.playingIds !== undefined) playing = patch.playingIds.length;
      },
      onDone,
    });

    const flushMs = (ms: number) => {
      const due = jobs.filter((j) => j.ms === ms);
      for (const j of due) {
        const idx = jobs.indexOf(j);
        if (idx >= 0) jobs.splice(idx, 1);
        j.fn();
      }
    };

    flushMs(260); // gas absorb → jump starts
    expect(trails).toBeGreaterThan(0);
    expect(playing).toBeGreaterThan(0);

    flushMs(200); // land
    flushMs(250); // hull + appear done → resolve may finish; trails linger
    expect(playing).toBe(0);
    expect(trails).toBeGreaterThan(0);
    expect(onDone).toHaveBeenCalled();

    flushMs(1000); // CSS trail fade mount teardown
    expect(trails).toBe(0);
  });

  it("projects a gasDrop cue before B steps (top-edge corner)", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const cues = projectResolveTimeline(result);
    const drop = cues.find((c) => c.kind === "gasDrop");
    expect(drop).toMatchObject({
      kind: "gasDrop",
      at: "e2",
      color: "w",
    });
    expect(drop && "corner" in drop && ["left", "mid", "right"].includes(drop.corner)).toBe(
      true,
    );
    const dropIdx = cues.findIndex((c) => c.kind === "gasDrop");
    const stepIdx = cues.findIndex((c) => c.kind === "move" && c.from === "e2");
    expect(dropIdx).toBeGreaterThanOrEqual(0);
    expect(stepIdx).toBeGreaterThan(dropIdx);
  });

  it("vacates path-reveal victims so they do not reappear after death", () => {
    let snap = parseScFen(
      "SCFEN|7k/3p4/8/8/3R4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d4",
        to: "d8",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.resolved.pathRevealAttacks.length).toBeGreaterThan(0);

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    const placements: string[] = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.placement) placements.push(patch.placement);
      },
      onDone: () => undefined,
    });

    while (jobs.length) jobs.shift()!.fn();

    // Final board has no black pawn; a mid commit must have vacated it.
    expect(result.next.placement.includes("p")).toBe(false);
    expect(placements.some((p) => !p.includes("p"))).toBe(true);
  });

  it("projects fog path-reveal kingShot as approach → shot → stop (not post-move chip)", () => {
    // Ba1→h8; black king on e5 starts outside bishop+king vision, lights mid-ray.
    let snap = parseScFen(
      "SCFEN|8/8/8/4k3/8/8/8/B6K|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a1",
        to: "h8",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.resolved.pathRevealAttacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "kingShot",
          piece: "b",
          pathRevealFrom: "a1",
          to: "e5",
        }),
      ]),
    );
    expect(result.next.kingLives.b).toBe(2);

    const cues = projectResolveTimeline(result);
    const pathIds = cues.filter((c) => c.id.startsWith("pr")).map((c) => c.kind);
    expect(pathIds).toEqual(["move", "attack", "move"]);

    const approach = cues.find((c) => c.id.startsWith("prd"));
    expect(approach).toMatchObject({
      kind: "move",
      from: "a1",
      piece: "b",
    });
    const shot = cues.find((c) => c.id.startsWith("pra"));
    expect(shot).toMatchObject({
      kind: "attack",
      to: "e5",
      kingShot: { target: "b", livesAfter: 2 },
    });
    const stop = cues.find((c) => c.id.startsWith("prs"));
    expect(stop).toMatchObject({ kind: "move", piece: "b" });

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    const livesLog: Array<{ w: number; b: number }> = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.kingLives) livesLog.push({ ...patch.kingLives });
      },
      onDone: () => undefined,
    });
    expect(livesLog[0]).toEqual({ w: 3, b: 3 });
    // Drain until frag lands (path-reveal approach moves first).
    while (jobs.length && !livesLog.some((l) => l.b === 2)) {
      jobs.shift()!.fn();
    }
    expect(livesLog.some((l) => l.b === 2)).toBe(true);
  });

  it("path-reveal lethal kingShot projects death and starts crumple at frag impact", () => {
    let snap = parseScFen(
      "SCFEN|8/8/8/4k3/8/8/8/B6K|0|31|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a1",
        to: "h8",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(
      result.resolved.pathRevealAttacks.some(
        (a) => a.kind === "kingShot" && a.livesAfter === 0,
      ),
    ).toBe(true);

    const cues = projectResolveTimeline(result);
    const pathKinds = cues.filter((c) => c.id.startsWith("pr")).map((c) => c.kind);
    expect(pathKinds).toEqual(["move", "attack", "death", "move"]);
    expect(cues.some((c) => c.kind === "death" && c.id.startsWith("prdth"))).toBe(
      true,
    );

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    const playingLog: string[][] = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.playingIds) playingLog.push([...patch.playingIds]);
      },
      onDone: () => undefined,
    });
    while (jobs.length && !playingLog.some((ids) => ids.some((id) => id.startsWith("prdth")))) {
      jobs.shift()!.fn();
    }
    expect(
      playingLog.some((ids) => ids.some((id) => id.startsWith("pra")) && ids.some((id) => id.startsWith("prdth"))),
    ).toBe(true);
  });

  it("projects F gasDrop on the post-move square (move then mine)", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/1N2K3|11|33|P|G:22:22|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "b1",
        to: "c3",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "knightMine", color: "w", from: "b1", to: "b1" },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const cues = projectResolveTimeline(result);
    const drop = cues.find((c) => c.kind === "gasDrop" && c.color === "w");
    expect(drop).toMatchObject({ kind: "gasDrop", at: "c3" });
  });

  it("stamps siege rookMode on phase-1 attack cues from afterB", () => {
    let snap = parseScFen(
      "SCFEN|7k/5p2/8/8/5R2/8/8/K7|0|33|P|G:11:11|Q:w:;b:|S:f4",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "f4",
        to: "f7",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.resolved.attacks.some((a) => a.kind === "capture")).toBe(true);
    const cues = projectResolveTimeline(result);
    const atk = cues.find((c) => c.kind === "attack" && c.from === "f4");
    expect(atk).toMatchObject({ kind: "attack", rookMode: "siege" });
  });

  it("projects a death cue for lethal kingShot (command center collapse)", () => {
    // Standing check: knight threatens black king at 1 HP → lethal kingShot.
    const snap = parseScFen(
      "SCFEN|8/8/8/2N5/4k3/8/7B/7K|0|31|P|G:11:11|Q:w:;b:",
    );
    const begun = beginScTurn(snap);
    expect(begun.asResolve).toBeTruthy();
    const result = begun.asResolve!;
    const lethal = result.resolved.attacks.find(
      (a) => a.kind === "kingShot" && a.livesAfter === 0,
    );
    expect(lethal).toBeTruthy();
    const cues = projectResolveTimeline(result);
    expect(
      cues.some((c) => c.kind === "death" && c.piece === "k" && c.color === "b"),
    ).toBe(true);
  });

  it("projects chase mineMissile before boom (path-collide wake)", () => {
    // Mine on a4; rook walks a1→a8 and wakes it — chaseFrom a4 → impact a8.
    let snap = parseScFen(
      "SCFEN|7k/8/8/8/8/8/8/R3K3|0|33|P|G:11:11|M:b:a4|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a1",
        to: "a8",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const chase = result.resolved.mineTriggers.find(
      (a) => a.kind === "mineBlast" && a.chaseFrom != null,
    );
    expect(chase).toMatchObject({
      kind: "mineBlast",
      chaseFrom: "a4",
      to: "a8",
      mineColor: "b",
    });

    const cues = projectResolveTimeline(result);
    const missileIdx = cues.findIndex((c) => c.kind === "mineMissile");
    const boomIdx = cues.findIndex(
      (c) => c.kind === "death" && c.id.startsWith("mtm"),
    );
    expect(missileIdx).toBeGreaterThanOrEqual(0);
    expect(boomIdx).toBeGreaterThan(missileIdx);
    expect(cues[missileIdx]).toMatchObject({
      kind: "mineMissile",
      from: "a4",
      to: "a8",
      color: "b",
    });

    type Job = { ms: number; fn: () => void };
    const jobs: Job[] = [];
    const scheduler = {
      delay: (ms: number, fn: () => void) => {
        jobs.push({ ms, fn });
        return () => undefined;
      },
    };
    const playingLog: string[][] = [];
    const trailLog: unknown[] = [];
    const spentLog: unknown[] = [];
    playTimeline(result, scheduler, {
      onStart: () => undefined,
      onCommit: (patch) => {
        if (patch.playingIds) playingLog.push([...patch.playingIds]);
        if (patch.mineMissileTrails !== undefined) {
          trailLog.push(patch.mineMissileTrails);
        }
        if (patch.spentMines !== undefined) spentLog.push(patch.spentMines);
      },
      onDone: () => undefined,
    });
    while (
      jobs.length &&
      !playingLog.some((ids) => ids.some((id) => id.startsWith("mm")))
    ) {
      jobs.shift()!.fn();
    }
    expect(playingLog.some((ids) => ids.some((id) => id.startsWith("mm")))).toBe(
      true,
    );
    expect(spentLog.some((s) => Array.isArray(s) && s.includes("a4"))).toBe(true);
    expect(trailLog.some((t) => Array.isArray(t) && t.length > 0)).toBe(true);
    while (jobs.length) jobs.shift()!.fn();
  });
});
