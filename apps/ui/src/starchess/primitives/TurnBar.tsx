import { For, Show, createSignal, onCleanup, onMount, type Component } from "solid-js";

import {
  clearTurnDeadline,
  currentQueue,
  endPlanningTurn,
  planningSnapshot,
  startPlanningTimer,
  turnDeadlineAt,
  turnSecondsRemaining,
} from "~/starchess/starChessStore";
import { TURN_TIMEOUT_MS } from "~/starchess/constants";
import styles from "~/starchess/primitives/TurnBar.module.css";
import type { ScAction } from "~/types/starchess";
import { activePlayerColor } from "~/store/settingsStore";

type TurnBarProps = {
  /** Called when the player presses End (after store endPlanningTurn when a snap is set). */
  onEnd?: () => void;
  /** Called when the planning timer hits 0. */
  onTimeout?: () => void;
  /** Seed the 10s gauge on mount when no deadline is set (default true). */
  autoStart?: boolean;
  /**
   * When true (default), End/timeout call `endPlanningTurn` if a planning snap
   * is loaded. Stories that only demo chrome can set false.
   */
  resolveOnEnd?: boolean;
};

const R = 18;
const C = 2 * Math.PI * R;

const badgeLabel = (a: ScAction): string => {
  if (a.timing === "C") return `C ${a.from}→${a.to}`;
  const to = a.to ? `→${a.to}` : "";
  return `${a.timing} ${a.kind}${to ? ` ${a.from}${to}` : ` ${a.from}`}`;
};

/**
 * StarChess turn chrome — queue badges + End + circular countdown (default 10s).
 * Queue is read from `starChessStore.currentQueue` only (never synthesized here).
 */
export const TurnBar: Component<TurnBarProps> = (props) => {
  const [now, setNow] = createSignal(Date.now());
  let timedOut = false;

  const resolveIfArmed = () => {
    if (props.resolveOnEnd === false) return;
    if (!planningSnapshot()) return;
    endPlanningTurn();
  };

  onMount(() => {
    if (props.autoStart !== false && turnDeadlineAt() == null) {
      startPlanningTimer();
    }
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (!timedOut && turnDeadlineAt() != null && turnSecondsRemaining() <= 0) {
        timedOut = true;
        clearTurnDeadline();
        resolveIfArmed();
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

  const sideQueue = () => {
    const color = activePlayerColor();
    return currentQueue()
      .filter((a) => a.color === color)
      .slice()
      .sort((a, b) => a.seq - b.seq);
  };

  const befores = () => sideQueue().filter((a) => a.timing === "B");
  const classical = () => sideQueue().find((a) => a.timing === "C") ?? null;
  const afters = () => sideQueue().filter((a) => a.timing === "F");

  return (
    <div class={styles.bar} data-testid="turn-bar" role="group" aria-label="Turn">
      <div class={styles.queue} data-testid="turn-queue" aria-label="Action queue">
        <For each={befores()}>
          {(a) => (
            <span class={`${styles.badge} ${styles.badgeB}`} data-timing="B">
              {badgeLabel(a)}
            </span>
          )}
        </For>
        <Show
          when={classical()}
          fallback={
            <span class={`${styles.badge} ${styles.badgeCEmpty}`} data-timing="C">
              C —
            </span>
          }
        >
          {(c) => (
            <span class={`${styles.badge} ${styles.badgeC}`} data-timing="C">
              {badgeLabel(c())}
            </span>
          )}
        </Show>
        <For each={afters()}>
          {(a) => (
            <span class={`${styles.badge} ${styles.badgeF}`} data-timing="F">
              {badgeLabel(a)}
            </span>
          )}
        </For>
      </div>
      <button
        type="button"
        class={styles.end}
        data-testid="turn-end"
        onClick={() => {
          resolveIfArmed();
          props.onEnd?.();
        }}
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
