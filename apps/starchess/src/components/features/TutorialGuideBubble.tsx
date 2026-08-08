/**
 * Floating dismissible Selena line — ChatBubble over board ranks 7–8.
 * Out of document flow so the CoachScreen header avatar stays put.
 */
import { Show, createSignal, type Component } from "solid-js";

import { ChatBubble } from "~/components/primitives/ChatBubble";
import styles from "~/components/features/TutorialGuideBubble.module.css";
import type { TutorialReactionAction } from "~/types/tutorial";

export type TutorialGuideBubbleProps = {
  message: string;
  /** Stable id for the current line — dismiss only hides this id. */
  lineKey: string;
  action?: TutorialReactionAction;
  onAction?: (action: TutorialReactionAction) => void;
};

export const TutorialGuideBubble: Component<TutorialGuideBubbleProps> = (
  props,
) => {
  const [dismissedKey, setDismissedKey] = createSignal<string | null>(null);
  const open = () =>
    !!props.message.trim() && dismissedKey() !== props.lineKey;

  return (
    <Show when={open()}>
      <div
        class={`tutorial-guide-bubble ${styles.dock}`}
        data-testid="tutorial-guide-bubble"
      >
        <ChatBubble
          testId="tutorial-selena-bubble"
          class={styles.bubble}
        >
          <div class={styles.body}>
            <span class={styles.message}>{props.message}</span>
            <Show when={props.action?.kind === "retryLesson"}>
              <button
                type="button"
                class={styles.action}
                data-testid="tutorial-selena-retry"
                onClick={() => {
                  if (props.action) props.onAction?.(props.action);
                }}
              >
                {props.action?.label ?? "Retry lesson"}
              </button>
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
