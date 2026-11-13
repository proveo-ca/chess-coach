// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import { Show } from "solid-js";
import type { Component } from "solid-js";

import { Button } from "../primitives/Button.tsx";
import chessStyles from "./DualNavButton.chess.module.css";
import starchessStyles from "./DualNavButton.starchess.module.css";
import { useUiStyles } from "../UiProvider";
import { ChevronLeftIcon, ChevronRightIcon } from "../primitives/icons";

export interface DualNavButtonProps {
  onBack: () => void;
  onForward: () => void;
  backDisabled?: boolean;
  forwardDisabled?: boolean;
  inverted?: boolean;
  label?: string;
  showBackToLive?: boolean;
  onBackToLive?: () => void;

  inline?: boolean;

  vertical?: boolean;
}

export const DualNavButton: Component<DualNavButtonProps> = (props) => {
  const styles = useUiStyles(chessStyles, starchessStyles);
  return (
    <div
      class={clsx(styles.wrapper, props.inline && styles.inline, props.vertical && styles.vertical)}
    >
      <Show when={props.label}>
        <span class={styles.label}>{props.label}</span>
      </Show>
      <div class={clsx(styles["dual-nav"], props.inverted && styles.inverted)}>
        <Button
          class={clsx(styles.half, styles.left)}
          onClick={props.onBack}
          disabled={props.backDisabled}
          aria-label="Go back"
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          class={styles.half}
          onClick={props.onForward}
          disabled={props.forwardDisabled}
          aria-label="Go forward"
        >
          <ChevronRightIcon />
        </Button>
      </div>
      <Show when={props.showBackToLive}>
        <Button
          class={styles["back-to-live"]}
          onClick={() => props.onBackToLive?.()}
          disabled={!props.onBackToLive}
        >
          Back to Live
        </Button>
      </Show>
    </div>
  );
};
