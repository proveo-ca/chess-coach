import type { Component } from "solid-js";
import { For, Show, createMemo } from "solid-js";

import styles from "~/presentation/specials/SpiderMine.module.css";
import {
  TEAM_LIGHT,
  TEAM_PRIMARY,
  type PieceColor,
} from "~/presentation/animations/teamColors";
import {
  MINE_LEG_COUNT,
  legPath,
  missileLeg,
  radialLeg,
} from "~/presentation/specials/spiderMineLegs";

export type SpiderMineState = "idle" | "deploying" | "chasing" | "missile";

type SpiderMineProps = {
  /** Owning player — white hull + team-color accents. */
  color?: PieceColor;
  /**
   * `idle` — burrowed (no legs).
   * `deploying` — legs out then burrow (per-leg random ≤250ms).
   * `chasing` — emerge from ground (per-leg random ≤50ms), radial stance.
   * `missile` — legs swept opposite the target, hugging the green trail.
   */
  state?: SpiderMineState;
  /** Per-leg anim duration (ms), length {@link MINE_LEG_COUNT} — bury or emerge. */
  legMs?: readonly number[];
};

const LEG_INDEX = Array.from({ length: MINE_LEG_COUNT }, (_, i) => i);

/**
 * Spider mine glyph — tooth-crown silhouette; legs for deploy / chase / missile.
 */
export const SpiderMine: Component<SpiderMineProps> = (props) => {
  const color = () => props.color ?? "w";
  const state = () => props.state ?? "idle";
  const team = () => TEAM_PRIMARY[color()];
  const teamLight = () => TEAM_LIGHT[color()];
  const showLegs = () => {
    const s = state();
    return s === "deploying" || s === "chasing" || s === "missile";
  };
  const legMode = createMemo(() => (state() === "missile" ? "missile" : "radial"));
  const geom = (i: number) => (legMode() === "missile" ? missileLeg(i) : radialLeg(i));
  const legDuration = (i: number) => props.legMs?.[i] ?? (state() === "chasing" ? 40 : 200);

  return (
    <svg
      class={styles.mine}
      classList={{
        [styles.deploying]: state() === "deploying",
        [styles.chasing]: state() === "chasing",
        [styles.missile]: state() === "missile",
      }}
      viewBox="0 0 40 40"
      aria-hidden="true"
      data-spider-mine
      data-color={color()}
      data-state={state()}
    >
      <ellipse
        class={styles.shadow}
        cx="20"
        cy="26.5"
        rx="8"
        ry="2.2"
        fill="rgba(0,0,0,0.14)"
      />

      <Show when={showLegs()}>
        <g class={styles.legs} data-part="legs">
          <For each={[...LEG_INDEX]}>
            {(i) => {
              const g = () => geom(i);
              const ms = () => legDuration(i);
              return (
                <g
                  class={styles.legArm}
                  style={{
                    "--leg-ms": `${ms()}ms`,
                    "transform-origin": `${g().hx}px ${g().hy}px`,
                  }}
                  data-leg={i}
                >
                  <path
                    class={styles.leg}
                    fill="none"
                    stroke={team()}
                    stroke-width="1.35"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d={legPath(g())}
                  />
                  <circle
                    cx={g().tx}
                    cy={g().ty}
                    r="1.15"
                    fill={teamLight()}
                    stroke="#222"
                    stroke-width="0.55"
                  />
                </g>
              );
            }}
          </For>
        </g>
      </Show>

      <path
        class={styles.enamel}
        fill="#fff"
        stroke="#222"
        stroke-width="1.15"
        stroke-linejoin="round"
        d="
          M16.5 14
          C12.2 14 10 16.4 10 20
          C10 23.6 12.2 26 16.5 26
          C16.8 28.8 18.4 30.5 20.8 30.5
          C23.4 30.5 25.2 28.6 25.5 26
          C28.2 25.2 30 22.8 30 20
          C30 17.2 28.2 14.8 25.5 14
          C25.2 11.4 23.4 9.5 20.8 9.5
          C18.4 9.5 16.8 11.2 16.5 14
          Z
        "
      />

      <ellipse cx="20.6" cy="11.2" rx="3.4" ry="3.1" fill={team()} stroke="#222" stroke-width="0.9" />
      <ellipse cx="20.6" cy="28.8" rx="3.4" ry="3.1" fill={team()} stroke="#222" stroke-width="0.9" />
      <ellipse cx="19.4" cy="11.2" rx="1.2" ry="1.6" fill={teamLight()} opacity="0.7" />
      <ellipse cx="19.4" cy="28.8" rx="1.2" ry="1.6" fill={teamLight()} opacity="0.7" />

      <ellipse cx="16.2" cy="20" rx="2.2" ry="4.2" fill="#fff" opacity="0.5" />

      <circle cx="20.5" cy="20" r="2.1" fill={team()} stroke="#222" stroke-width="0.85" />
      <circle class={styles.sensor} cx="20.2" cy="20" r="1.05" fill={teamLight()} />
    </svg>
  );
};
