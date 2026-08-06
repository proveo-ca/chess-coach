/**
 * Command Center deploy picker — ResourceBar + marine-first grid.
 */
import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import type { SpawnPiece, StarChessColor } from "@chess-coach/starchess-core";

import { useMatchStore } from "~/app/MatchStoreContext";
import {
  deployedMaterial,
  energyRemaining,
  maxDeployedSupply,
  storedMaterial,
} from "~/app/matchEconomy";
import { SPECIAL_ENERGY_COST, UNIT_COST } from "~/presentation/constants";
import { InlineRook } from "~/presentation/pieces/InlineRook";
import { pieceUrl } from "~/presentation/board/pieceUrl";
import { ResourceBar } from "~/presentation/hud/ResourceBar";
import styles from "~/presentation/hud/DeployModal.module.css";

export const SPAWN_CHOICES: SpawnPiece[] = ["p", "q", "r", "b", "n"];

export type DeployModalPending = {
  color: StarChessColor;
} | null;

type DeployModalProps = {
  pending: DeployModalPending;
  onSelect: (piece: SpawnPiece) => void;
  onCancel: () => void;
};

/**
 * Absolute overlay picker (no Modal atom) — matches UI DeployModal choices.
 */
export const DeployModal: Component<DeployModalProps> = (props) => {
  const store = useMatchStore();

  const canAfford = (piece: SpawnPiece) => {
    const cost = UNIT_COST[piece];
    return (
      energyRemaining(store) >= SPECIAL_ENERGY_COST &&
      storedMaterial(store) >= cost &&
      deployedMaterial(store) + cost <= maxDeployedSupply
    );
  };

  return (
    <Show when={props.pending}>
      {(pending) => (
        <div
          class={styles.backdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Deploy unit"
          data-testid="deploy-modal"
        >
          <div class={styles.panel}>
            <header class={styles.header}>
              <h2 class={styles.title}>Deploy unit</h2>
              <button
                type="button"
                class={styles.close}
                aria-label="Cancel deploy"
                onClick={() => props.onCancel()}
              >
                ×
              </button>
            </header>
            <div class={styles.body}>
              <ResourceBar />
              <div class={styles.choices}>
                <For each={SPAWN_CHOICES}>
                  {(piece) => {
                    const affordable = () => canAfford(piece);
                    return (
                      <button
                        type="button"
                        class={styles.choice}
                        classList={{ [styles.disabled]: !affordable() }}
                        disabled={!affordable()}
                        onClick={() => affordable() && props.onSelect(piece)}
                        aria-label={`Deploy ${piece} (cost ${UNIT_COST[piece]})`}
                        data-spawn-piece={piece}
                        data-cost={UNIT_COST[piece]}
                      >
                        <Show
                          when={piece === "r"}
                          fallback={
                            <img
                              src={pieceUrl(pending().color, piece)}
                              alt=""
                              class={styles.pieceImg}
                            />
                          }
                        >
                          <span class={styles.pieceImg} data-piece-inline="r" aria-hidden="true">
                            <InlineRook color={pending().color} mode="tank" />
                          </span>
                        </Show>
                        <span class={styles.cost}>{UNIT_COST[piece]}</span>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};
