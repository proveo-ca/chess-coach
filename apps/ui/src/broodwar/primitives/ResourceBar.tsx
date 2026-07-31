import { createMemo, type Component } from "solid-js";

import {
  energyCapacity,
  energyRemaining,
  materialIncome,
  maxDeployedSupply,
  storedMaterial,
} from "~/broodwar/broodWarStore";
import { deployedMaterialFromFen } from "~/broodwar/economy";
import {
  MineralsIcon,
  SupplyIcon,
  VespeneIcon,
} from "~/broodwar/primitives/icons";
import styles from "~/broodwar/primitives/ResourceBar.module.css";
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
