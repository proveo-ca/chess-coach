// SPEC: _spec/apps/starchess/navigation-chrome.md, _spec/apps/starchess/screens.puml
/**
 * Tall-phone footer HUD — one tray under the board holding the last queued
 * action, the gas rack and `[End Turn] [timer]`. The rack is fixed-width and
 * sits in the middle track, so a new chip or a spent canister never moves
 * either neighbour. Layout only: the host passes the three pieces in.
 */
import { Show, type Component, type JSX } from "solid-js";

import styles from "~/presentation/hud/components/HudDock.module.css";

export type HudDockProps = {
  queue?: JSX.Element;
  rack?: JSX.Element;
  controls?: JSX.Element;
  /** Centred across the whole tray — for a tray whose rack is hidden. */
  center?: JSX.Element;
  class?: string;
};

export const HudDock: Component<HudDockProps> = (props) => (
  <div
    class={`${styles.dock}${props.class ? ` ${props.class}` : ""}`}
    data-testid="hud-dock"
  >
    <div class={styles.queue}>{props.queue}</div>
    <div class={styles.rack}>{props.rack}</div>
    <div class={styles.controls}>{props.controls}</div>
    <Show when={props.center}>
      <div class={styles.center}>{props.center}</div>
    </Show>
  </div>
);
