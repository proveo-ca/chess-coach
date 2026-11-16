// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import { For, createSignal, onCleanup, onMount, type Component } from "solid-js";

import styles from "./NetworkSignal.module.css";

export type NetworkSignalLevel = 1 | 2 | 3 | 4 | 5;

export type NetworkSignalProps = {
  /** Force bar level (story / tests). When omitted, wanders 1–5. */
  level?: NetworkSignalLevel;
  disabled?: boolean;
  class?: string;
  "data-testid"?: string;
};

const BARS = [1, 2, 3, 4, 5] as const;

const rollLevel = (avoid?: NetworkSignalLevel): NetworkSignalLevel => {
  let next = BARS[Math.floor(Math.random() * BARS.length)]!;
  if (avoid != null && next === avoid) {
    next = BARS[(BARS.indexOf(avoid) + 1 + Math.floor(Math.random() * 4)) % 5]!;
  }
  return next;
};

export const NetworkSignal: Component<NetworkSignalProps> = (props) => {
  const [flicker, setFlicker] = createSignal<NetworkSignalLevel>(5);

  onMount(() => {
    if (props.level != null) return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          setFlicker((v) => rollLevel(v));
          schedule();
        },
        900 + Math.random() * 1400,
      );
    };
    schedule();
    onCleanup(() => window.clearTimeout(timer));
  });

  const active = () => props.level ?? flicker();

  return (
    <div
      class={clsx(styles.root, props.disabled && styles.disabled, props.class)}
      role="img"
      aria-label={`Signal ${active()} of 5`}
      data-testid={props["data-testid"] ?? "network-signal"}
      data-level={active()}
      aria-hidden={props.disabled ? undefined : true}
    >
      <For each={[...BARS]}>
        {(n) => (
          <span
            class={clsx(styles.bar, active() >= n && styles.barOn)}
            data-bar={n}
            style={{ "--bar-i": String(n) }}
          />
        )}
      </For>
    </div>
  );
};
