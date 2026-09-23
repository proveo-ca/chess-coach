import type { Component } from "solid-js";

import styles from "~/components/features/PlayerNameField.module.css";
import { IconButton } from "~/components/primitives/IconButton";
import { Input } from "~/components/primitives/Input";
import { commitPlayerNameCheck } from "~/features/nerd/nameCommit";
import { playerName, setPlayerName } from "~/store/settingsStore";
import { randomName } from "~/utils/randomName";

/**
 * The player's display name input with a 🎲 button that fills a random, funny
 * name (via unique-names-generator). Bound directly to the persisted
 * `playerName` setting, so it stays in sync everywhere it's rendered (menu,
 * new-game panel, settings).
 *
 * Nerd-mode Levenshtein runs on blur / dice commit — not on every keystroke.
 */
export const PlayerNameField: Component<{ id?: string }> = (props) => {
  return (
    <div class={styles.field}>
      <Input
        id={props.id}
        type="text"
        value={playerName()}
        placeholder="Your name"
        maxLength={24}
        onInput={(e) => setPlayerName(e.currentTarget.value)}
        onBlur={() => commitPlayerNameCheck()}
      />
      <IconButton
        aria-label="Roll a random name"
        title="Roll a random name"
        onClick={() => {
          setPlayerName(randomName());
          commitPlayerNameCheck();
        }}
      >
        🎲
      </IconButton>
    </div>
  );
};
