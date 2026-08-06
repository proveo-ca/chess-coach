import { describe, expect, it, vi } from "vitest";

import {
  addScAction,
  beginScTurn,
  endScTurn,
  parseScFen,
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

  it("projects promotion hold then deploy", () => {
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
    expect(cues.some((c) => c.kind === "promoHold")).toBe(true);
    expect(cues.some((c) => c.kind === "deploy" && c.piece === "q")).toBe(true);
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
});
