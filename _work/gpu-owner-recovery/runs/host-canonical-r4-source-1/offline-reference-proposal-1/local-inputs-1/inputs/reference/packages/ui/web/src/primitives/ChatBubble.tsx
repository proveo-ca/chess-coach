// SPEC: _spec/_plans/chess-ui-primitives.puml
import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";

import chessStyles from "./ChatBubble.chess.module.css";
import starchessStyles from "./ChatBubble.starchess.module.css";
import { useUiStyles } from "../UiProvider";

export interface ChatBubbleProps {
  children: JSX.Element;
  exiting?: boolean;
  onClick?: () => void;
  class?: string;
  testId?: string;
  label?: string;
}

export const ChatBubble: Component<ChatBubbleProps> = (props) => {
  const styles = useUiStyles(chessStyles, starchessStyles);
  const cls = () => ({
    [styles.exiting]: !!props.exiting,
    ...(props.class ? { [props.class]: true } : {}),
  });

  return (
    <Show
      when={props.onClick}
      fallback={
        <div class={styles.bubble} classList={cls()} data-testid={props.testId} aria-hidden="true">
          {props.children}
        </div>
      }
    >
      <button
        type="button"
        class={styles.bubble}
        classList={{ [styles.interactive]: true, ...cls() }}
        data-testid={props.testId}
        aria-label={props.label}
        onClick={() => props.onClick?.()}
      >
        {props.children}
      </button>
    </Show>
  );
};
