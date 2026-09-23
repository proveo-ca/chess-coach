// SPEC: _spec/_plans/starchess-achievements.puml
import { For, Show, type Component, type JSX } from "solid-js";

import { ACHIEVEMENT_SHORT_IDS, achievementsFor } from "~/achievements/catalog";
import { ACHIEVEMENT_MATERIALS } from "~/achievements/types";
import { NeonModal } from "@chess-coach/ui-web/atoms/NeonModal";
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
          const obtained = () => level() >= 1;
          const row = () =>
            achievementsFor(shortId).find((entry) => entry.level === (level() || 1))!;
          const gameId = () => (obtained() ? witnessGameId(shortId) : null);
          const tint = () =>
            obtained() ? ACHIEVEMENT_MATERIALS[row().level].fill : "#8aa094";
          const body = () => (
            <>
              <div
                class={styles.icon}
                style={{ "--glyph-url": `url("${row().icon}")` }}
              />
              <p class={styles.status}>
                {obtained() ? `Obtained (Level ${level()})` : "Missing"}
              </p>
              <div class={styles.meter} aria-label={`Level ${level()} of 5`}>
                <For each={[1, 2, 3, 4, 5]}>
                  {(step) => <span class={step <= level() ? styles.filled : undefined} />}
                </For>
              </div>
              <p class={styles.title}>{row().title}</p>
              <p class={styles.description}>{row().description}</p>
            </>
          );
          return (
            <ShowCard
              obtained={obtained()}
              gameId={gameId()}
              shortId={shortId}
              level={level()}
              tint={tint()}
              onOpen={() => {
                const id = gameId();
                if (id) props.onOpenGame(id);
              }}
            >
              {body()}
            </ShowCard>
          );
        }}
      </For>
    </div>
  </NeonModal>
);

const ShowCard: Component<{
  obtained: boolean;
  gameId: string | null;
  shortId: string;
  level: number;
  tint: string;
  onOpen: () => void;
  children: JSX.Element;
}> = (props) => {
  const className = () => `${styles.card}${props.obtained ? "" : ` ${styles.missing}`}`;
  return (
    <Show
      when={props.obtained && props.gameId}
      fallback={
        <article
          class={className()}
          style={{ "--glyph": props.tint }}
          data-testid="achievement-card"
          data-short-id={props.shortId}
          data-level={props.level}
          data-obtained={props.obtained ? "true" : "false"}
        >
          {props.children}
        </article>
      }
    >
      <button
        type="button"
        class={className()}
        style={{ "--glyph": props.tint }}
        data-testid="achievement-card"
        data-short-id={props.shortId}
        data-level={props.level}
        data-obtained="true"
        onClick={() => props.onOpen()}
      >
        {props.children}
      </button>
    </Show>
  );
};
