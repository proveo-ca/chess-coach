import { cleanup, render } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TutorialScreen } from "~/screens/TutorialScreen";
import { TUTORIAL_SCRIPT, tutorialPath } from "~/tutorial/tutorialScript";
import type { TutorialBeat } from "~/types/tutorial";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const INTRO_GATE = /\|Q:w:;/;
const isIntroBeat = (b: TutorialBeat) =>
  b.priority === 2 && b.turn != null && b.when?.kind === "scfen" && String(b.when.re) === String(INTRO_GATE);

const livePlay = TUTORIAL_SCRIPT.find((s) => s.id === "live-play")!;
const withIntro = livePlay.stories.filter((s) => s.beats?.[0] && isIntroBeat(s.beats[0]));

describe("live-play lesson-start line (first beat)", () => {
  it("every live-play lesson with an intro carries it as its first beat, not as `comment`", () => {
    expect(withIntro.length).toBeGreaterThanOrEqual(8);
    for (const story of withIntro) {
      expect(story.comment, story.id).toBe("");
      const seedTurn = Number(story.board!.scfen.split("|")[2]);
      expect(story.beats![0].turn, story.id).toBe(seedTurn);
    }
  });

  it.each(withIntro.map((s) => [s.id, s] as const))("%s shows its lesson-start line on mount", async (_id, story) => {
    vi.useFakeTimers();
    const history = createMemoryHistory();
    history.set({ value: tutorialPath("live-play", story.id) });
    const r = render(() => (
      <MemoryRouter history={history}>
        <Route path="/tutorial/:section/:story" component={TutorialScreen} />
      </MemoryRouter>
    ));
    const first = story.beats![0].say!.split("\n")[0].trim();
    for (const ms of [0, 50, 500, 2_000]) {
      await vi.advanceTimersByTimeAsync(ms);
      const bubble = r.container.querySelector("[data-testid=tutorial-guide-bubble]")?.textContent ?? "";
      expect(bubble, `${story.id} at +${ms}ms`).toContain(first);
    }
  });
});

describe("tutorial failure lines", () => {
  const stories = TUTORIAL_SCRIPT.flatMap((stage) => stage.stories.map((s) => [`${stage.id}/${s.id}`, s] as const));

  it("no placeholder copy is left", () => {
    for (const [id, story] of stories) {
      for (const beat of story.beats ?? []) expect(beat.say ?? "", id).not.toMatch(/^bruh$/i);
    }
  });

  it.each(stories.filter(([, s]) => s.restartWhen))("%s has an urgent failure beat with a Retry CTA", (_id, story) => {
    const fail = story.beats?.find(
      (b) => b.action?.kind === "retryLesson" && (b.priority ?? 0) >= 3 && b.say,
    );
    expect(fail).toBeDefined();
  });
});

describe("opening line after in-app navigation (section navs)", () => {
  const WALK = [
    ["specials", "cc"],
    ["specials", "marine"],
    ["specials", "hoverbike"],
    ["specials", "mecha"],
    ["specials", "ship"],
    ["resolve", "combat-chain"],
    ["resolve", "king-hunt"],
    ["live-play", "live-play-defense-3"],
    ["live-play", "live-play-attack-3"],
  ] as const;

  const openingLine = (stage: string, id: string) => {
    const story = TUTORIAL_SCRIPT.find((s) => s.id === stage)!.stories.find((s) => s.id === id)!;
    return (story.comment || story.beats![0]!.say!).split("\n")[0]!.trim();
  };

  it("each lesson opens on its own line when reached from the previous one in the same tab", async () => {
    vi.useFakeTimers();
    const history = createMemoryHistory();
    history.set({ value: tutorialPath("fog", "mine") });
    const r = render(() => (
      <MemoryRouter history={history}>
        <Route path="/tutorial/:section/:story" component={TutorialScreen} />
      </MemoryRouter>
    ));
    await vi.advanceTimersByTimeAsync(500);
    for (const [stage, id] of WALK) {
      history.set({ value: tutorialPath(stage, id) });
      await vi.advanceTimersByTimeAsync(500);
      const bubble = r.container.querySelector("[data-testid=tutorial-guide-bubble]")?.textContent ?? "";
      expect(bubble, `${stage}/${id}`).toContain(openingLine(stage, id));
    }
  });
});
