import {
  createEffect,
  createSignal,
  onMount,
  type Component,
} from "solid-js";

import { GasDeploy } from "~/starchess/features/GasDeploy";
import { usePieceSpecialArm } from "~/starchess/hooks/usePieceSpecialArm";
import {
  VULTURE_FEN_START,
  useVultureSpiderMine,
} from "~/starchess/hooks/useVultureSpiderMine";
import styles from "~/starchess/specials/KnightMineDemo.module.css";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { currentFen, loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setNerdModeUnlocked, setPlayerIdentity } from "~/store/settingsStore";

/**
 * Storybook: stack order for Vulture spider mine — special+move or move+special.
 * Move L-path is {@link StarChessChessBoard} native — not story-owned VFX.
 */
export const KnightMineDemo: Component = () => {
  const [fen, setFen] = createSignal(VULTURE_FEN_START);

  const special = useVultureSpiderMine({ fen, setFen });
  const { onGasDeploy } = usePieceSpecialArm({
    n: special.arm,
  });

  const prepare = () => {
    setStorybookCapabilities({
      ...NERD_CAPABILITIES,
      readOnly: special.playing() || special.planDone(),
    });
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    loadFen(fen());
  };

  onMount(() => {
    special.seedEconomy();
    prepare();
  });

  createEffect(() => {
    void fen();
    void special.playing();
    void special.planDone();
    prepare();
  });

  createEffect(() => {
    special.syncFromBoard(currentFen());
  });

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <StarChessChessBoard
          variant="eclipse"
          fogOfWar
          spiderMines={special.mineAt() ? [special.mineAt()!] : []}
        />
      </div>
      <div class={styles.gasRow}>
        <GasDeploy onDeploy={onGasDeploy} />
      </div>
      <p class={styles.caption}>{special.caption()}</p>
    </div>
  );
};

export { VULTURE_FEN_START };
