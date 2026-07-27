import type { Component } from "solid-js";

import {
  deployedSupply,
  materialIncome,
  maxDeployedSupply,
  storedMaterial,
} from "~/broodwar/broodWarStore";
import styles from "~/components/primitives/ResourceBar.module.css";

/**
 * Brood War resource chrome — reads the active player's economy from
 * `broodWarStore`. Only the deploy cap (50) is a static constant.
 */
export const ResourceBar: Component = () => (
  <div class={styles.bar} data-testid="resource-bar" role="group" aria-label="Resources">
    <div class={styles.strip} title="Stored material + income per turn">
      <span class={styles.icon} aria-hidden="true">
        <BlocksIcon />
      </span>
      <span class={styles.value}>
        {storedMaterial()}
        <span class={styles.income}>+{materialIncome()}</span>
      </span>
    </div>
    <div class={styles.strip} title="Deployed material / max">
      <span class={styles.icon} aria-hidden="true">
        <SupplyIcon />
      </span>
      <span class={styles.value}>
        {deployedSupply()}
        <span class={styles.muted}>/{maxDeployedSupply}</span>
      </span>
    </div>
  </div>
);

const BlocksIcon: Component = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="2" y="8" width="6" height="6" rx="1" fill="currentColor" opacity="0.9" />
    <rect x="10" y="8" width="6" height="6" rx="1" fill="currentColor" opacity="0.75" />
    <rect x="6" y="3" width="6" height="6" rx="1" fill="currentColor" />
  </svg>
);

/** Blocks + people (supply). */
const SupplyIcon: Component = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="1.5" y="10" width="5" height="5" rx="0.8" fill="currentColor" opacity="0.7" />
    <rect x="5" y="6" width="5" height="5" rx="0.8" fill="currentColor" opacity="0.85" />
    <circle cx="13" cy="6.5" r="2.2" fill="currentColor" />
    <path
      d="M9.5 15.5c0-2 1.6-3.5 3.5-3.5s3.5 1.5 3.5 3.5"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
      fill="none"
    />
  </svg>
);
