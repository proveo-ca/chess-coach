// SPEC: _spec/_plans/chess-ui-primitives.puml
/** Positioned glyph marker — rises and fades in place over its life. */
import type { Component } from "solid-js";

import styles from "./Bubble.module.css";

export type BubbleProps = {
  icon: string;
  tint: string;
  left: string;
  top: string;
  width: string;
  height: string;
  /** Negative px distance the mark rises before fading. */
  rise: string;
  class?: string;
  "data-testid"?: string;
  "data-short-id"?: string;
  "data-origin"?: string;
  "data-level"?: number | string;
};

export const Bubble: Component<BubbleProps> = (props) => (
  <div
    class={props.class ? `${styles.bubble} ${props.class}` : styles.bubble}
    style={{
      left: props.left,
      top: props.top,
      width: props.width,
      height: props.height,
      "--bubble-rise": props.rise,
      "--glyph": props.tint,
      "--glyph-url": `url("${props.icon}")`,
    }}
    data-testid={props["data-testid"]}
    data-short-id={props["data-short-id"]}
    data-origin={props["data-origin"]}
    data-level={props["data-level"]}
  >
    <span class={styles.mark} />
  </div>
);
