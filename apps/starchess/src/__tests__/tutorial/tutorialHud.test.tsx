import { cleanup, render, screen } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { afterEach, describe, expect, it } from "vitest";

import { TutorialGuideBubble } from "~/components/features/TutorialGuideBubble";
import { LiveLessonHost } from "~/demos/LiveLessonHost";
import { lessonBoard } from "~/tutorial/tutorialScript";
import { LIVE_ADJUTANT_MATCH_TITLE } from "~/utils/matchTitle";

afterEach(() => cleanup());

const renderLesson = (props: Partial<Parameters<typeof LiveLessonHost>[0]>) => {
  const history = createMemoryHistory();
  history.set({ value: "/" });
  return render(() => (
    <MemoryRouter history={history}>
      <Route
        path="*"
        component={() => (
          <LiveLessonHost board={lessonBoard("king", "king-attack-3")} {...props} />
        )}
      />
    </MemoryRouter>
  ));
};

describe("tutorial guide bubble", () => {
  const renderBubble = (
    props: Partial<Parameters<typeof TutorialGuideBubble>[0]>,
  ) =>
    render(() => (
      <TutorialGuideBubble message="Nicely done." lineKey="k" {...props} />
    ));

  it("drops the line between ✓ Objective complete and Next lesson", () => {
    renderBubble({ variant: "success", action: { kind: "nextLesson" } });

    expect(screen.getByTestId("tutorial-objective-complete")).not.toBeNull();
    expect(screen.getByTestId("tutorial-next-lesson")).not.toBeNull();
    expect(screen.queryByText("Nicely done.")).toBeNull();
  });

  it("keeps the line when either end is missing", () => {
    // Last lesson of a stage: ✓ with no CTA — the line is all the player gets.
    renderBubble({ variant: "success" });
    expect(screen.getByText("Nicely done.")).not.toBeNull();
    cleanup();

    // Retry after a failure keeps the coach's explanation.
    renderBubble({ action: { kind: "retryLesson" } });
    expect(screen.getByText("Nicely done.")).not.toBeNull();
    expect(screen.queryByTestId("tutorial-objective-complete")).toBeNull();
  });
});

describe("king-attack-3 tutorial HUD", () => {
  it("final lesson renders the full match HUD like /single", () => {
    renderLesson({
      tutorial: true,
      fullMatchHud: true,
      turnChrome: "sidebar",
      matchTitle: LIVE_ADJUTANT_MATCH_TITLE,
      onExitToMenu: () => {},
      guideBubble: (
        <TutorialGuideBubble message="Hunt the enemy King." lineKey="final-test" />
      ),
    });

    expect(screen.getByTestId("live-match-title").textContent).toContain(
      LIVE_ADJUTANT_MATCH_TITLE,
    );
    // Live chrome shows the viewer bar only (dual bars are review-only).
    expect(screen.getByTestId("resource-bar")).not.toBeNull();
    expect(screen.getByTestId("turn-bar-sidebar")).not.toBeNull();
    expect(screen.getByTestId("turn-end")).not.toBeNull();
    expect(screen.getByTestId("live-back")).not.toBeNull();
    // Coaching still floats over the board; only the lesson-nav chrome is gone.
    expect(screen.getByTestId("tutorial-guide-bubble")).not.toBeNull();
    expect(screen.queryByTestId("tutorial-header")).toBeNull();
    expect(screen.queryByTestId("tutorial-mobile-hero")).toBeNull();
    // Match feedback (status line) is visible like /single.
    expect(screen.getByTestId("status-line")).not.toBeNull();
  });

  it("non-final lessons keep the coach header and no match HUD", () => {
    renderLesson({ tutorial: true, turnChrome: "sidebar" });

    expect(screen.getByTestId("tutorial-header")).not.toBeNull();
    expect(screen.queryByTestId("live-match-title")).toBeNull();
    expect(screen.queryByTestId("resource-bar")).toBeNull();
    expect(screen.queryByTestId("live-back")).toBeNull();
    expect(screen.queryByTestId("status-line")).toBeNull();
    expect(screen.getByTestId("turn-bar-sidebar")).not.toBeNull();
  });
});
