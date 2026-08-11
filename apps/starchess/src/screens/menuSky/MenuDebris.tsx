/**
 * StarChess menu sky prop — debris (upper-left, Single Player anchor).
 */
import type { Component } from "solid-js";

import styles from "~/screens/menuSky/MenuDebris.module.css";

export const MenuDebris: Component = () => (
  <div class={styles.debris} data-testid="menu-sky-debris" aria-hidden="true" />
);
