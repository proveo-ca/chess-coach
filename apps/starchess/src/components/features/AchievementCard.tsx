// SPEC: _spec/_plans/starchess-achievements.puml, _spec/apps/starchess/architecture/reactivity/components.md
/**
 * One gallery card: a family shown at the level the player holds. Pure view —
 * the gallery decides the level and whether the card opens a witness game.
 */
import { For, createMemo, type Component } from "solid-js";

import { Card } from "@chess-coach/ui-web/primitives/Card";
import { achievementsFor } from "~/achievements/catalog";
import { ACHIEVEMENT_MATERIALS } from "~/achievements/types";
import styles from "~/components/features/AchievementCard.module.css";

/** Tint of a card nobody has earned yet. */
const MISSING_TINT = "#8aa094";
const METER_STEPS = [1, 2, 3, 4, 5] as const;

export type AchievementCardProps = {
  shortId: string;
  /** 0 = missing; 1–5 = the level held. */
  level: number;
  /** Given when an obtained card can open the game that earned it. */
  onOpen?: () => void;
};

export const AchievementCard: Component<AchievementCardProps> = (props) => {
  const obtained = () => props.level >= 1;
  const row = createMemo(
    () => achievementsFor(props.shortId).find((entry) => entry.level === (props.level || 1))!,
  );
  const tint = () => (obtained() ? ACHIEVEMENT_MATERIALS[row().level].fill : MISSING_TINT);

  return (
    <Card
      muted={!obtained()}
      onClick={obtained() ? props.onOpen : undefined}
      data-testid="achievement-card"
      data-short-id={props.shortId}
      data-level={props.level}
      data-obtained={obtained() ? "true" : "false"}
    >
      <div class={styles.glyphScope} style={{ "--glyph": tint() }}>
        <div class={styles.icon} style={{ "--glyph-url": `url("${row().icon}")` }} />
        <p class={styles.status}>{obtained() ? `Obtained (Level ${props.level})` : "Missing"}</p>
        <div class={styles.meter} aria-label={`Level ${props.level} of 5`}>
          <For each={METER_STEPS}>
            {(step) => <span class={step <= props.level ? styles.filled : undefined} />}
          </For>
        </div>
        <p class={styles.title}>{row().title}</p>
        <p class={styles.description}>{row().description}</p>
      </div>
    </Card>
  );
};
