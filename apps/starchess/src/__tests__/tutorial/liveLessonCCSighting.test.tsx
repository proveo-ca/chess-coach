import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({ props: null as null | { hintAlertSquares?: readonly string[] } }));

vi.mock("~/app/BaseScreen.tsx", () => ({
  BaseScreen: (props: { hintAlertSquares?: readonly string[] }) => {
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

describe("LiveLessonHost CC sighting (alertLatch: cc)", () => {
  it("rings the enemy CC home square e8 before the CC has been seen", () => {
    const board = lessonBoard("live-play", "live-play-attack-4");
    render(() => <LiveLessonHost board={board} lessonKey="live-play-attack-4" tutorial />);
    expect(base.props?.hintAlertSquares).toContain("e8");
    expect(base.props?.hintAlertSquares).not.toContain("b7");
  });
});
