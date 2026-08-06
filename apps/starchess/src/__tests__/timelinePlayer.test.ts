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

  it("starts phase-1 deaths at FRAG_FLIGHT_MS while attacks still play", () => {
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

    // Kill→death meeting point (FRAG_FLIGHT_MS = 250): death joins while attack plays.
    const atImpact = jobs.filter((j) => j.ms === 250);
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
      "SCFEN|7k/8/8/8/8/8/8/Q6K|11|33|P|G:22:22|Q:w:;b:",
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
});
