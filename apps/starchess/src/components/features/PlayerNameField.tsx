/**
 * Player display name — bound to shared Coach/StarChess localStorage settings.
 */
import type { Component } from "solid-js";

import styles from "~/components/features/PlayerNameField.module.css";
import { IconButton } from "~/components/primitives/IconButton";
import { Input } from "~/components/primitives/Input";
import { playerName, setPlayerName } from "~/store/settingsStore";
import { randomName } from "~/utils/randomName";

export const PlayerNameField: Component<{ id?: string }> = (props) => (
  <div class={styles.field}>
    <Input
      id={props.id}
      type="text"
      value={playerName()}
      placeholder="Your name"
      maxLength={24}
      onInput={(e) => setPlayerName(e.currentTarget.value)}
      data-testid="starchess-player-name"
    />
    <IconButton
      aria-label="Roll a random name"
      title="Roll a random name"
      onClick={() => setPlayerName(randomName())}
    >
      🎲
    </IconButton>
  </div>
);
