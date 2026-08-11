import type { Square } from "chess.js";
import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";

import styles from "~/presentation/animations/components/DeathBoardDemo.module.css";
import {
  DEATH_MS,
  FEN_BY_PIECE,
  HOLD_MS,
  IDLE_MS,
  ORIGIN,
  type DeathPiece,
} from "~/presentation/animations/deathAnim";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import {
  clearSiegedRooks,
  setRookMode,
} from "~/presentation/animations/rookModeStore";
import { Screen } from "~/components/primitives/Screen";
import type { DeathCue } from "~/presentation/types";

const FEN_GONE: Record<DeathPiece, string> = {
  p: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  n: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  b: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  r: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  q: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  k: "7k/8/8/8/8/8/8/8 w - - 0 1",
};

const ROOK_TANK_SQ: Square = "c4";
const ROOK_SIEGE_SQ: Square = "e4";
const FEN_ROOK_DUAL = "7k/8/8/8/2R1R3/8/8/K7 w - - 0 1";

type DeathPhase = "idle" | "dying" | "gone";

export const DeathBoardDemo: Component<{ piece: DeathPiece }> = (props) => {
  const [phase, setPhase] = createSignal<DeathPhase>("idle");
  const [cues, setCues] = createSignal<DeathCue[]>([]);

  let stepTimer = 0;
  let loopTimer = 0;

  const idleFen = () => (props.piece === "r" ? FEN_ROOK_DUAL : FEN_BY_PIECE[props.piece]);

  const seedRookModes = () => {
    clearSiegedRooks();
    if (props.piece !== "r") return;
    setRookMode(ROOK_TANK_SQ, "tank");
    setRookMode(ROOK_SIEGE_SQ, "siege");
  };

  const makeCues = (): DeathCue[] => {
    if (props.piece === "r") {
      return [
        { id: "death-r-tank", piece: "r", color: "w", at: ROOK_TANK_SQ, rookMode: "tank" },
        { id: "death-r-siege", piece: "r", color: "w", at: ROOK_SIEGE_SQ, rookMode: "siege" },
      ];
    }
    return [
      {
        id: `death-${props.piece}`,
        piece: props.piece,
        color: "w",
        at: ORIGIN,
      },
    ];
  };

  const runOnce = () => {
    window.clearTimeout(stepTimer);
    seedRookModes();
    setPhase("idle");
    setCues([]);
    stepTimer = window.setTimeout(() => {
      setPhase("dying");
      setCues(makeCues());
      stepTimer = window.setTimeout(() => {
        setPhase("gone");
        setCues([]);
        stepTimer = window.setTimeout(() => {
          /* hold gone */
        }, HOLD_MS);
      }, DEATH_MS);
    }, IDLE_MS);
  };

  onMount(() => {
    seedRookModes();
    runOnce();
    loopTimer = window.setInterval(runOnce, IDLE_MS + DEATH_MS + HOLD_MS + 400);
    onCleanup(() => {
      window.clearTimeout(stepTimer);
      window.clearInterval(loopTimer);
    });
  });

  createEffect(() => {
    void props.piece;
    seedRookModes();
    runOnce();
  });

  const fen = () => {
    if (phase() === "gone") return FEN_GONE[props.piece];
    if (phase() === "dying") {
      // Hide shattered units under the death overlay.
      return FEN_GONE[props.piece];
    }
    return idleFen();
  };

  return (
    <Screen>
      <Screen.SidebarInset />
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class={styles.host}>
            <AnimationStage fen={fen()} fog combat={{ deathCues: cues() }} />
          </div>
        </Screen.BoardColumn>
      </Screen.BoardArea>
      <Screen.Footer>
        <p class={styles.caption}>
          StarChess · {props.piece.toUpperCase()} · {phase()} · deathCues
        </p>
      </Screen.Footer>
    </Screen>
  );
};
