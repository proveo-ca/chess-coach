import { describe, expect, it } from "vitest";
import { addScAction, parseScFen } from "@chess-coach/starchess-core";

import {
  gasStackPromotes,
  moveThenGasPromotes,
} from "~/presentation/board/hooks/useBoardInput";

describe("gasStackPromotes", () => {
  it("detects B+C stack that rewrites onto last rank", () => {
    let snap = parseScFen(
      "SCFEN|k7/8/7P/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "h6",
        to: "h7",
      },
    }).snapshot;
    expect(gasStackPromotes(snap, "w", "h6", "h7")).toBe(true);
  });

  it("is false without gas", () => {
    const snap = parseScFen(
      "SCFEN|k7/8/7P/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(gasStackPromotes(snap, "w", "h6", "h7")).toBe(false);
  });

  it("is false when stack does not reach last rank", () => {
    let snap = parseScFen(
      "SCFEN|k7/8/8/7P/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "h5",
        to: "h6",
      },
    }).snapshot;
    expect(gasStackPromotes(snap, "w", "h5", "h6")).toBe(false);
  });
});

describe("moveThenGasPromotes", () => {
  it("detects C mid-step whose F gas would land on last rank", () => {
    let snap = parseScFen(
      "SCFEN|k7/8/7P/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "h6",
        to: "h7",
      },
    }).snapshot;
    expect(moveThenGasPromotes(snap, "w", "h6", "h7")).toEqual({
      seq: expect.any(Number),
    });
  });

  it("is null when classical is not the gas mid-step", () => {
    let snap = parseScFen(
      "SCFEN|k7/8/7P/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "h6",
        to: "g7",
      },
    }).snapshot;
    expect(moveThenGasPromotes(snap, "w", "h6", "h7")).toBeNull();
  });
});
