/**
 * Typewriter turn/phase transcript — left/right arrows for tutorial resolve.
 */
import { For, createEffect, type Component } from "solid-js";

import styles from "~/components/features/TutorialTypewriterNav.module.css";
import type { TypewriterLine } from "~/types/tutorial";

export type TutorialTypewriterNavProps = {
  lines: readonly TypewriterLine[];
  /** Inclusive index of the last revealed / current line. */
  currentIndex: number;
  busy?: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export const TutorialTypewriterNav: Component<TutorialTypewriterNavProps> = (
  props,
) => {
  let listEl: HTMLDivElement | undefined;

  createEffect(() => {
    const idx = props.currentIndex;
    const root = listEl;
    if (!root) return;
    const row = root.querySelector(`[data-line-index="${idx}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  return (
    <div class={styles.nav} data-testid="tutorial-typewriter-nav">
      <button
        type="button"
        class={styles.arrow}
        disabled={!props.canPrev || props.busy}
        onClick={() => props.onPrev()}
        aria-label="Previous phase"
        data-testid="tutorial-typewriter-prev"
      >
        <span class={styles.arrowGlyph} aria-hidden="true">
          &lt;
        </span>
      </button>

      <div
        class={styles.transcript}
        ref={(el) => {
          listEl = el;
        }}
        role="log"
        aria-live="polite"
      >
        <For each={props.lines.slice(0, props.currentIndex + 1)}>
          {(line, i) => {
            const active = () => i() === props.currentIndex;
            const done = () => i() < props.currentIndex;
            return (
              <div
                class={styles.line}
                classList={{
                  [styles.indent]: !!line.indent,
                  [styles.active]: active(),
                  [styles.done]: done(),
                }}
                data-line-index={i()}
              >
                <span class={styles.text}>{line.text}</span>
                <span
                  class={styles.caret}
                  classList={{ [styles.caretOn]: active() && !props.busy }}
                  aria-hidden="true"
                />
              </div>
            );
          }}
        </For>
      </div>

      <button
        type="button"
        class={styles.arrow}
        disabled={!props.canNext || props.busy}
        onClick={() => props.onNext()}
        aria-label="Next phase"
        data-testid="tutorial-typewriter-next"
      >
        <span class={styles.arrowGlyph} aria-hidden="true">
          &gt;
        </span>
      </button>
    </div>
  );
};
