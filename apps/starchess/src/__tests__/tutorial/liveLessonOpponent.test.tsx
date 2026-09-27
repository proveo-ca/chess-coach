import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({ props: null as null | { autoQueueOpponent?: unknown } }));

vi.mock("~/app/BaseScreen.tsx", () => ({
  BaseScreen: (props: { autoQueueOpponent?: unknown }) => {
    base.props = props;
    return null;
  },
}));

import { LiveLessonHost } from "~/demos/LiveLessonHost";
import { lessonBoard } from "~/tutorial/tutorialScript";

afterEach(() => {
  cleanup();
  base.props = null;
});

const walk = (from: string, to: string) => {
  const [story, setStory] = createSignal(from);
  render(() => (
    <LiveLessonHost board={lessonBoard("live-play", story())} lessonKey={story()} tutorial />
  ));
  return () => setStory(to);
};

describe("LiveLessonHost opponent across stories in one section", () => {
  it("defense-1 → attack-3 arms the adjutant", () => {
    const next = walk("live-play-defense-1", "live-play-attack-3");
    expect(base.props?.autoQueueOpponent).toBeUndefined();
    next();
    expect(base.props?.autoQueueOpponent).toBeTypeOf("function");
  });

  it("attack-1 → attack-4 arms the adjutant", () => {
    const next = walk("live-play-attack-1", "live-play-attack-4");
    next();
    expect(base.props?.autoQueueOpponent).toBeTypeOf("function");
  });

  it("attack-3 → defense-1 disarms it", () => {
    const next = walk("live-play-attack-3", "live-play-defense-1");
    expect(base.props?.autoQueueOpponent).toBeTypeOf("function");
    next();
    expect(base.props?.autoQueueOpponent).toBeUndefined();
  });
});
