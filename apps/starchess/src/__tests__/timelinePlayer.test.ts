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
});
