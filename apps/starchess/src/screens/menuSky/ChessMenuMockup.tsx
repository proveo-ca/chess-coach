/**
 * Shatterable facsimile of apps/ui MenuScreen — not imported from Coach.
 * Intact state is laid out + styled to match `/chess/` MenuScreen 1:1
 * (SplashScreen column, identity rows, MenuButtons, Credits).
 * On shatter, action buttons become abstract SVG shards.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import { For, Show, type Component } from "solid-js";

import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import type { CoachIdentity } from "~/types/coach";
import styles from "~/screens/menuSky/ChessMenuMockup.module.css";
import { playerName } from "~/store/settingsStore";

export type ChessMenuMockupProps = {
  /** Frosted Coach panel over the sky — clears toward outer space. */
  glass: "solid" | "clearing" | "gone";
  /** Shatter the mock menu buttons into abstract shards. */
  shatter: boolean;
  /** Hide non-button chrome (title / fields) after shatter starts. */
  fadeChrome?: boolean;
  /** Avatar identity — Selena on Chess; Kerrigan once the arrival flips her. */
  identity?: CoachIdentity;
};

/** Fixed shard polygons in button-local 280×41 space — no readable glyphs. */
const SHARDS: readonly string[] = [
  "M0 0 L92 0 L70 20 L8 37 Z",
  "M92 0 L180 0 L168 17 L70 20 Z",
  "M180 0 L280 0 L280 15 L200 26 L168 17 Z",
  "M8 37 L70 20 L120 28 L95 41 L0 41 Z",
  "M70 20 L168 17 L200 26 L150 41 L95 41 L120 28 Z",
  "M200 26 L280 15 L280 41 L150 41 Z",
];

type ShatterBtn = {
  id: string;
  label: string;
  primary?: boolean;
  disabled?: boolean;
  credits?: boolean;
};

const ShatterableButton: Component<{
  btn: ShatterBtn;
  shatter: boolean;
  index: number;
}> = (props) => (
  <div
    class={styles.btnHost}
    classList={{
      [styles.btnHostCredits]: !!props.btn.credits,
      [styles.btnShatter]: props.shatter,
    }}
    style={{ "--shatter-i": String(props.index) }}
    data-mock-btn={props.btn.id}
  >
    <Show
      when={!props.shatter}
      fallback={
        <svg
          class={styles.shardSvg}
          viewBox="0 0 280 41"
          width="280"
          height="41"
          aria-hidden="true"
        >
          <For each={SHARDS}>
            {(d, i) => (
              <path
                class={styles.shard}
                d={d}
                fill={i() % 2 === 0 ? "#2a2a2e" : "#3a3d42"}
                stroke="#111"
                stroke-width="0.6"
                style={{ "--shard-i": String(i()) }}
              />
            )}
          </For>
        </svg>
      }
    >
      <div
        class={styles.menuBtn}
        classList={{
          [styles.menuBtnPrimary]: !!props.btn.primary,
          [styles.menuBtnDisabled]: !!props.btn.disabled,
          [styles.menuBtnCredits]: !!props.btn.credits,
        }}
        role="img"
        aria-label={props.btn.label}
      >
        {props.btn.label}
      </div>
    </Show>
  </div>
);

/**
 * Coach MenuScreen lookalike — DOM/CSS mirrored from apps/ui MenuScreen.
 */
export const ChessMenuMockup: Component<ChessMenuMockupProps> = (props) => {
  const chromeHidden = (): boolean => !!props.fadeChrome;

  return (
    <div
      class={styles.root}
      data-testid="chess-menu-mockup"
      data-glass={props.glass}
      aria-hidden={props.glass === "gone" ? true : undefined}
    >
      <div
        class={styles.glass}
        classList={{
          [styles.glassSolid]: props.glass === "solid",
          [styles.glassClearing]: props.glass === "clearing",
          [styles.glassGone]: props.glass === "gone",
        }}
      />

      <div
        class={styles.splashContent}
        classList={{ [styles.columnFade]: chromeHidden() || props.shatter }}
      >
        <div class={styles.avatarSlot} data-testid="chess-menu-avatar">
          <CoachAvatar identity={props.identity ?? "selena"} emotion="happy" />
        </div>

        <div
          class={styles.chrome}
          classList={{ [styles.chromeHidden]: chromeHidden() }}
        >
          <h2 class={styles.title}>Wanna play Chess?</h2>

          <div class={styles.identityRow}>
            <span class={styles.identityLabel}>Name:</span>
            <div class={styles.nameField}>
              <span class={styles.input}>{playerName()}</span>
              <span class={styles.diceBtn} aria-hidden="true">
                🎲
              </span>
            </div>
          </div>

          <div class={styles.identityRow}>
            <span class={styles.identityLabel}>I am:</span>
            <span class={styles.select}>Human</span>
          </div>
        </div>

        <div class={styles.menuOptions}>
          <div class={styles.selenaRow}>
            <ShatterableButton
              btn={{ id: "play", label: "Play with Selena", primary: true }}
              shatter={props.shatter}
              index={0}
            />
            <Show when={!props.shatter}>
              <span class={styles.select} data-mock-btn="diff">
                Intermediate (1100)
              </span>
            </Show>
            <Show when={props.shatter}>
              <ShatterableButton
                btn={{ id: "diff", label: "Intermediate (1100)" }}
                shatter
                index={1}
              />
            </Show>
          </div>

          <ShatterableButton
            btn={{ id: "solo", label: "Solo Analysis" }}
            shatter={props.shatter}
            index={2}
          />
          <ShatterableButton
            btn={{ id: "review", label: "Review", disabled: true }}
            shatter={props.shatter}
            index={3}
          />
          <ShatterableButton
            btn={{ id: "lan", label: "Play LAN" }}
            shatter={props.shatter}
            index={4}
          />
          <ShatterableButton
            btn={{ id: "learn", label: "Learn to Play", disabled: true }}
            shatter={props.shatter}
            index={5}
          />
          <Show when={!props.shatter}>
            <span class={styles.comingSoon}>Coming soon!</span>
          </Show>
        </div>

        <ShatterableButton
          btn={{ id: "credits", label: "Credits", credits: true }}
          shatter={props.shatter}
          index={6}
        />
      </div>
    </div>
  );
};
