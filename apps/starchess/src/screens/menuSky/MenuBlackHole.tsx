/**
 * StarChess menu sky prop — black hole (Exit).
 * Rotating accretion disk + debris on decaying orbits (absorbed inward).
 */
import clsx from "clsx";
import { For, type Component } from "solid-js";

import styles from "~/screens/menuSky/MenuBlackHole.module.css";

export type MenuBlackHoleProps = {
  /** Relative layout inside {@link MenuAnchor} (not viewport-absolute). */
  embedded?: boolean;
};

/** Stable debris seeds — staggered orbit / absorb timings. */
const DEBRIS = [
  { i: 1, delay: "0s", dur: "4.2s", size: 3 },
  { i: 2, delay: "-0.7s", dur: "5.1s", size: 2 },
  { i: 3, delay: "-1.4s", dur: "3.6s", size: 4 },
  { i: 4, delay: "-2.1s", dur: "4.8s", size: 2 },
  { i: 5, delay: "-2.8s", dur: "3.9s", size: 3 },
  { i: 6, delay: "-3.5s", dur: "5.4s", size: 2 },
] as const;

export const MenuBlackHole: Component<MenuBlackHoleProps> = (props) => (
  <div
    class={clsx(styles.root, props.embedded && styles.embedded)}
    data-testid="menu-sky-black-hole"
    aria-hidden="true"
  >
    <div class={styles.glow} />
    <div class={styles.disk}>
      <div class={styles.diskRing} />
      <div class={styles.eventHorizon} />
    </div>
    <div class={styles.debrisLayer}>
      <For each={[...DEBRIS]}>
        {(d) => (
          <span
            class={styles.debris}
            data-debris={d.i}
            style={{
              "--debris-delay": d.delay,
              "--debris-dur": d.dur,
              "--debris-size": `${d.size}px`,
              "--debris-i": String(d.i),
            }}
          />
        )}
      </For>
    </div>
  </div>
);
