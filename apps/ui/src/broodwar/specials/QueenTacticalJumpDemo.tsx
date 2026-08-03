import { onMount, type Component } from "solid-js";

import { BroodWarChessBoard } from "~/broodwar/BroodWarChessBoard";
import { GasDeploy } from "~/broodwar/features/GasDeploy";
import { usePieceSpecialArm } from "~/broodwar/hooks/usePieceSpecialArm";
import {
  QUEEN_TACTICAL_JUMP_FEN,
  useQueenTacticalJump,
} from "~/broodwar/hooks/useQueenTacticalJump";
import styles from "~/broodwar/specials/QueenTacticalJumpDemo.module.css";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import {
  setActivePlayerColor,
  setNerdModeUnlocked,
  setPlayerIdentity,
} from "~/store/settingsStore";

/**
 * Storybook: Battlecruiser Tactical Jump — 2 gas arms targeting; click a
 * highlighted visible empty square to teleport through blockers.
 */
export const QueenTacticalJumpDemo: Component = () => {
  const special = useQueenTacticalJump();
  const { onGasDeploy } = usePieceSpecialArm({
    q: special.arm,
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
        <BroodWarChessBoard
          variant="eclipse"
          fogOfWar
          specialTargets={special.specialTargets()}
          onSquareClickIntercept={special.interceptSquareClick}
          jumpCues={special.jumpCues()}
          jumpTrails={special.jumpTrails()}
        />
      </div>
      <div class={styles.gasRow}>
        <GasDeploy onDeploy={onGasDeploy} />
      </div>
      <p class={styles.caption} data-tactical-jump-phase={special.phase()}>
        {special.caption()}
      </p>
    </div>
  );
};

export { QUEEN_TACTICAL_JUMP_FEN };
