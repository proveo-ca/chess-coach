/**
 * Pawn / marine last-rank picker — q / r / b / n.
 * Ported from apps/ui PromotionModal; assets via {@link pieceUrl} (nerd set).
 */
import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import type { PendingPromotion, PromotionPiece } from "~/types/chess";
import { Modal } from "~/components/atoms/Modal";
import styles from "~/components/primitives/PromotionModal.module.css";
import { pieceUrl } from "~/presentation/board/pieceUrl";
import { InlineRook } from "~/presentation/pieces/InlineRook";

export type { PendingPromotion, PromotionPiece };

interface PromotionModalProps {
  pending: PendingPromotion | null;
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

const CHOICES: PromotionPiece[] = ["q", "r", "b", "n"];

export const PromotionModal: Component<PromotionModalProps> = (props) => {
  return (
    <Modal
      open={!!props.pending}
      title="Promote Marine"
      position="absolute"
      onClose={props.onCancel}
      dismissible
      contentClass={styles.panel}
    >
      <Show when={props.pending}>
        {(pending) => (
          <div class={styles.choices} data-testid="promotion-modal">
            <For each={CHOICES}>
              {(piece) => (
                <button
                  type="button"
                  class={styles.choice}
                  onClick={() => props.onSelect(piece)}
                  aria-label={`Promote to ${piece}`}
                  data-promo-piece={piece}
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
                </button>
              )}
            </For>
          </div>
        )}
      </Show>
    </Modal>
  );
};
