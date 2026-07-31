import { createSignal, onCleanup, onMount, type Component } from "solid-js";

import {
  clearTurnDeadline,
  startPlanningTimer,
  turnDeadlineAt,
  turnSecondsRemaining,
} from "~/broodwar/broodWarStore";
import { TURN_TIMEOUT_MS } from "~/broodwar/constants";
import styles from "~/components/atoms/TurnBar.module.css";

type TurnBarProps = {
  /** Called when the player presses End (submit / pass current plan). */
  onEnd?: () => void;
  /** Called when the planning timer hits 0. */
  onTimeout?: () => void;
  /** Seed the 10s gauge on mount when no deadline is set (default true). */
  autoStart?: boolean;
};

const R = 18;
const C = 2 * Math.PI * R;

/**
 * Brood War turn chrome — End control + circular countdown (default 10s).
 * Replaces player-side captured pieces under the board.
 */
export const TurnBar: Component<TurnBarProps> = (props) => {
  const [now, setNow] = createSignal(Date.now());
  let timedOut = false;

  onMount(() => {
    if (props.autoStart !== false && turnDeadlineAt() == null) {
      startPlanningTimer();
    }
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (!timedOut && turnDeadlineAt() != null && turnSecondsRemaining() <= 0) {
        timedOut = true;
        clearTurnDeadline();
        props.onTimeout?.();
      }
    }, 200);
    onCleanup(() => window.clearInterval(id));
  });

  const seconds = () => {
    void now();
    return turnSecondsRemaining();
  };

  const progress = () => {
    const total = TURN_TIMEOUT_MS / 1000;
    return Math.min(1, Math.max(0, seconds() / total));
  };

  const dashOffset = () => C * (1 - progress());

  return (
    <div class={styles.bar} data-testid="turn-bar" role="group" aria-label="Turn">
      <button
        type="button"
        class={styles.end}
        data-testid="turn-end"
        onClick={() => props.onEnd?.()}
      >
        End
      </button>
      <div
        class={styles.gauge}
        role="timer"
        aria-live="polite"
        aria-label={`${seconds()} seconds remaining`}
        data-seconds={seconds()}
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
        <span class={styles.seconds}>{seconds()}</span>
      </div>
    </div>
  );
};
