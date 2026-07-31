import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createRoot, createSignal } from "solid-js";

import { useBroodWarNativeMoves } from "~/broodwar/hooks/useBroodWarNativeMoves";
import { moveDurationMs } from "~/broodwar/animations/moveTiming";
import type { MoveSquares } from "~/types/game";

const flushSolid = () => new Promise<void>((r) => queueMicrotask(r));

describe("useBroodWarNativeMoves", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns a queued knight move into an L-path MoveCue and hides the destination", async () => {
    const consumed: MoveSquares[] = [];
    let dispose!: () => void;
    const api = await new Promise<ReturnType<typeof useBroodWarNativeMoves>>((resolve) => {
      dispose = createRoot((d) => {
        const [queue, setQueue] = createSignal<MoveSquares[]>([{ from: "d4", to: "e6" }]);
        const hook = useBroodWarNativeMoves({
          enabled: () => true,
          suppressed: () => false,
          animationQueue: queue,
          consumeAnimation: (m) => {
            consumed.push(m);
            setQueue((q) => q.slice(1));
          },
          pieceAt: (sq) => (sq === "e6" ? { type: "n", color: "w" } : null),
        });
        queueMicrotask(() => resolve(hook));
        return d;
      });
    });
    await flushSolid();

    expect(consumed).toEqual([{ from: "d4", to: "e6" }]);
    expect(api.moveCues()).toHaveLength(1);
    expect(api.moveCues()[0]?.piece).toBe("n");
    expect(api.moveProgress()[api.moveCues()[0]!.id]).toBe(0);
    expect(api.hideDestinations().has("e6")).toBe(true);

    await vi.advanceTimersByTimeAsync(40);
    expect(api.moveProgress()[api.moveCues()[0]!.id]).toBe(1);

    await vi.advanceTimersByTimeAsync(moveDurationMs("d4", "e6", "n"));
    expect(api.moveCues()).toHaveLength(0);
    expect(api.hideDestinations().size).toBe(0);

    dispose();
  });

  it("stays idle while suppressed by parent combat moveCues", async () => {
    const consumed: MoveSquares[] = [];
    let dispose!: () => void;
    const api = await new Promise<ReturnType<typeof useBroodWarNativeMoves>>((resolve) => {
      dispose = createRoot((d) => {
        const [queue] = createSignal<MoveSquares[]>([{ from: "d4", to: "e6" }]);
        const hook = useBroodWarNativeMoves({
          enabled: () => true,
          suppressed: () => true,
          animationQueue: queue,
          consumeAnimation: (m) => consumed.push(m),
          pieceAt: () => ({ type: "n", color: "w" }),
        });
        queueMicrotask(() => resolve(hook));
        return d;
      });
    });
    await flushSolid();

    expect(consumed).toEqual([]);
    expect(api.moveCues()).toHaveLength(0);
    dispose();
  });
});
