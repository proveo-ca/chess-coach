/**
 * The beat between objective-met and the ✓ Objective complete bubble. A lesson
 * whose closing coach line lands on the same board update gets that line read
 * first — the modal hides it, so without the hold it would flash past.
 */
import { cleanup, render, screen } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TutorialScreen } from "~/screens/TutorialScreen";
import {
  resetTutorialNarration,
  setTutorialNarration,
} from "~/tutorial/tutorialNarrationStore";
import { tutorialPath } from "~/tutorial/tutorialScript";
import type { TutorialSectionId } from "~/types/tutorial";

afterEach(() => {
  cleanup();
  resetTutorialNarration();
  vi.useRealTimers();
});

const renderLesson = (section: TutorialSectionId, story: string) => {
  const history = createMemoryHistory();
  history.set({ value: tutorialPath(section, story) });
  return render(() => (
    <MemoryRouter history={history}>
      <Route path="/tutorial/:section/:story" component={TutorialScreen} />
      <Route path="*" component={TutorialScreen} />
    </MemoryRouter>
  ));
};

/** Settled board, as `useLessonNarration` would publish it. */
const settle = (scfen: string) =>
  setTutorialNarration({
    scfen,
    timelineActive: false,
    queue: [],
    targetingKind: null,
    turn: 2,
  });

/** Knight on g5 — fog/knight's `completeWhen` *and* its "Did you see that?!". */
const KNIGHT_G5 = "SCFEN|7k/7p/8/6N1/8/8/8/K7|1|33|P|G:11:11|Q:w:;b:";
/** King moved off the seed — fog/king completes with nothing left to say. */
const KING_MOVED = "SCFEN|7k/7p/8/4K3/8/8/8/8|1|33|P|G:11:11|Q:w:;b:";

describe("objective-complete hold", () => {
  it("reads the closing line before the modal takes the bubble", () => {
    vi.useFakeTimers();
    renderLesson("fog", "knight");

    settle(KNIGHT_G5);

    // Objective is met, but the line that landed with it holds the bubble:
    // no badge, no CTA, and no countdown border (nothing is armed yet).
    expect(screen.getByText("Did you see that?!")).not.toBeNull();
    expect(screen.queryByTestId("tutorial-objective-complete")).toBeNull();
    expect(screen.queryByTestId("tutorial-next-lesson")).toBeNull();
    expect(screen.queryByTestId("tutorial-next-countdown")).toBeNull();

    vi.advanceTimersByTime(1200);

    // Handoff: badge + CTA + countdown, and the line is gone (it would be
    // redundant between them).
    expect(screen.getByTestId("tutorial-objective-complete")).not.toBeNull();
    expect(screen.getByTestId("tutorial-next-lesson")).not.toBeNull();
    expect(screen.getByTestId("tutorial-next-countdown")).not.toBeNull();
    expect(screen.queryByText("Did you see that?!")).toBeNull();
  });

  it("skips the hold when the lesson ends with nothing to say", () => {
    vi.useFakeTimers();
    renderLesson("fog", "king");

    settle(KING_MOVED);

    // The intro is retired once the board moves and no reaction matches, so
    // there is no line to read — the modal takes the bubble on the same beat.
    expect(screen.getByTestId("tutorial-objective-complete")).not.toBeNull();
    expect(screen.getByTestId("tutorial-next-lesson")).not.toBeNull();
  });
});
