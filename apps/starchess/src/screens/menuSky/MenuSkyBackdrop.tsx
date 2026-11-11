/**
 * Persistent menu sky backdrop — used behind live match (and reusable by shell).
 */
import type { Component } from "solid-js";

import type { MenuWorldId } from "~/screens/menuSky/MenuPlanet";
import styles from "~/screens/menuSky/MenuSkyBackdrop.module.css";

export type MenuSkyBackdropProps = {
  world?: MenuWorldId;
  class?: string;
};

export const MenuSkyBackdrop: Component<MenuSkyBackdropProps> = (props) => (
  <div
    class={`${styles.sky}${props.class ? ` ${props.class}` : ""}`}
    data-planet-world={props.world ?? "eclipse"}
    data-testid="menu-sky-backdrop"
    aria-hidden="true"
  >
    <div class={styles.nebula} />
    <div class={styles.skyWash} />
  </div>
);
