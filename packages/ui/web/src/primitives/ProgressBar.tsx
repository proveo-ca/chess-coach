// SPEC: _spec/_plans/chess-ui-primitives.puml
import { type Component } from "solid-js";

import styles from "./ProgressBar.module.css";

export interface ProgressBarProps {
  progress: number;
  text?: string;
}

export const ProgressBar: Component<ProgressBarProps> = (props) => {
  // Ensure progress stays between 0 and 100 for the CSS width
  const clampedProgress = () => Math.max(0, Math.min(100, props.progress));

  return (
    <div class={styles["progress-wrapper"]}>
      <div class={styles["progress-container"]}>
        <div class={styles["progress-bar"]} style={{ width: `${clampedProgress()}%` }}></div>
      </div>
      {props.text && <p class={styles["progress-text"]}>{props.text}</p>}
    </div>
  );
};
