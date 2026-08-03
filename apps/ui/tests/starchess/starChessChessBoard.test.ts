import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createEffect, createRoot, createSignal } from "solid-js";

import { useStarChessNativeMoves } from "~/starchess/hooks/useStarChessNativeMoves";
import { moveDurationMs } from "~/starchess/animations/moveTiming";
import { addMove, currentIndex, game, loadFen, moveHistory } from "~/store/gameStore";
import type { MoveSquares } from "~/types/game";

/** Mirrors {@link StarChessChessBoard} enqueue + native L-path (no DOM). */
function harnessNativeKnightMove() {
  const [queue, setQueue] = createSignal<MoveSquares[]>([]);
  const [enqueuedKey, setEnqueuedKey] = createSignal<string | null>(null);

  createEffect(() => {
    const idx = currentIndex();
    const hist = moveHistory();
    if (idx <= 0) {
      setQueue([]);
      setEnqueuedKey(null);
      return;
    }
    const m = hist[idx - 1];
    if (!m?.from || !m?.to) return;
    const key = `${idx}:${m.from}-${m.to}`;
    if (key === enqueuedKey()) return;
    setEnqueuedKey(key);
    setQueue((q) => [...q, m]);
  });

  return useStarChessNativeMoves({
    enabled: () => true,
    suppressed: () => false,
    animationQueue: queue,
    consumeAnimation: (m) => {
      setQueue((q) =>
        q.length && q[0]?.from === m.from && q[0]?.to === m.to ? q.slice(1) : q,
      );
    },
    pieceAt: (sq) => game().get(sq),
  });
}

const flush = () => new Promise<void>((r) => queueMicrotask(r));

describe("StarChessChessBoard native move pipeline", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    loadFen("7k/7p/8/8/3N4/8/8/K7 w - - 0 1");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("synthesizes a knight MoveCue after addMove (fog-story path)", async () => {
    let api!: ReturnType<typeof harnessNativeKnightMove>;
    const dispose = createRoot((d) => {
      api = harnessNativeKnightMove();
      return d;
    });
    await flush();

    addMove({ from: "d4", to: "e6" });
    await flush();
    await flush();

    expect(currentIndex()).toBe(1);
    expect(api.moveCues()).toHaveLength(1);
    expect(api.moveCues()[0]?.piece).toBe("n");
    expect(api.moveCues()[0]?.from).toBe("d4");
    expect(api.moveCues()[0]?.to).toBe("e6");
    expect(api.hideDestinations().has("e6")).toBe(true);

    await vi.advanceTimersByTimeAsync(40);
    expect(api.moveProgress()[api.moveCues()[0]!.id]).toBe(1);

    await vi.advanceTimersByTimeAsync(moveDurationMs("d4", "e6", "n"));
    expect(api.moveCues()).toHaveLength(0);

    dispose();
  });
});
