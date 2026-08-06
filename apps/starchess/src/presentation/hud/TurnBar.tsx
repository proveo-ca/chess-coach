/**
 * StarChess turn chrome — queue badges + End + circular countdown (default 10s).
 */
import { For, Show, createEffect, createSignal, onCleanup, onMount, type Component } from "solid-js";
import type { ScAction } from "@chess-coach/starchess-core";

import { useMatchStore } from "~/app/MatchStoreContext";
import {
  currentQueue,
  turnDeadlineAt,
  turnSecondsRemaining,
  viewerColor,
} from "~/app/matchEconomy";
import { canSubmit } from "~/app/selectors";
import { TURN_TIMEOUT_MS } from "~/presentation/constants";
import styles from "~/presentation/hud/TurnBar.module.css";

type TurnBarProps = {
  /** Called when the player presses End (after store submit when resolveOnEnd). */
  onEnd?: () => void;
  /** Called when the planning timer hits 0. */
  onTimeout?: () => void;
  /** Seed the 10s gauge on mount when no deadline is set (default true). */
  autoStart?: boolean;
  /**
   * When true (default), End/timeout call `submitTurn` if planning is open.
   * Stories that only demo chrome can set false and handle via onEnd.
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

export const TurnBar: Component<TurnBarProps> = (props) => {
  const store = useMatchStore();
  const [now, setNow] = createSignal(Date.now());
  /** Deadline timestamp we already fired for — reset when a new planning window arms. */
  let firedForDeadline: number | null = null;

  const resolveIfArmed = () => {
    if (props.resolveOnEnd === false) return;
    if (!canSubmit(store.state())) return;
    store.submitTurn("end");
  };

  onMount(() => {
    if (props.autoStart !== false && turnDeadlineAt(store) == null) {
      store.armTimer();
    }
    const id = window.setInterval(() => {
      setNow(Date.now());
      const deadline = turnDeadlineAt(store);
      if (deadline == null) return;
      if (turnSecondsRemaining(store) > 0) return;
      if (firedForDeadline === deadline) return;
      firedForDeadline = deadline;
      store.dispatch({ type: "SET_DEADLINE", at: null });
      if (props.resolveOnEnd === false) {
        props.onTimeout?.();
        return;
      }
      if (canSubmit(store.state())) store.submitTurn("timeout");
      props.onTimeout?.();
    }, 200);
    onCleanup(() => window.clearInterval(id));
  });

  // New planning window (after End / resolve) → allow another AFK timeout.
  createEffect(() => {
    const deadline = turnDeadlineAt(store);
    if (deadline != null && deadline !== firedForDeadline) {
      firedForDeadline = null;
    }
  });

  const seconds = () => {
    void now();
    return turnSecondsRemaining(store);
  };

  const progress = () => {
    const total = TURN_TIMEOUT_MS / 1000;
    return Math.min(1, Math.max(0, seconds() / total));
  };

  const dashOffset = () => C * (1 - progress());

  const sideQueue = () => {
    const color = viewerColor(store);
    return currentQueue(store)
      .filter((a) => a.color === color)
      .slice()
      .sort((a, b) => a.seq - b.seq);
  };

  const befores = () => sideQueue().filter((a) => a.timing === "B");
  const classical = () => sideQueue().find((a) => a.timing === "C") ?? null;
  const afters = () => sideQueue().filter((a) => a.timing === "F");

  const removeChip = (a: ScAction, e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      store.dispatch({ type: "REMOVE_ACTION", seq: a.seq });
    } catch {
      // No planning snap / already gone — ignore.
    }
  };

  const chip = (a: ScAction, badgeClass: string) => (
    <span
      class={`${styles.badge} ${badgeClass}`}
      data-timing={a.timing}
      data-seq={a.seq}
    >
      <span class={styles.badgeText}>{badgeLabel(a)}</span>
      <button
        type="button"
        class={styles.badgeRemove}
        data-testid={`queue-remove-${a.seq}`}
        aria-label={`Remove ${badgeLabel(a)}`}
        onClick={(e) => removeChip(a, e)}
      >
        ×
      </button>
    </span>
  );

  return (
    <div class={styles.bar} data-testid="turn-bar" role="group" aria-label="Turn">
      <div class={styles.queue} data-testid="turn-queue" aria-label="Action queue">
        <For each={befores()}>{(a) => chip(a, styles.badgeB)}</For>
        <Show
          when={classical()}
          fallback={
            <span class={`${styles.badge} ${styles.badgeCEmpty}`} data-timing="C">
              C —
            </span>
          }
        >
          {(c) => chip(c(), styles.badgeC)}
        </Show>
        <For each={afters()}>{(a) => chip(a, styles.badgeF)}</For>
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
