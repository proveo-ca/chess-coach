import { describe, expect, it } from "vitest";

import {
  resetReviewVisionFilter,
  reviewVisionFilter,
  setReviewVisionFilter,
} from "~/store/reviewVisionStore";

describe("reviewVisionStore", () => {
  it("filters both / single-side and resets", () => {
    expect(reviewVisionFilter()).toBe("both");
    setReviewVisionFilter("w");
    expect(reviewVisionFilter()).toBe("w");
    setReviewVisionFilter("b");
    expect(reviewVisionFilter()).toBe("b");
    resetReviewVisionFilter();
    expect(reviewVisionFilter()).toBe("both");
  });
});
