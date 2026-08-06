import { describe, expect, it, vi } from "vitest";

import {
  addScAction,
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
});
