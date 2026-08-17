// SPEC: _spec/apps/starchess/screens.puml
/**
 * Pure shell: green ‹ › flanking children (typically dual ResourceBars).
 * Domain wiring stays in BaseScreen / ReviewDemoScreen.
 */
import { createEffect, onCleanup, type Component, type JSX } from "solid-js";

import styles from "~/components/atoms/ReviewTurnNav.module.css";

export type ReviewTurnNavProps = {
  onBack: () => void;
  onForward: () => void;
  backDisabled?: boolean;
  forwardDisabled?: boolean;
  /**
   * Bind ← / → to these same arrows. The component that draws them owns the
   * keys, so a keypress and a click are the same call with the same disabled
   * guard. **One instance per screen** — a screen that renders the nav twice
   * (banner + header) must opt exactly one in, or every press steps twice.
   */
  keyboard?: boolean;
  /** Dual ResourceBars (or any top chrome) between the arrows. */
  children: JSX.Element;
};

/** Arrows mean "move the caret" in a field — leave those alone. */
const isTypingTarget = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (el.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export const ReviewTurnNav: Component<ReviewTurnNavProps> = (props) => {
  createEffect(() => {
    if (!props.keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      const back = e.key === "ArrowLeft";
      if (!back && e.key !== "ArrowRight") return;
      // Swallow the key either way — a disabled arrow should not scroll the
      // page as a consolation prize.
      e.preventDefault();
      if (back ? props.backDisabled : props.forwardDisabled) return;
      if (back) props.onBack();
      else props.onForward();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
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
};
