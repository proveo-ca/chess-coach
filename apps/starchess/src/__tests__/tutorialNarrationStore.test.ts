import { describe, expect, it } from "vitest";

import {
  resetTutorialNarration,
  setTutorialNarration,
  tutorialNarration,
} from "~/tutorial/tutorialNarrationStore";

describe("tutorialNarrationStore", () => {
  it("sets and resets narration bridge state", () => {
    setTutorialNarration({
      reviewPhase: "intent",
      timelineActive: true,
      scfen: "SCFEN|…",
      turn: 2,
    });
    expect(tutorialNarration().reviewPhase).toBe("intent");
    expect(tutorialNarration().turn).toBe(2);
    resetTutorialNarration();
    expect(tutorialNarration()).toEqual({});
  });
});
