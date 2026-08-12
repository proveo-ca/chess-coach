// SPEC: _spec/apps/starchess/architecture/screen-entities.puml
/**
 * Shared live-match shell — sky + play layer (`/starchess/single` + live demos).
 */
import type { Component, JSX } from "solid-js";

import { MenuSkyBackdrop } from "~/screens/menuSky/MenuSkyBackdrop";
import type { BoardVariant } from "~/types/board";
import styles from "~/screens/LiveMatchShell.module.css";

export const LiveMatchShell: Component<{
  world?: BoardVariant;
  children: JSX.Element;
  /** Root test id — `starchess-app` for the SPA route. */
  testId?: string;
}> = (props) => (
  <div
    class={styles.shell}
    data-testid={props.testId ?? "starchess-live-shell"}
  >
    <MenuSkyBackdrop world={props.world ?? "eclipse"} />
    <div class={`starchess-play ${styles.playLayer}`} data-testid="starchess-play">
      {props.children}
    </div>
  </div>
);
