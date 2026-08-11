/**
 * Shared menu sky layer — same shell as StarChessMenuScreen.
 * Stories pass sky prop children so absolute layout matches the full menu.
 */
import type { Component, JSX } from "solid-js";

import styles from "~/screens/menuSky/MenuSkyStage.module.css";

export type MenuSkyStageProps = {
  children: JSX.Element;
  /** Caption under the frame (Storybook only). */
  label?: string;
  /** Optional world id for bottom-left ambient wash. */
  planetWorld?: "eclipse" | "butter" | "vermeer";
};

export const MenuSkyStage: Component<MenuSkyStageProps> = (props) => (
  <div class={styles.root}>
    <div
      class={styles.sky}
      data-planet-world={props.planetWorld}
      aria-hidden="true"
    >
      <div class={styles.nebula} />
      <div class={styles.skyWash} />
      {props.children}
    </div>
    {props.label ? <p class={styles.caption}>{props.label}</p> : null}
  </div>
);
