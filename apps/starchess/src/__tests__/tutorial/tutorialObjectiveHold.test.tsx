/**
 * The beat between objective-met and the ✓ Objective complete bubble. A lesson
 * whose closing coach line lands on the same board update gets that line read
 * first — the modal hides it, so without the hold it would flash past.
 */
import { cleanup, render, screen } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TutorialNarrationState } from "~/types/tutorial";

const fed = vi.hoisted(() => ({
  set: null as null | ((n: TutorialNarrationState) => void),
}));

vi.mock("~/tutorial/useLessonNarration", async (importOriginal) => {
  const real = await importOriginal<typeof import("~/tutorial/useLessonNarration")>();
  return {
    ...real,
    useLessonNarration: (...[board, sink]: Parameters<typeof real.useLessonNarration>) => {
      if (!sink) return;
      let live: () => TutorialNarrationState = () => ({});
      real.useLessonNarration(board, (source) => (live = source));
      const [override, setOverride] = createSignal<TutorialNarrationState | null>(null);
      fed.set = setOverride;
      sink(() => override() ?? live());
    },
  };
});

import { TutorialScreen } from "~/screens/TutorialScreen";
import { tutorialPath } from "~/tutorial/tutorialScript";
import type { TutorialSectionId } from "~/types/tutorial";

afterEach(() => {
  cleanup();
  fed.set = null;
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
  fed.set!({
    scfen,
    timelineActive: false,
    queue: [],
    targetingKind: null,
  });

/** Knight on g5 — fog/knight's `completeWhen` *and* its "Did you see that?!". */
const HOVERBIKE_G5 = "SCFEN|7k/7p/8/6N1/8/8/8/K7|1|33|P|G:11:11|Q:w:;b:";
/** King moved off the seed — fog/king completes with nothing left to say. */
const CC_MOVED = "SCFEN|7k/7p/8/4K3/8/8/8/8|1|33|P|G:11:11|Q:w:;b:";

describe("objective-complete hold", () => {
  it("reads the closing line before the modal takes the bubble", () => {
    vi.useFakeTimers();
    renderLesson("fog", "knight");

    settle(HOVERBIKE_G5);

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

    settle(CC_MOVED);

    // The intro is retired once the board moves and no reaction matches, so
    // there is no line to read — the modal takes the bubble on the same beat.
    expect(screen.getByTestId("tutorial-objective-complete")).not.toBeNull();
    expect(screen.getByTestId("tutorial-next-lesson")).not.toBeNull();
  });
});
