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
    });
    expect(tutorialNarration().reviewPhase).toBe("intent");
    resetTutorialNarration();
    expect(tutorialNarration()).toEqual({});
  });
});
