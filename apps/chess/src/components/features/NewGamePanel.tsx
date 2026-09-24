import type { Component } from "solid-js";

import styles from "~/components/features/NewGamePanel.module.css";
import { PlayerNameField } from "~/components/features/PlayerNameField";
import { ColorSelector } from "@chess-coach/ui-web/primitives/ColorSelector";
import { Select } from "@chess-coach/ui-web/primitives/Select";
import { SplitButton } from "@chess-coach/ui-web/primitives/SplitButton";
import { Toggle } from "@chess-coach/ui-web/primitives/Toggle";
import { setLastAIMoveInfo } from "~/hooks/useMoveExecutor";
import { postMove, postNewGame } from "~/services/api";
import { dispatchCoachEvent, setAdvice, setShowNewGame } from "~/store/coachStore";
import { addMoveSan, resetGame } from "~/store/gameStore";
import { DIFFICULTY_OPTIONS, activePlayerColor, colorPref, difficulty, imLost, playerIdentity, setColorPref, setDifficulty, setImLost, setPlayerIdentity } from "~/store/settingsStore";
import { identityOptions } from "~/features/nerd/identity";
import type { PlayerIdentity } from "~/types/settings";

export const NewGamePanel: Component = () => {
  const handleNewGame = async () => {
    try {
      const data = await postNewGame();
      resetGame(data.fen);

      // If player is Black, trigger the AI to make the first move
      if (activePlayerColor() === "b") {
        const thinkingTimeout = window.setTimeout(() => {
          dispatchCoachEvent({ type: "AI_THINKING" });
        }, 3000);
        try {
          const moveData = await postMove({
            humanMoveSan: "",
            fenAfterHuman: data.fen,
            difficulty: difficulty(),
          });

          setLastAIMoveInfo({
            san: moveData.move,
            humanMoveSan: "",
            fen: moveData.fen,
            move: moveData.move,
            gameOver: null,
          });
          addMoveSan(moveData.move);
          setAdvice(moveData.advice ?? "I've made my move!");
          dispatchCoachEvent({ type: "AI_MOVED" });
        } catch (e) {
          console.error("Failed to get AI's first move", e);
          dispatchCoachEvent({ type: "AI_ERROR" });
        } finally {
          clearTimeout(thinkingTimeout);
        }
      }
    } catch (e) {
      console.error("Failed to start new game", e);
      resetGame(); // Fallback to local reset
    } finally {
      setShowNewGame(false);
    }
  };

  return (
    <div class={styles["new-game-panel"]}>
      <PlayerNameField />
      <ColorSelector value={colorPref()} onChange={setColorPref} />
      <Select
        value={playerIdentity()}
        onChange={(e) => setPlayerIdentity(e.currentTarget.value as PlayerIdentity)}
        disabled={imLost()}
      >
        {identityOptions().map((id) => (
          <option value={id}>{id}</option>
        ))}
      </Select>
      <Toggle
        class={styles["lost-toggle"]}
        label="i'm lost"
        checked={imLost()}
        onChange={(v) => setImLost(v)}
      />
      <SplitButton
        class={styles["start-split"]}
        primary
        onClick={handleNewGame}
        value={difficulty()}
        onChange={setDifficulty}
        options={DIFFICULTY_OPTIONS}
        selectLabel="Difficulty"
      >
        Start
      </SplitButton>
    </div>
  );
};
