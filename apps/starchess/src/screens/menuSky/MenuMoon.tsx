/**
 * StarChess menu sky prop — eclipsed planet / moon (upper-right, Review).
 */
import clsx from "clsx";
import type { Component } from "solid-js";

import styles from "~/screens/menuSky/MenuMoon.module.css";

export type MenuMoonProps = {
  /** Relative layout inside {@link MenuAnchor} (not viewport-absolute). */
  embedded?: boolean;
};

export const MenuMoon: Component<MenuMoonProps> = (props) => (
  <div
    class={clsx(styles.moon, props.embedded && styles.embedded)}
    data-testid="menu-sky-moon"
    aria-hidden="true"
  />
);
