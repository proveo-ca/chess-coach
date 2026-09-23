// SPEC: _spec/apps/ui/components.puml, _spec/apps/starchess/deployment.puml

import { useNavigate } from "@solidjs/router";
import { Show, type Component } from "solid-js";

import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { Credits } from "~/components/atoms/Credits";
import { NerdModePrompt } from "~/features/nerd/NerdModePrompt";
import { PlayerNameField } from "~/components/features/PlayerNameField";
import { ChatBubble } from "~/components/primitives/ChatBubble";
import { Label } from "~/components/primitives/Label";
import { MenuButton } from "~/components/primitives/MenuButton";
import { Select } from "~/components/primitives/Select";
import { SplashScreen } from "~/components/primitives/SplashScreen";
import { SplitButton } from "~/components/primitives/SplitButton";
import styles from "~/screens/MenuScreen.module.css";
import { setCoachEmotion, setShowCredits, showCredits } from "~/store/coachStore";
import { gameHistory } from "~/store/gameHistoryStore";
import {
  DIFFICULTY_OPTIONS,
  difficulty,
  playerIdentity,
  setDifficulty,
  setPlayerIdentity,
} from "~/store/settingsStore";
import { goStarChess } from "~/features/nerd/goStarChess";
import { identityOptions, isNerd } from "~/features/nerd/identity";
import type { PlayerIdentity } from "~/types/settings";

const COACH_LINE = "Wanna play Chess?";

export const MenuScreen: Component = () => {
  const navigate = useNavigate();

  return (
    <SplashScreen
      title={COACH_LINE}
      avatar={
        <div class={styles["coach-intro"]}>
          <CoachAvatar />
          <ChatBubble class={styles["coach-line"]} testId="menu-coach-line">
            {COACH_LINE}
          </ChatBubble>
        </div>
      }
    >
      <div class={styles["identity-row"]}>
        <label class={styles["identity-label"]} for="player-name">
          Name:
        </label>
        <PlayerNameField id="player-name" />
      </div>
      <div class={styles["identity-row"]}>
        <label class={styles["identity-label"]} for="player-identity">
          I am:
        </label>
        <Select
          id="player-identity"
          value={playerIdentity()}
          onChange={(e) => setPlayerIdentity(e.currentTarget.value as PlayerIdentity)}
        >
          {identityOptions().map((id) => (
            <option value={id}>{id}</option>
          ))}
        </Select>
      </div>
      <div class={`menu-options ${styles["menu-options"]}`}>
        <SplitButton
          class={styles["play-row"]}
          primary
          onClick={() => navigate("/selena")}
          value={difficulty()}
          onChange={setDifficulty}
          options={DIFFICULTY_OPTIONS}
          selectLabel="Difficulty"
        >
          Play with Selena
        </SplitButton>
        {/* Nerds keep the shortcut once found — see features/nerd/identity. */}
        <Show when={isNerd()}>
          <MenuButton
            class={styles["starchess-btn"]}
            data-testid="menu-play-starchess"
            onClick={() => goStarChess()}
          >
            Play StarChess
          </MenuButton>
        </Show>
        <MenuButton onClick={() => navigate("/analysis")}>Solo Analysis</MenuButton>
        <MenuButton onClick={() => navigate("/review")} disabled={gameHistory().length === 0}>
          Review
        </MenuButton>
        <MenuButton onClick={() => navigate("/lan")}>Play LAN</MenuButton>
        <MenuButton disabled>Learn to Play</MenuButton>
        <Label variant="caption" class={styles["coming-soon"]}>
          Coming soon!
        </Label>
      </div>
      <MenuButton class={styles["credits-btn"]} onClick={() => setShowCredits(true)}>
        Credits
      </MenuButton>
      <Credits open={showCredits()} onClose={() => setShowCredits(false)} />
      <NerdModePrompt onAccept={() => setCoachEmotion("happy")} />
    </SplashScreen>
  );
};
