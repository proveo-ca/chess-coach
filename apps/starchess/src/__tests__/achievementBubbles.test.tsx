import { cleanup, render, screen } from "@solidjs/testing-library";
import { Show, createSignal } from "solid-js";
import { afterEach, describe, expect, it } from "vitest";

import { AchievementBubblesProvider, useAchievementBubbles } from "~/presentation/board/achievementBubbles";
import type { AchievementBubble } from "~/types/achievements";

const Board = () => {
  const bubbles = useAchievementBubbles();
  return <span data-testid="bubbles">{bubbles().length}</span>;
};

afterEach(() => cleanup());

describe("achievement bubbles context", () => {
  it("a board with no match host (tutorial, demos) paints none", () => {
    render(() => <Board />);
    expect(screen.getByTestId("bubbles").textContent).toBe("0");
  });

  it("a match host's bubbles reach its board only while it is mounted", () => {
    const [bubbles, setBubbles] = createSignal<readonly AchievementBubble[]>([]);
    const [hosted, setHosted] = createSignal(true);
    render(() => (
      <>
        <Show when={hosted()}>
          <AchievementBubblesProvider value={bubbles}>
            <Board />
          </AchievementBubblesProvider>
        </Show>
        <Show when={!hosted()}>
          <Board />
        </Show>
      </>
    ));
    setBubbles([{ id: "a" } as AchievementBubble, { id: "b" } as AchievementBubble]);
    expect(screen.getByTestId("bubbles").textContent).toBe("2");
    setHosted(false);
    expect(screen.getByTestId("bubbles").textContent).toBe("0");
  });
});
