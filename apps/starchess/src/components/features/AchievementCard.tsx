// SPEC: _spec/_plans/starchess-achievements.puml
/**
 * One gallery card: a family shown at the level the player holds. Pure view —
 * the gallery decides the level and whether the card opens a witness game.
 */
import { For, Show, type Component, type JSX } from "solid-js";

import { achievementsFor } from "~/achievements/catalog";
import { ACHIEVEMENT_MATERIALS } from "~/achievements/types";
import styles from "~/components/features/AchievementCard.module.css";

/** Tint of a card nobody has earned yet. */
const MISSING_TINT = "#8aa094";

export type AchievementCardProps = {
  shortId: string;
  /** 0 = missing; 1–5 = the level held. */
  level: number;
  /** Given when an obtained card can open the game that earned it. */
  onOpen?: () => void;
};

export const AchievementCard: Component<AchievementCardProps> = (props) => {
  const obtained = () => props.level >= 1;
  const row = () =>
    achievementsFor(props.shortId).find((entry) => entry.level === (props.level || 1))!;
  const tint = () => (obtained() ? ACHIEVEMENT_MATERIALS[row().level].fill : MISSING_TINT);
  const className = () => `${styles.card}${obtained() ? "" : ` ${styles.missing}`}`;
  const shared = () => ({
    class: className(),
    style: { "--glyph": tint() },
    "data-testid": "achievement-card",
    "data-short-id": props.shortId,
    "data-level": props.level,
    "data-obtained": obtained() ? "true" : "false",
  });
  const body = (): JSX.Element => (
    <>
      <div class={styles.icon} style={{ "--glyph-url": `url("${row().icon}")` }} />
      <p class={styles.status}>{obtained() ? `Obtained (Level ${props.level})` : "Missing"}</p>
      <div class={styles.meter} aria-label={`Level ${props.level} of 5`}>
        <For each={[1, 2, 3, 4, 5]}>
          {(step) => <span class={step <= props.level ? styles.filled : undefined} />}
        </For>
      </div>
      <p class={styles.title}>{row().title}</p>
      <p class={styles.description}>{row().description}</p>
    </>
  );
  return (
    <Show when={obtained() && props.onOpen} fallback={<article {...shared()}>{body()}</article>}>
      <button type="button" {...shared()} onClick={() => props.onOpen?.()}>
        {body()}
      </button>
    </Show>
  );
};
