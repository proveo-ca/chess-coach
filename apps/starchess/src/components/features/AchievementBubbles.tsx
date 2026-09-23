// SPEC: _spec/_plans/starchess-achievements.puml
/**
 * Live achievement layer. Places each bubble on its origin square and
 * dismisses it from the live tally when the atom's lifetime ends.
 */
import type { Square } from "chess.js";
import { For, type Component } from "solid-js";

import { BUBBLE_LIFE_MS, BUBBLE_RISE_SQUARES } from "~/achievements/analysis";
import { dismissAchievementBubble } from "~/achievements/achievementLive";
import { ACHIEVEMENT_MATERIALS } from "~/achievements/types";
import { AchievementBubbleLife } from "~/components/atoms/AchievementBubbleLife";
import styles from "~/components/features/AchievementBubbles.module.css";
import { squareBoxStyle } from "~/presentation/animations/boardGeom";
import type { AchievementBubble } from "~/types/achievements";

export type AchievementBubblesProps = {
  bubbles: readonly AchievementBubble[];
  boardWidth: number;
  boardHeight: number;
};

export const AchievementBubbles: Component<AchievementBubblesProps> = (props) => {
  const rise = () => `${-(BUBBLE_RISE_SQUARES * (props.boardHeight / 8))}px`;

  return (
    <div class={styles.layer} data-starchess-achievement-bubbles>
      <For each={props.bubbles}>
        {(bubble) => {
          const box = () =>
            squareBoxStyle(bubble.origin as Square, props.boardWidth, props.boardHeight);
          return (
            <AchievementBubbleLife
              icon={bubble.icon}
              tint={ACHIEVEMENT_MATERIALS[bubble.level].fill}
              left={box().left}
              top={box().top}
              width={box().width}
              height={box().height}
              rise={rise()}
              shortId={bubble.shortId}
              origin={bubble.origin}
              level={bubble.level}
              lifeMs={BUBBLE_LIFE_MS}
              onDone={() => dismissAchievementBubble(bubble.id)}
            />
          );
        }}
      </For>
    </div>
  );
};
