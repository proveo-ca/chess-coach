/** Circular countdown / progress ring with centered label. */
import type { JSX } from "solid-js";

import styles from "~/components/primitives/CountdownRing.module.css";

export type CountdownRingProps = {
  /** Fraction remaining in [0, 1]. */
  progress: number;
  children: JSX.Element;
  class?: string;
  "aria-label"?: string;
  "data-testid"?: string;
  "data-seconds"?: number | string;
};

const R = 18;
const C = 2 * Math.PI * R;

export const CountdownRing = (props: CountdownRingProps) => {
  const clamped = () => Math.min(1, Math.max(0, props.progress));
  const dashOffset = () => C * (1 - clamped());

  return (
    <div
      class={`${styles.gauge}${props.class ? ` ${props.class}` : ""}`}
      role="timer"
      aria-live="polite"
      aria-label={props["aria-label"]}
      data-testid={props["data-testid"]}
      data-seconds={props["data-seconds"]}
    >
      <svg class={styles.ring} viewBox="0 0 44 44" aria-hidden="true">
        <circle class={styles.track} cx="22" cy="22" r={R} />
        <circle
          class={styles.fill}
          cx="22"
          cy="22"
          r={R}
          stroke-dasharray={`${C}`}
          stroke-dashoffset={dashOffset()}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span class={styles.label}>{props.children}</span>
    </div>
  );
};
