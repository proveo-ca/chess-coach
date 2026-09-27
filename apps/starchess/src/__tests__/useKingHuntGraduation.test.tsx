import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, createSignal } from "solid-js";

const confirmOpen = vi.hoisted(() => ({ read: (() => false) as () => boolean }));

vi.mock("~/components/features/TutorialCompleteConfirm", () => ({
  TutorialCompleteConfirm: (props: { open: boolean }) => {
    confirmOpen.read = () => props.open;
    return null;
  },
}));

import { useKingHuntGraduation } from "~/demos/choreography/useKingHuntGraduation";
import type { MatchStore } from "~/types/match";

type ShellStub = {
  phase: string;
  outcome: unknown;
  liveSnapshot: { phase: string; ccLives: { b: number } };
  tick: number;
};

const live = (tick: number): ShellStub => ({
  phase: "playing",
  outcome: null,
  liveSnapshot: { phase: "P", ccLives: { b: 1 } },
  tick,
});
const won = (tick: number): ShellStub => ({
  phase: "gameOver",
  outcome: "w",
  liveSnapshot: { phase: "O", ccLives: { b: 0 } },
  tick,
});

const mount = () => {
  const [shell, setShell] = createSignal<ShellStub>(live(0));
  const store = { shell } as unknown as MatchStore;
  const dispose = createRoot((d) => {
    const { Overlay } = useKingHuntGraduation(store, { tutorial: true });
    Overlay?.({});
    return d;
  });
  return { setShell, dispose };
};

describe("useKingHuntGraduation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("offers graduation 1200ms after the enemy CC dies, despite store ticks in between", () => {
    const { setShell, dispose } = mount();
    setShell(won(1));
    vi.advanceTimersByTime(600);
    setShell(won(2));
    setShell(won(3));
    expect(confirmOpen.read()).toBe(false);
    vi.advanceTimersByTime(600);
    expect(confirmOpen.read()).toBe(true);
    dispose();
  });

  it("unmount before the beat cancels the offer", () => {
    const { setShell, dispose } = mount();
    setShell(won(1));
    dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
