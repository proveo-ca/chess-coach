// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Characterization of every live tutorial lesson — seeds, occupied squares, and
 * HUD chrome per lesson. Pins behavior across the LiveLessonHost collapse:
 * whatever renders today must still render after the six hosts become one.
 */
import { cleanup, render } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { parseScFen, placementToMap } from "@chess-coach/starchess-core";
import { afterEach, describe, expect, it } from "vitest";

import { TutorialScreen } from "~/screens/TutorialScreen";
import {
  TUTORIAL_SCRIPT,
  tutorialPath,
} from "~/tutorial/tutorialScript";
import type { TutorialSectionId } from "~/types/tutorial";

afterEach(() => cleanup());

/** Every lesson that seeds a live board, as `section/story`. */
const LIVE_LESSONS: { section: TutorialSectionId; story: string }[] =
  TUTORIAL_SCRIPT.flatMap((stage) =>
    stage.stories
      .filter((s) => s.board != null)
      .map((s) => ({ section: stage.id, story: s.id })),
  );

const CHROME = [
  "chessboard",
  "resource-bar",
  "turn-bar",
  "turn-end",
  "starchess-gas-deploy",
  "starchess-side-rail",
  "tutorial-header",
  "tutorial-footer-nav",
  "status-line",
] as const;

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

/**
 * Rendered fingerprint — HUD parts on show, plus board/piece counts so a
 * changed seed or a dropped fog veil shows up as a snapshot diff.
 */
const fingerprint = (container: HTMLElement): string => {
  const chrome = CHROME.filter(
    (id) => container.querySelector(`[data-testid="${id}"]`) != null,
  );
  const squares = container.querySelectorAll("[data-square]").length;
  // `data-piece` is skin-independent: inline units (nerd) and the cburnett
  // `<img>` both carry it, so this count survives a piece-set swap.
  const pieces = container.querySelectorAll("[data-square] [data-piece]").length;
  return [`squares=${squares}`, `pieces=${pieces}`, ...chrome].join(",");
};

describe("tutorial lesson catalog", () => {
  it("covers every live lesson", () => {
    expect(LIVE_LESSONS.map((l) => `${l.section}/${l.story}`)).toEqual([
      "fog/king",
      "fog/pawn",
      "fog/knight",
      "fog/bishop",
      "fog/rook-tank",
      "fog/rook-siege",
      "fog/queen",
      "fog/mine",
      "specials/marine",
      "specials/cc",
      "specials/hoverbike",
      "specials/mecha",
      "specials/ship",
      "specials/tank",
      "king/king-defense",
      "king/king-defense-2",
      "king/king-defense-3",
      "king/king-defense-4",
      "king/king-defense-5",
      "king/king-defense-6",
      "king/king-attack-1",
      "king/king-attack-2",
      "king/king-attack-3",
    ]);
  });

  it("the last lesson of the last stage ends the tutorial", () => {
    // Success there must not offer a `Next lesson` CTA — there is nowhere to
    // go, and graduation is the lesson's own choreography.
    const lastStage = TUTORIAL_SCRIPT[TUTORIAL_SCRIPT.length - 1]!;
    const lastStory = lastStage.stories[lastStage.stories.length - 1]!;
    expect(`${lastStage.id}/${lastStory.id}`).toBe("king/king-attack-3");
    expect(lastStory.board?.choreography).toBe("kingHuntGraduation");
  });

  it("every live lesson can be completed", () => {
    // A lesson without `completeWhen` is a dead end — the player reaches it and
    // the tutorial never advances (fog/mine shipped this way).
    const deadEnds = TUTORIAL_SCRIPT.flatMap((stage) =>
      stage.stories
        .filter((s) => s.board != null && s.completeWhen == null)
        .map((s) => `${stage.id}/${s.id}`),
    );
    expect(deadEnds).toEqual([]);
  });

  it("every lesson seed parses and places pieces", () => {
    for (const { section, story } of LIVE_LESSONS) {
      const board = TUTORIAL_SCRIPT.find((s) => s.id === section)!.stories.find(
        (s) => s.id === story,
      )!.board!;
      const snap = parseScFen(board.scfen);
      expect(placementToMap(snap.placement).size, `${section}/${story}`).toBeGreaterThan(0);
    }
  });

  describe.each(LIVE_LESSONS)("$section/$story", ({ section, story }) => {
    it("mounts with a board and a stable chrome fingerprint", () => {
      const { container } = renderLesson(section, story);
      const squares = container.querySelectorAll("[data-square]");
      expect(squares.length, "board squares").toBeGreaterThan(0);
      expect(fingerprint(container)).toMatchSnapshot();
    });
  });
});
