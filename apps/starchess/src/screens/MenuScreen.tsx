/**
 * StarChess main menu — static StarCraft-inspired spatial layout.
 * Coach avatar uses the same splash slot metrics as apps/ui MenuScreen
 * (SplashScreen avatar wrapper) so Chess ↔ StarChess never shifts her.
 * Menu anchors map Brood War main-menu positions (viewport %).
 *
 * Single Player / Multiplayer / Review / Exit use {@link MenuAnchor}
 * (MenuTitle primitive + visual). Tutorial is title-only; Credits opens the
 * StarChess credits modal.
 *
 * Chess → StarChess arrival (glass / shatter / identity) lives in
 * {@link MenuArrival} — this screen exposes `identity` + `chrome` for that host.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import clsx from "clsx";
import { Show, createSignal, type Component, type JSX } from "solid-js";

import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import type { CoachIdentity } from "~/types/coach";
import type { StarChessMenuChrome } from "~/types/menu";
import { Credits } from "~/components/features/Credits";
import { MenuAnchor } from "@chess-coach/ui-web/atoms/MenuAnchor";
import { NetworkSignal } from "@chess-coach/ui-web/atoms/NetworkSignal";
import { FirstTimePrompt } from "~/components/features/FirstTimePrompt";
import {
  NewGamePanel,
} from "~/components/features/NewGamePanel";
import { ChatBubble } from "@chess-coach/ui-web/primitives/ChatBubble";
import { MenuTitle } from "@chess-coach/ui-web/primitives/MenuTitle";
import { DebrisPawnPlayground } from "~/screens/menuSky/DebrisPawnPlayground";
import { MenuBlackHole } from "~/screens/menuSky/MenuBlackHole";
import { MenuMoon } from "~/screens/menuSky/MenuMoon";
import { MenuPlanet, type MenuWorldId } from "~/screens/menuSky/MenuPlanet";
import styles from "~/screens/MenuScreen.module.css";
import { isTutorialCleared } from "~/store/tutorialProgressStore";
import type { NewGameOptions } from "~/types/newGame";

export type StarChessMenuAction =
  | "single-player"
  | "multiplayer"
  | "review"
  | "tutorial"
  | "credits"
  | "exit";

export type { StarChessMenuChrome } from "~/types/menu";

export type StarChessMenuScreenProps = {
  /** Optional handler when an enabled item is activated (story / shell). */
  onAction?: (action: StarChessMenuAction) => void;
  /** Fired when Single Player setup START is confirmed. */
  onStartGame?: (opts: NewGameOptions) => void;
  /**
   * Avatar identity — `selena` matches Coach MenuScreen; `kerrigan` is StarChess.
   * Defaults to kerrigan for the settled menu.
   */
  identity?: CoachIdentity;
  /**
   * Spatial menu chrome — `hidden` during Chess mockup / early arrival,
   * `in` while fading up, `on` when interactive (default).
   */
  chrome?: StarChessMenuChrome;
  /**
   * When false, keep the splash avatar box for layout but omit CoachAvatar
   * (MenuArrival / ChessMenuMockup owns Selena above the glass).
   */
  showAvatar?: boolean;
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

export const MenuScreen: Component<StarChessMenuScreenProps> = (props) => {
  const [planetWorld, setPlanetWorld] = createSignal<MenuWorldId>("eclipse");
  const [creditsOpen, setCreditsOpen] = createSignal(false);
  const [setupOpen, setSetupOpen] = createSignal(false);
  const [firstTimeOpen, setFirstTimeOpen] = createSignal(false);

  const identity = (): CoachIdentity => props.identity ?? "kerrigan";
  const chrome = (): StarChessMenuChrome => props.chrome ?? "on";
  const chromeInteractive = () => chrome() === "on";

  /** Uncleared tutorial → first-time gate; else open New Game setup. */
  const requestSinglePlayer = () => {
    if (!chromeInteractive()) return;
    props.onAction?.("single-player");
    if (!isTutorialCleared()) {
      setFirstTimeOpen(true);
      return;
    }
    setSetupOpen(true);
  };

  return (
    <div
      class={`starchess-menu ${styles.root}`}
      data-testid="starchess-menu"
      data-layout="menu"
      data-menu="starchess"
      data-chrome={chrome()}
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
      <div class={`menu-splash-slot ${styles.splashContent}`} data-testid="menu-splash-slot">
        <div class={styles.splashAvatarWrapper}>
          <Show when={props.showAvatar !== false}>
            <CoachAvatar identity={identity()} />
          </Show>
          {/* Float under Selena like TutorialGuideBubble (out of document flow). */}
          <div
            class={styles.guideSlot}
            classList={{
              [styles.chromeHidden]: chrome() === "hidden",
              [styles.chromeIn]: chrome() === "in",
              [styles.chromeOn]: chrome() === "on",
            }}
            data-testid="starchess-menu-guide-dock"
          >
            <ChatBubble testId="starchess-menu-bubble" class={styles.guideBubble}>
              I'm Selena, assigned to guide you through the stars!
            </ChatBubble>
          </div>
        </div>
      </div>

      <div
        class={styles.stage}
        classList={{
          [styles.chromeHidden]: chrome() === "hidden",
          [styles.chromeIn]: chrome() === "in",
          [styles.chromeOn]: chrome() === "on",
        }}
        aria-label="StarChess menu"
        aria-hidden={chrome() === "hidden" ? true : undefined}
      >
        <MenuAnchor
          class={styles.posSingle}
          action="single-player"
          label="Single Player"
          onActivate={requestSinglePlayer}
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
          onActivate={() => {
            if (!chromeInteractive()) return;
            props.onAction?.("review");
          }}
        >
          <MenuMoon embedded />
        </MenuAnchor>

        <MenuTextItem
          class={styles.posTutorial}
          action="tutorial"
          label="Tutorial"
          onAction={chromeInteractive() ? props.onAction : undefined}
        />
        <MenuTextItem
          class={styles.posCredits}
          action="credits"
          label="Credits"
          onAction={
            chromeInteractive()
              ? (action) => {
                  props.onAction?.(action);
                  setCreditsOpen(true);
                }
              : undefined
          }
        />

        <MenuAnchor
          class={styles.posExit}
          action="exit"
          label="Exit"
          onActivate={() => {
            if (!chromeInteractive()) return;
            props.onAction?.("exit");
            // Leave StarChess → Coach Chess (sibling app on /chess/).
            window.location.assign("/chess/");
          }}
        >
          <MenuBlackHole embedded />
        </MenuAnchor>
      </div>

      <Credits open={creditsOpen()} onClose={() => setCreditsOpen(false)} />
      <FirstTimePrompt
        open={firstTimeOpen()}
        onClose={() => setFirstTimeOpen(false)}
        onShowMe={() => {
          setFirstTimeOpen(false);
          props.onAction?.("tutorial");
        }}
        onYolo={() => {
          setFirstTimeOpen(false);
          setSetupOpen(true);
        }}
      />
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
