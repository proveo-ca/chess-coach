import { onMount, type Component } from "solid-js";

import { GasDeploy } from "~/broodwar/features/GasDeploy";
import { useMarineDoubleStep } from "~/broodwar/hooks/useMarineDoubleStep";
import { usePieceSpecialArm } from "~/broodwar/hooks/usePieceSpecialArm";
import styles from "~/broodwar/specials/RookSiegeDemo.module.css";
import { BroodWarChessBoard } from "~/broodwar/BroodWarChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setNerdModeUnlocked, setPlayerIdentity } from "~/store/settingsStore";

/**
 * Storybook: Marine steps.
 * d2 = classical free double (native slide); e3 = BW gas extra step (+1, cued slide + aura).
 */
export const MarineDoubleDemo: Component = () => {
  const special = useMarineDoubleStep();
  const { onGasDeploy } = usePieceSpecialArm({
    p: special.arm,
  });

  onMount(() => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    loadFen(special.startingFen);
    special.seedEconomy();
  });

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <BroodWarChessBoard
          variant="eclipse"
          fogOfWar
          moveCues={special.moveCues()}
          moveProgress={special.moveProgress()}
        />
      </div>
      <div class={styles.gasRow}>
        <GasDeploy onDeploy={onGasDeploy} />
      </div>
      <p class={styles.caption}>{special.caption()}</p>
    </div>
  );
};
