/**
 * Review turn Prev/Next — tutorial-style green ‹ › flanking ResourceBars.
 * Replaces stacked DualNavButton in the review side rail.
 * // SPEC: _spec/apps/starchess/screens.puml
 */
import type { Component, JSX } from "solid-js";

import styles from "~/presentation/hud/ReviewTurnNav.module.css";

export type ReviewTurnNavProps = {
  onBack: () => void;
  onForward: () => void;
  backDisabled?: boolean;
  forwardDisabled?: boolean;
  /** Dual ResourceBars (or any top chrome) between the arrows. */
  children: JSX.Element;
};

export const ReviewTurnNav: Component<ReviewTurnNavProps> = (props) => (
  <div
    class={styles.row}
    data-testid="review-turn-nav"
    role="group"
    aria-label="Review turn"
  >
    <button
      type="button"
      class={styles.btn}
      disabled={props.backDisabled}
      onClick={() => props.onBack()}
      aria-label="Previous turn"
      data-testid="review-turn-prev"
    >
      <span class={styles.arrow} aria-hidden="true">
        ‹
      </span>
    </button>
    <div class={styles.center}>{props.children}</div>
    <button
      type="button"
      class={styles.btn}
      disabled={props.forwardDisabled}
      onClick={() => props.onForward()}
      aria-label="Next turn"
      data-testid="review-turn-next"
    >
      <span class={styles.arrow} aria-hidden="true">
        ›
      </span>
    </button>
  </div>
);
