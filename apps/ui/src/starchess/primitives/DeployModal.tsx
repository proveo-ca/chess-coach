import type { Color } from "chess.js";
import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import { InlineRook } from "~/starchess/animations/pieces/InlineRook";
import {
  deployedSupply,
  energyRemaining,
  maxDeployedSupply,
  storedMaterial,
} from "~/starchess/starChessStore";
import { SPECIAL_ENERGY_COST, UNIT_COST } from "~/starchess/constants";
import { ResourceBar } from "~/starchess/primitives/ResourceBar";
import styles from "~/starchess/primitives/DeployModal.module.css";
import { Modal } from "~/components/atoms/Modal";
import type { DeployModalPending, SpawnPiece } from "~/starchess/types";
import type { PieceSet } from "~/types/settings";

export type { DeployModalPending, SpawnPiece } from "~/starchess/types";

export const SPAWN_CHOICES: SpawnPiece[] = ["p", "q", "r", "b", "n"];

type DeployModalProps = {
  pending: DeployModalPending | null;
  onSelect: (piece: SpawnPiece) => void;
  onCancel: () => void;
};

const getPieceImg = (piece: SpawnPiece, color: Color, pieceSet: PieceSet) =>
  `/chess/pieces/${pieceSet}/${color}${piece.toUpperCase()}.svg`;

/**
 * Command Center deploy picker — ResourceBar + marine-first grid.
 * Affordability reads the player's accumulated minerals, deploy cap, and
 * remaining vespene from `starChessStore` (gas is spent only on placement).
 * Siege Tank uses {@link InlineRook} tank mode (not static siege `*R.svg`).
 */
export const DeployModal: Component<DeployModalProps> = (props) => {
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
                      <Show
                        when={piece === "r"}
                        fallback={
                          <img
                            src={getPieceImg(piece, pending().color, pending().pieceSet)}
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
