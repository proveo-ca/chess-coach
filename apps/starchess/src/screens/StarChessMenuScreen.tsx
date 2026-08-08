/**
 * StarChess main menu — static StarCraft-inspired spatial layout.
 * Coach avatar uses the same splash slot metrics as apps/ui MenuScreen
 * (SplashScreen avatar wrapper) so Chess ↔ StarChess never shifts her.
 * Menu anchors map Brood War main-menu positions (viewport %).
 *
 * Single Player / Multiplayer / Review / Exit use {@link MenuAnchor}
 * (MenuTitle primitive + visual). Tutorial is title-only; Credits opens the
 * StarChess credits modal.
 */
import clsx from "clsx";
import { createSignal, type Component, type JSX } from "solid-js";

import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { Credits } from "~/components/features/Credits";
import { MenuAnchor } from "~/components/atoms/MenuAnchor";
import { NetworkSignal } from "~/components/atoms/NetworkSignal";
import {
  NewGamePanel,
} from "~/components/features/NewGamePanel";
import { ChatBubble } from "~/components/primitives/ChatBubble";
import { MenuTitle } from "~/components/primitives/MenuTitle";
import { DebrisPawnPlayground } from "~/screens/menuSky/DebrisPawnPlayground";
import { MenuBlackHole } from "~/screens/menuSky/MenuBlackHole";
import { MenuMoon } from "~/screens/menuSky/MenuMoon";
import { MenuPlanet, type MenuWorldId } from "~/screens/menuSky/MenuPlanet";
import styles from "~/screens/StarChessMenuScreen.module.css";
import type { NewGameOptions } from "~/types/newGame";

export type StarChessMenuAction =
  | "single-player"
  | "multiplayer"
  | "review"
  | "tutorial"
  | "credits"
  | "exit";

export type StarChessMenuScreenProps = {
  /** Optional handler when an enabled item is activated (story / shell). */
  onAction?: (action: StarChessMenuAction) => void;
  /** Fired when Single Player setup START is confirmed. */
  onStartGame?: (opts: NewGameOptions) => void;
};

/** Title-only control (Tutorial / Credits) — same chrome as MenuAnchor, no visual. */
const MenuTextItem: Component<{
  action: StarChessMenuAction;
  label: string;
  hint?: string;
  disabled?: boolean;
  class?: string;
  onAction?: (action: StarChessMenuAction) => void;
}> = (props) => {
  const activate = () => {
    if (props.disabled) return;
    props.onAction?.(props.action);
  };

  const onKeyDown: JSX.EventHandlerUnion<HTMLButtonElement, KeyboardEvent> = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };

  return (
    <button
      type="button"
      class={clsx(styles.textItem, props.class, props.disabled && styles.textItemDisabled)}
      disabled={props.disabled}
      aria-disabled={props.disabled || undefined}
      data-action={props.action}
      onClick={activate}
      onKeyDown={onKeyDown}
    >
      <MenuTitle disabled={props.disabled} hint={props.hint}>
        {props.label}
      </MenuTitle>
    </button>
  );
};

export const StarChessMenuScreen: Component<StarChessMenuScreenProps> = (props) => {
  const [planetWorld, setPlanetWorld] = createSignal<MenuWorldId>("eclipse");
  const [creditsOpen, setCreditsOpen] = createSignal(false);
  const [setupOpen, setSetupOpen] = createSignal(false);

  return (
    <div
      class={styles.root}
      data-testid="starchess-menu"
      data-menu="starchess"
    >
      <div
        class={styles.sky}
        data-planet-world={planetWorld()}
        aria-hidden="true"
      >
        <div class={styles.nebula} />
        <div class={styles.skyWash}>
          <span class={styles.washLabel}>{planetWorld().toUpperCase()}</span>
        </div>
        <MenuPlanet onWorldChange={setPlanetWorld} />
      </div>

      {/*
        Same splash column as apps/ui SplashScreen / MenuScreen — avatar box
        must stay pixel-identical across Chess ↔ StarChess.
      */}
      <div class={styles.splashContent} data-testid="menu-splash-slot">
        <div class={styles.splashAvatarWrapper}>
          <CoachAvatar identity="kerrigan" />
        </div>
        <ChatBubble testId="starchess-menu-bubble" class={styles.guideBubble}>
          I'm Selena Kerrigan, assigned to guide you through the stars!
        </ChatBubble>
      </div>

      <div class={styles.stage} aria-label="StarChess menu">
        <MenuAnchor
          class={styles.posSingle}
          action="single-player"
          label="Single Player"
          onActivate={() => {
            props.onAction?.("single-player");
            setSetupOpen(true);
          }}
        >
          <DebrisPawnPlayground embedded />
        </MenuAnchor>

        <MenuAnchor
          class={styles.posMulti}
          action="multiplayer"
          label="Multiplayer"
          hint="Coming Soon"
          disabled
          onActivate={() => props.onAction?.("multiplayer")}
        >
          <NetworkSignal disabled />
        </MenuAnchor>

        <MenuAnchor
          class={styles.posReview}
          action="review"
          label="Review"
          hint="Coming Soon"
          disabled
          onActivate={() => props.onAction?.("review")}
        >
          <MenuMoon embedded />
        </MenuAnchor>

        <MenuTextItem
          class={styles.posTutorial}
          action="tutorial"
          label="Tutorial"
          onAction={props.onAction}
        />
        <MenuTextItem
          class={styles.posCredits}
          action="credits"
          label="Credits"
          onAction={(action) => {
            props.onAction?.(action);
            setCreditsOpen(true);
          }}
        />

        <MenuAnchor
          class={styles.posExit}
          action="exit"
          label="Exit"
          onActivate={() => {
            props.onAction?.("exit");
            // Leave StarChess → Coach Chess (sibling app on /chess/).
            window.location.assign("/chess/");
          }}
        >
          <MenuBlackHole embedded />
        </MenuAnchor>
      </div>

      <Credits open={creditsOpen()} onClose={() => setCreditsOpen(false)} />
      <NewGamePanel
        open={setupOpen()}
        onClose={() => setSetupOpen(false)}
        onStart={(opts) => {
          setSetupOpen(false);
          props.onStartGame?.(opts);
        }}
      />
    </div>
  );
};
