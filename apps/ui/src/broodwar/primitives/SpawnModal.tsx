import type { Color } from "chess.js";
import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import {
  deployedSupply,
  energyRemaining,
  maxDeployedSupply,
  storedMaterial,
} from "~/broodwar/broodWarStore";
import { SPECIAL_ENERGY_COST, UNIT_COST } from "~/broodwar/constants";
import { ResourceBar } from "~/broodwar/primitives/ResourceBar";
import styles from "~/broodwar/primitives/SpawnModal.module.css";
import { Modal } from "~/components/atoms/Modal";
import type { SpawnModalPending, SpawnPiece } from "~/types/broodwar";
import type { PieceSet } from "~/types/settings";

export type { SpawnModalPending, SpawnPiece } from "~/types/broodwar";

export const SPAWN_CHOICES: SpawnPiece[] = ["p", "q", "r", "b", "n"];

type SpawnModalProps = {
  pending: SpawnModalPending | null;
  onSelect: (piece: SpawnPiece) => void;
  onCancel: () => void;
};

const getPieceImg = (piece: SpawnPiece, color: Color, pieceSet: PieceSet) =>
  `/chess/pieces/${pieceSet}/${color}${piece.toUpperCase()}.svg`;

/**
 * Command Center deploy picker — ResourceBar + marine-first grid.
 * Affordability reads the player's accumulated minerals, deploy cap, and
 * remaining vespene from `broodWarStore` (gas is spent only on placement).
 */
export const SpawnModal: Component<SpawnModalProps> = (props) => {
  const canAfford = (piece: SpawnPiece) => {
    const cost = UNIT_COST[piece];
    return (
      energyRemaining() >= SPECIAL_ENERGY_COST &&
      storedMaterial() >= cost &&
      deployedSupply() + cost <= maxDeployedSupply
    );
  };

  return (
    <Modal
      open={!!props.pending}
      title="Deploy unit"
      position="absolute"
      onClose={props.onCancel}
      dismissible={true}
    >
      <Show when={props.pending}>
        {(pending) => (
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
                      <img
                        src={getPieceImg(piece, pending().color, pending().pieceSet)}
                        alt=""
                        class={styles.pieceImg}
                      />
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
