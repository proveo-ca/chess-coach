// SPEC: _spec/apps/starchess/screens.puml, _spec/apps/chess/responsiveness/rules.md, _spec/apps/starchess/architecture/reactivity/components.md
/**
 * Floating dismissible Selena line — a ChatBubble docked out of document flow
 * so the CoachScreen header avatar stays put. Where it docks is band-dependent
 * (gutter · over Kerrigan · over ranks 7–8); the stylesheet owns that call.
 */
import { Show, createMemo, createSignal, type Component } from "solid-js";

import { ChatBubble } from "@chess-coach/ui-web/primitives/ChatBubble";
import styles from "~/components/features/TutorialGuideBubble.module.css";
import type { TutorialReactionAction } from "~/types/tutorial";

export type TutorialGuideBubbleProps = {
  message: string;
  /** Stable id for the current line — dismiss only hides this id. */
  lineKey: string;
  action?: TutorialReactionAction;
  onAction?: (action: TutorialReactionAction) => void;
  /** `success` marks the objective complete — check mark + accent. */
  variant?: "coach" | "success";
  /**
   * Milliseconds until the action fires on its own. Draws a border around the
   * button over exactly this long, so the auto-press is visible before it
   * happens rather than surprising the player.
   */
  autoAdvanceMs?: number;
  /**
   * Drop the coach's line and show only the action (and the success mark).
   * Nothing renders when there is no action. The dynamic band (short
   * landscape) has no room for coach text over the board.
   */
  actionOnly?: boolean;
};

export const TutorialGuideBubble: Component<TutorialGuideBubbleProps> = (
  props,
) => {
  const [dismissedKey, setDismissedKey] = createSignal<string | null>(null);
  const variant = createMemo(() => props.variant ?? "coach");
  const counting = createMemo(() => props.autoAdvanceMs != null);
  const open = () =>
    dismissedKey() !== props.lineKey &&
    (props.actionOnly ? !!props.action : !!props.message.trim());

  /**
   * "✓ Objective complete" plus the Next lesson button already say everything
   * the player needs, so the coach line between them is noise — drop it when
   * both ends are showing.
   */
  const showMessage = () =>
    !props.actionOnly &&
    !(variant() === "success" && props.action?.kind === "nextLesson");

  return (
    <Show when={open()}>
      <div
        class={`tutorial-guide-bubble ${styles.dock}`}
        classList={{ [styles.success!]: variant() === "success" }}
        data-testid="tutorial-guide-bubble"
        data-variant={variant()}
      >
        <ChatBubble
          testId="tutorial-selena-bubble"
          class={styles.bubble}
        >
          <div class={styles.body}>
            {/* Holds the × corner so the text wraps around it; the button
                itself sits outside the bubble, which is aria-hidden. */}
            <span class={styles.dismissSpace} aria-hidden="true" />
            <Show when={variant() === "success"}>
              <span
                class={styles.successMark}
                data-testid="tutorial-objective-complete"
              >
                ✓ Objective complete
              </span>
            </Show>
            <Show when={showMessage()}>
              <span class={styles.message}>{props.message}</span>
            </Show>
            <Show when={props.action}>
              {(action) => (
                <button
                  type="button"
                  class={styles.action}
                  classList={{ [styles.counting!]: counting() }}
                  style={
                    counting()
                      ? { "--auto-advance": `${props.autoAdvanceMs}ms` }
                      : undefined
                  }
                  data-testid={
                    action().kind === "retryLesson"
                      ? "tutorial-selena-retry"
                      : action().kind === "nextLesson"
                        ? "tutorial-next-lesson"
                        : "tutorial-selena-action"
                  }
                  onClick={() => props.onAction?.(action())}
                >
                  <Show when={counting()}>
                    {/*
                      pathLength normalizes the perimeter to 100 so one
                      dashoffset animation draws the whole border regardless of
                      the button's size. Stroke straddles the edge — 4px read.
                    */}
                    <svg
                      class={styles.countdown}
                      data-testid="tutorial-next-countdown"
                      aria-hidden="true"
                    >
                      <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        rx="6"
                        pathLength="100"
                      />
                    </svg>
                  </Show>
                  <span class={styles.actionLabel}>
                    {action().kind === "retryLesson"
                      ? (action().label ?? "Retry lesson")
                      : action().kind === "nextLesson"
                        ? (action().label ?? "Next lesson →")
                        : action().label}
                  </span>
                </button>
              )}
            </Show>
          </div>
        </ChatBubble>
        <button
          type="button"
          class={styles.dismiss}
          aria-label="Dismiss message"
          data-testid="tutorial-selena-bubble-dismiss"
          onClick={() => setDismissedKey(props.lineKey)}
        >
          ×
        </button>
      </div>
    </Show>
  );
};
