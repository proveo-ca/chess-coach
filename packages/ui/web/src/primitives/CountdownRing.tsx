// SPEC: _spec/_plans/chess-ui-primitives.puml
/** Circular countdown / progress ring with centered label. */
import type { JSX } from "solid-js";

import styles from "./CountdownRing.module.css";

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
  const seconds = () => {
    const raw = props["data-seconds"];
    if (raw === undefined || raw === null || raw === "") return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  /** Pulse the digit when ≤3s remain. */
  const urgent = () => {
    const s = seconds();
    return s != null && s <= 3 && s >= 0;
  };

  return (
    <div
      class={`${styles.gauge}${props.class ? ` ${props.class}` : ""}`}
      role="timer"
      aria-live="polite"
      aria-label={props["aria-label"]}
      data-testid={props["data-testid"]}
      data-seconds={props["data-seconds"]}
      data-urgent={urgent() ? "true" : undefined}
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
      <span classList={{ [styles.label]: true, [styles.labelUrgent]: urgent() }}>
        {props.children}
      </span>
    </div>
  );
};
