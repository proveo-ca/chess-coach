// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import type { Component } from "solid-js";

import chessStyles from "./Toggle.chess.module.css";
import starchessStyles from "./Toggle.starchess.module.css";
import { useUiStyles } from "../UiProvider";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  testId?: string;
  class?: string;
}

export const Toggle: Component<ToggleProps> = (props) => {
  const styles = useUiStyles(chessStyles, starchessStyles);
  return (
    <div class={clsx(styles["toggle-container"], props.class)}>
      {props.label && <span class={styles["toggle-label"]}>{props.label}</span>}
      <label class={styles.switch}>
        <input
          type="checkbox"
          aria-label={props.label}
          checked={props.checked}
          onChange={(e) => props.onChange(e.currentTarget.checked)}
          data-testid={props.testId}
        />
        <span class={clsx(styles.slider, styles.round)} />
      </label>
    </div>
  );
};
