/**
 * Resource chrome — minerals / vespene / supply from MatchStore.
 */
import type { Component } from "solid-js";

import { useMatchStore } from "~/app/MatchStoreContext";
import {
  deployedMaterial,
  energyCapacity,
  energyRemaining,
  materialIncome,
  maxDeployedSupply,
  storedMaterial,
} from "~/app/matchEconomy";
import {
  MineralsIcon,
  SupplyIcon,
  VespeneIcon,
} from "~/presentation/hud/starchessIcons";
import styles from "~/presentation/hud/ResourceBar.module.css";

export const ResourceBar: Component = () => {
  const store = useMatchStore();
  const cap = () => energyCapacity(store);
  const gas = () => energyRemaining(store);

  return (
    <div class={styles.bar} data-testid="resource-bar" role="group" aria-label="Resources">
      <div class={styles.strip} title="Stored minerals + income per turn">
        <span class={styles.icon} aria-hidden="true">
          <MineralsIcon />
        </span>
        <span class={styles.value}>
          {storedMaterial(store)}
          <span class={styles.income}>+{materialIncome(store)}</span>
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
          {deployedMaterial(store)}
          <span class={styles.muted}>/{maxDeployedSupply}</span>
        </span>
      </div>
    </div>
  );
};
