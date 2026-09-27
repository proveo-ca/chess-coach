import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TutorialHudLabels } from "~/components/features/TutorialHudLabels";
import { specialCopyFor } from "~/presentation/specials/copy";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const Pickers = () => (
  <>
    <div data-testid="deploy-modal">
      <button data-spawn-piece="p">p</button>
      <button data-spawn-piece="n">n</button>
    </div>
    <div data-testid="promotion-modal">
      <button data-promo-piece="q">
        <span>BattleShip</span>
      </button>
      <button data-promo-piece="r">
        <span>Tank</span>
      </button>
    </div>
  </>
);

describe("TutorialHudLabels", () => {
  it("labels the deploy tiles but not the promotion tiles, which name themselves", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    let left = 0;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => {
      left += 60;
      return { left, right: left + 40, top: 100, bottom: 140, width: 40, height: 40, x: left, y: 100, toJSON: () => ({}) } as DOMRect;
    });
    render(() => (
      <>
        <Pickers />
        <TutorialHudLabels enabled />
      </>
    ));
    for (let i = 0; i < 5; i++) vi.advanceTimersToNextFrame();
    const labels = screen.getByTestId("tutorial-hud-labels").textContent ?? "";
    expect(labels).toContain(specialCopyFor("p")!.unit);
    expect(labels).toContain(specialCopyFor("n")!.unit);
    expect(labels).not.toContain(specialCopyFor("q")!.unit);
    expect(labels).not.toContain(specialCopyFor("r")!.unit);
  });
});
