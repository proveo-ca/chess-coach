/**
 * Pawn / marine last-rank picker — q / r / b / n.
 * Ported from apps/ui PromotionModal; units via {@link PieceGlyph} (inline art).
 */
import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import type { PendingPromotion, PromotionPiece } from "~/types/chess";
import { Modal } from "@chess-coach/ui-web/atoms/Modal";
import styles from "~/components/primitives/PromotionModal.module.css";
import { PieceGlyph } from "~/presentation/board/components/PieceGlyph";

export type { PendingPromotion, PromotionPiece };

interface PromotionModalProps {
  pending: PendingPromotion | null;
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

const CHOICES: readonly { piece: PromotionPiece; label: string }[] = [
  { piece: "q", label: "BattleShip" },
  { piece: "r", label: "Tank" },
  { piece: "b", label: "Mecha" },
  { piece: "n", label: "Hoverbike" },
];

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
              {(choice) => (
                <button
                  type="button"
                  class={styles.choice}
                  onClick={() => props.onSelect(choice.piece)}
                  aria-label={`Promote to ${choice.label}`}
                  data-promo-piece={choice.piece}
                >
                  <PieceGlyph
                    color={pending().color}
                    type={choice.piece}
                    pieceSet="nerd"
                    mode="tank"
                    class={styles.pieceImg}
                  />
                  <span class={styles.choiceLabel}>{choice.label}</span>
                </button>
              )}
            </For>
          </div>
        )}
      </Show>
    </Modal>
  );
};
