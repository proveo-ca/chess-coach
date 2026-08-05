import { onMount, type Component } from "solid-js";

import { GasDeploy } from "~/starchess/features/GasDeploy";
import { usePieceSpecialArm } from "~/starchess/hooks/usePieceSpecialArm";
import {
  SIEGE_TANK_FEN,
  SIEGE_TANK_SIEGE_SQ,
  SIEGE_TANK_SQ,
  useRookSiege,
} from "~/starchess/hooks/useRookSiege";
import styles from "~/starchess/specials/RookSiegeDemo.module.css";
import { StarChessBoard } from "~/starchess/StarChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";

/**
 * Storybook: two Siege Tanks (d4 tank / f4 siege). GasDeploy toggles either
 * with pack↔unpack animation both ways.
 */
export const RookSiegeDemo: Component = () => {
  const special = useRookSiege();
  const { onGasDeploy } = usePieceSpecialArm({
    r: special.arm,
  });

  onMount(() => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    loadFen(SIEGE_TANK_FEN);
    special.seedEconomy();
  });

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <StarChessBoard variant="eclipse" fogOfWar />
      </div>
      <div class={styles.gasRow}>
        <GasDeploy onDeploy={onGasDeploy} />
      </div>
      <p
        class={styles.caption}
        data-rook-mode-d4={special.modeAt(SIEGE_TANK_SQ)}
        data-rook-mode-f4={special.modeAt(SIEGE_TANK_SIEGE_SQ)}
      >
        {special.caption()} · d4={special.modeAt(SIEGE_TANK_SQ)} · f4=
        {special.modeAt(SIEGE_TANK_SIEGE_SQ)}
      </p>
    </div>
  );
};

export { SIEGE_TANK_FEN };
