// SPEC: _spec/_plans/starchess-achievements.puml
import { For, type Component } from "solid-js";

import { ACHIEVEMENT_SHORT_IDS } from "~/achievements/catalog";
import { NeonModal } from "@chess-coach/ui-web/atoms/NeonModal";
import { AchievementCard } from "~/components/features/AchievementCard";
import styles from "~/components/features/AchievementsModal.module.css";
import { unlockedLevel, witnessGameId } from "~/store/achievementStore";

export type AchievementsModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenGame: (gameId: string) => void;
};

export const AchievementsModal: Component<AchievementsModalProps> = (props) => (
  <NeonModal
    open={props.open}
    onClose={props.onClose}
    title="Achievements"
    position="fixed"
    size="lg"
    dismissible
    showCloseButton
    contentClass={styles.sheet}
  >
    <div class={styles.grid} data-testid="achievements-modal">
      <For each={ACHIEVEMENT_SHORT_IDS}>
        {(shortId) => {
          const level = () => unlockedLevel(shortId);
          const gameId = () => (level() >= 1 ? witnessGameId(shortId) : null);
          return (
            <AchievementCard
              shortId={shortId}
              level={level()}
              onOpen={
                gameId()
                  ? () => {
                      const id = gameId();
                      if (id) props.onOpenGame(id);
                    }
                  : undefined
              }
            />
          );
        }}
      </For>
    </div>
  </NeonModal>
);
