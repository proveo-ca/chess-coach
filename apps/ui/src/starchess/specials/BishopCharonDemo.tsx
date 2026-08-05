import { onMount, type Component } from "solid-js";

import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import { GasDeploy } from "~/starchess/features/GasDeploy";
import { BISHOP_CHARON_FEN, useBishopCharon } from "~/starchess/hooks/useBishopCharon";
import { usePieceSpecialArm } from "~/starchess/hooks/usePieceSpecialArm";
import styles from "~/starchess/specials/BishopCharonDemo.module.css";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";

/**
 * Storybook: Goliath Charon Booster Missiles — 2 gas arms targeting only; click the
 * highlighted queen to fire twin homing missiles through blockers.
 */
export const BishopCharonDemo: Component = () => {
  const special = useBishopCharon();
  const { onGasDeploy } = usePieceSpecialArm({
    b: special.arm,
  });

  onMount(() => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    loadFen(special.startingFen());
    special.seedEconomy();
  });

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <StarChessChessBoard
          variant="eclipse"
          fogOfWar
          attackCues={special.combat.attackCues()}
          attackDying={special.combat.attackDying()}
          deathCues={special.combat.deathCues()}
          moveCues={special.combat.moveCues()}
          moveProgress={special.combat.moveProgress()}
          moveLeg={special.combat.moveLeg()}
          kingDamage={special.combat.kingDamage()}
          specialTargets={special.specialTargets()}
          armedBishops={special.armedBishops()}
          onSquareClickIntercept={special.interceptSquareClick}
        />
      </div>
      <div class={styles.gasRow}>
        <GasDeploy onDeploy={onGasDeploy} />
      </div>
      <p class={styles.caption} data-charon-phase={special.phase()}>
        {special.caption()}
      </p>
    </div>
  );
};

export { BISHOP_CHARON_FEN };
