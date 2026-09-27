// SPEC: _spec/apps/starchess/architecture/reactivity/presentation.md
/**
 * Command Center deploy picker — ResourceBar + marine-first grid.
 * Affordability reads MatchStore minerals / deploy cap / remaining vespene.
 * Every choice is the inline unit via {@link PieceGlyph}; the Siege Tank shows
 * tank mode rather than its siege rest pose.
 */
import type { Component } from "solid-js";
import { For, Show, createMemo } from "solid-js";
import { MAX_DEPLOYED_MATERIAL, type SpawnPiece, type StarChessColor } from "@chess-coach/starchess-core";

import { Modal } from "@chess-coach/ui-web/atoms/Modal";
import { useMatchStore } from "~/ports/matchStore";
import { SPECIAL_ENERGY_COST, UNIT_COST } from "~/presentation/constants";
import { PieceGlyph } from "~/presentation/board/components/PieceGlyph";
import { ResourceBar } from "~/presentation/hud/components/ResourceBar";
import styles from "~/presentation/hud/components/DeployModal.module.css";

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
      store.view.energyRemaining() >= SPECIAL_ENERGY_COST &&
      store.view.storedMaterial() >= cost &&
      store.view.deployedMaterial() + cost <= MAX_DEPLOYED_MATERIAL
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
                  const affordable = createMemo(() => canAfford(piece));
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
                      <PieceGlyph
                        color={pending().color}
                        type={piece}
                        pieceSet="nerd"
                        mode="tank"
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
