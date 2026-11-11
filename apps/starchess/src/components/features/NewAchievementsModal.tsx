// SPEC: _spec/_plans/starchess-achievements.puml, _spec/apps/starchess/architecture/reactivity/components.md
import { For, type Component } from "solid-js";

import { achievementsFor } from "~/achievements/catalog";
import { ACHIEVEMENT_MATERIALS } from "~/achievements/types";
import { NeonModal } from "@chess-coach/ui-web/atoms/NeonModal";
import styles from "~/components/features/NewAchievementsModal.module.css";
import { Button } from "@chess-coach/ui-web/primitives/Button";
import type { AchievementBubble } from "~/types/achievements";

export type NewAchievementsModalProps = {
  open: boolean;
  earned: readonly AchievementBubble[];
  /** Badge shortIds this match raised past their stored level; titled "(new)". */
  newShortIds?: ReadonlySet<string>;
  onContinue: () => void;
};

export const NewAchievementsModal: Component<NewAchievementsModalProps> = (props) => (
  <NeonModal
    open={props.open}
    title="Achievements"
    position="fixed"
    size="lg"
    dismissible={false}
    showCloseButton={false}
  >
    <div class={styles.body} data-testid="new-achievements-modal">
      <div class={styles.list}>
        <For each={props.earned}>
          {(item) => {
            const row = achievementsFor(item.shortId).find((entry) => entry.level === item.level);
            return (
              <article
                class={styles.card}
                data-testid="new-achievement"
                data-short-id={item.shortId}
                data-level={item.level}
                data-new={props.newShortIds?.has(item.shortId) ? "true" : undefined}
              >
                <div
                  class={styles.icon}
                  style={{
                    "--glyph": ACHIEVEMENT_MATERIALS[item.level].fill,
                    "--glyph-url": `url("${item.icon}")`,
                  }}
                />
                <div>
                  <p class={styles.title}>
                    {row?.title}
                    {props.newShortIds?.has(item.shortId) ? " (new)" : ""}
                  </p>
                  <p class={styles.description}>{row?.description}</p>
                </div>
              </article>
            );
          }}
        </For>
      </div>
      <Button
        variant="neon"
        primary
        onClick={() => props.onContinue()}
        data-testid="achievements-continue"
      >
        Continue
      </Button>
    </div>
  </NeonModal>
);
