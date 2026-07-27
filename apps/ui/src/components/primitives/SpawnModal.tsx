import type { Color, PieceSymbol } from "chess.js";
import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import {
  deployedSupply,
  maxDeployedSupply,
  storedMaterial,
} from "~/broodwar/broodWarStore";
import { UNIT_COST } from "~/broodwar/constants";
import { Modal } from "~/components/atoms/Modal";
import promoStyles from "~/components/primitives/PromotionModal.module.css";
import { ResourceBar } from "~/components/primitives/ResourceBar";
import styles from "~/components/primitives/SpawnModal.module.css";
import type { PieceSet } from "~/types/settings";

/** King spawn choices — pawn first, then promotional set. */
export type SpawnPiece = Extract<PieceSymbol, "p" | "q" | "r" | "b" | "n">;

export const SPAWN_CHOICES: SpawnPiece[] = ["p", "q", "r", "b", "n"];

export type SpawnModalPending = {
  color: Color;
  pieceSet: PieceSet;
};

type SpawnModalProps = {
  pending: SpawnModalPending | null;
  onSelect: (piece: SpawnPiece) => void;
  onCancel: () => void;
};

const getPieceImg = (piece: SpawnPiece, color: Color, pieceSet: PieceSet) =>
  `/chess/pieces/${pieceSet}/${color}${piece.toUpperCase()}.svg`;

/**
 * Brood War king special — PromotionModal variant with ResourceBar + pawn-first
 * spawn grid. Economy values come from `broodWarStore` (not props).
 */
export const SpawnModal: Component<SpawnModalProps> = (props) => {
  const canAfford = (piece: SpawnPiece) => {
    const cost = UNIT_COST[piece];
    return storedMaterial() >= cost && deployedSupply() + 1 <= maxDeployedSupply;
  };

  return (
    <Modal
      open={!!props.pending}
      title="Spawn unit"
      position="absolute"
      onClose={props.onCancel}
      dismissible={true}
    >
      <Show when={props.pending}>
        {(pending) => (
          <div class={styles.body}>
            <ResourceBar />
            <div class={`${promoStyles.choices} ${styles.choices}`}>
              <For each={SPAWN_CHOICES}>
                {(piece) => {
                  const affordable = () => canAfford(piece);
                  return (
                    <button
                      type="button"
                      class={promoStyles.choice}
                      classList={{ [styles.disabled]: !affordable() }}
                      disabled={!affordable()}
                      onClick={() => affordable() && props.onSelect(piece)}
                      aria-label={`Spawn ${piece} (cost ${UNIT_COST[piece]})`}
                      data-spawn-piece={piece}
                      data-cost={UNIT_COST[piece]}
                    >
                      <img
                        src={getPieceImg(piece, pending().color, pending().pieceSet)}
                        alt=""
                        class={promoStyles.pieceImg}
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
