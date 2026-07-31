import { For, createMemo, type Component } from "solid-js";

import {
  energyCapacity,
  energyRemaining,
  materialIncome,
  maxDeployedSupply,
  storedMaterial,
} from "~/broodwar/broodWarStore";
import { deployedMaterialFromFen } from "~/broodwar/economy";
import styles from "~/components/atoms/ResourceBar.module.css";
import { currentFen } from "~/store/gameStore";
import { activePlayerColor } from "~/store/settingsStore";

/**
 * Brood War resource chrome — minerals, vespene (special fuel), deployment.
 * Reads economy + board from stores; deploy count is Σ UNIT_COST of owned pieces.
 */
export const ResourceBar: Component = () => {
  const deployed = createMemo(() => {
    try {
      return deployedMaterialFromFen(currentFen(), activePlayerColor());
    } catch {
      return 0;
    }
  });

  const cap = () => energyCapacity();
  const gas = () => energyRemaining();
  const cylinderSlots = () => Array.from({ length: cap() }, (_, i) => i);

  return (
    <div class={styles.bar} data-testid="resource-bar" role="group" aria-label="Resources">
      <div class={styles.strip} title="Stored minerals + income per turn">
        <span class={styles.icon} aria-hidden="true">
          <MineralsIcon />
        </span>
        <span class={styles.value}>
          {storedMaterial()}
          <span class={styles.income}>+{materialIncome()}</span>
        </span>
      </div>

      <div
        class={styles.strip}
        title="Vespene gas this turn (specials burn 1; does not accumulate)"
        aria-label={`Vespene ${gas()} of ${cap()}`}
      >
        <span class={styles.icon} aria-hidden="true">
          <VespeneIcon />
        </span>
        <span class={styles.cylinders} aria-hidden="true">
          <For each={cylinderSlots()}>
            {(i) => (
              <span
                class={styles.cylinder}
                classList={{ [styles.cylinderFilled]: i < gas() }}
                data-filled={i < gas() ? "true" : "false"}
              />
            )}
          </For>
        </span>
        <span class={styles.value}>
          {gas()}
          <span class={styles.muted}>/{cap()}</span>
        </span>
      </div>

      <div class={styles.strip} title="Deployed army material / max">
        <span class={styles.icon} aria-hidden="true">
          <SupplyIcon />
        </span>
        <span class={styles.value}>
          {deployed()}
          <span class={styles.muted}>/{maxDeployedSupply}</span>
        </span>
      </div>
    </div>
  );
};

/** Mineral blocks (classic ResourceBar icon). */
const MineralsIcon: Component = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="2" y="8" width="6" height="6" rx="1" fill="currentColor" opacity="0.9" />
    <rect x="10" y="8" width="6" height="6" rx="1" fill="currentColor" opacity="0.75" />
    <rect x="6" y="3" width="6" height="6" rx="1" fill="currentColor" />
  </svg>
);

/** Vespene canister glyph. */
const VespeneIcon: Component = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect
      x="5"
      y="3"
      width="8"
      height="12"
      rx="2"
      stroke="currentColor"
      stroke-width="1.4"
      fill="currentColor"
      fill-opacity="0.25"
    />
    <rect x="7" y="1.5" width="4" height="2" rx="0.6" fill="currentColor" />
    <path
      d="M7.5 8.5c1.2-1.5 3.8-1.5 5 0"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linecap="round"
      fill="none"
      opacity="0.85"
    />
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
