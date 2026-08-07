/**
 * StarChess menu sky prop — satellite (mid-left, Multiplayer anchor).
 */
import type { Component } from "solid-js";

import styles from "~/screens/menuSky/MenuSatellite.module.css";

export const MenuSatellite: Component = () => (
  <div
    class={styles.satellite}
    data-testid="menu-sky-satellite"
    aria-hidden="true"
  />
);
