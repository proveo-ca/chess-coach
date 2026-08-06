/**
 * Command Center deploy picker — ResourceBar + marine-first grid.
 * Affordability reads MatchStore minerals / deploy cap / remaining vespene.
 * Siege Tank uses {@link InlineRook} tank mode (not static siege `*R.svg`).
 */
import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import type { SpawnPiece, StarChessColor } from "@chess-coach/starchess-core";

import { Modal } from "~/components/atoms/Modal";
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
    <Modal
      open={!!props.pending}
      title="Deploy unit"
      position="absolute"
      onClose={props.onCancel}
      dismissible
      contentClass={styles.panel}
    >
      <Show when={props.pending}>
        {(pending) => (
          <div class={styles.body} data-testid="deploy-modal">
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
        )}
      </Show>
    </Modal>
  );
};
