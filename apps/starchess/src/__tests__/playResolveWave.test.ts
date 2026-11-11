import { describe, expect, it, vi } from "vitest";
import {
  addScAction,
  endScTurn,
  parseScFen,
} from "@chess-coach/starchess-core";

import { playResolveWave } from "~/presentation/timeline/playResolveWave";
import { presentResolveWaveIds } from "~/presentation/timeline/resolveWaves";
import type { Scheduler } from "~/types/ports";

const drainScheduler = (): Scheduler & { flush: () => void } => {
  const jobs: Array<() => void> = [];
  return {
    delay: (_ms, fn) => {
      jobs.push(fn);
      return () => undefined;
    },
    flush: () => {
      while (jobs.length) {
        const batch = jobs.splice(0, jobs.length);
        for (const j of batch) j();
      }
    },
  };
};

const cbs = () => ({
  onStart: () => undefined,
  onCue: () => undefined,
  onCommit: () => undefined,
  onDone: vi.fn(),
});

describe("playResolveWave", () => {
  it("plays a known wave and finalizes when last", async () => {
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
    const result = endScTurn(snap);
    const ids = presentResolveWaveIds(result);
    expect(ids.length).toBeGreaterThan(0);
    const last = ids[ids.length - 1]!;
    const cb = cbs();
    const sched = drainScheduler();
    const cancel = playResolveWave(result, last, sched, cb, { isLastWave: true });
    expect(typeof cancel).toBe("function");
    sched.flush();
    expect(cb.onDone).toHaveBeenCalled();
  });

  it("empty / missing wave calls onDone immediately", async () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    const result = endScTurn(snap);
    const cb = cbs();
    playResolveWave(result, "attack", drainScheduler(), cb);
    await vi.waitFor(() => expect(cb.onDone).toHaveBeenCalled());
  });
});
