/**
 * Review observer vision filter — BOTH (dual borders) or single-side fog.
 */
import { createSignal } from "solid-js";

import type { ReviewVisionFilter } from "~/types/board";

export type { ReviewVisionFilter };

const [getReviewVisionFilter, setReviewVisionFilterSignal] =
  createSignal<ReviewVisionFilter>("both");

export const reviewVisionFilter = getReviewVisionFilter;
export const setReviewVisionFilter = (v: ReviewVisionFilter) =>
  setReviewVisionFilterSignal(v);
export const resetReviewVisionFilter = () => setReviewVisionFilterSignal("both");
