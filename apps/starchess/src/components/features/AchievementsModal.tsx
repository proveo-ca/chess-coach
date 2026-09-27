// SPEC: _spec/_plans/starchess-achievements.puml, _spec/apps/starchess/architecture/reactivity/components.md
import { For, createMemo, type Component } from "solid-js";

import { careerAchievementLevels } from "~/achievements/achievementLive";
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

export const AchievementsModal: Component<AchievementsModalProps> = (props) => {
  const career = createMemo(() => careerAchievementLevels());
  return (
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
            const level = createMemo(() => unlockedLevel(shortId, career()));
            const gameId = createMemo(() => (level() >= 1 ? witnessGameId(shortId) : null));
            const onOpen = createMemo(() => {
              const id = gameId();
              return id ? () => props.onOpenGame(id) : undefined;
            });
            return <AchievementCard shortId={shortId} level={level()} onOpen={onOpen()} />;
          }}
        </For>
      </div>
    </NeonModal>
  );
};
