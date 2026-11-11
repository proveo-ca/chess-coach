import { describe, expect, it } from "vitest";
import {
  addScAction,
  endScTurn,
  parseScFen,
} from "@chess-coach/starchess-core";

import {
  presentResolveWaveIds,
  splitResolveWaves,
} from "~/presentation/timeline/resolveWaves";

describe("splitResolveWaves", () => {
  it("partitions classical combat into move (and attack when capturing)", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
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
    const result = endScTurn(snap);
    const waves = splitResolveWaves(result);
    const ids = waves.map((w) => w.id);
    expect(ids).toContain("move");
    for (const w of waves) expect(w.cues.length).toBeGreaterThan(0);
  });

  it("places B stimStep in specialBefore before classical move", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "stimStep",
        color: "w",
        from: "e2",
        to: "e3",
      },
    }).snapshot;
    const result = endScTurn(snap);
    const ids = splitResolveWaves(result).map((w) => w.id);
    expect(ids[0]).toBe("specialBefore");
  });

  it("presentResolveWaveIds mirrors split ids; empty end is empty", () => {
    const empty = endScTurn(
      parseScFen("SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:11:11|Q:w:;b:"),
    );
    expect(presentResolveWaveIds(empty)).toEqual(
      splitResolveWaves(empty).map((w) => w.id),
    );
  });

  it("partitions opposing classical moves into waves", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/4p3/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
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
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "b",
        from: "e5",
        to: "e4",
      },
    }).snapshot;
    const waves = splitResolveWaves(endScTurn(snap));
    expect(waves.some((w) => w.id === "move")).toBe(true);
  });
});
