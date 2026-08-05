import type { Square } from "chess.js";
import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";

import styles from "~/starchess/animations/DeathBoardDemo.module.css";
import {
  DEATH_MS,
  FEN_BY_PIECE,
  HOLD_MS,
  IDLE_MS,
  ORIGIN,
  type DeathPiece,
} from "~/starchess/animations/deathAnim";
import type { DeathCue } from "~/starchess/animations/types";
import { StarChessBoard } from "~/starchess/StarChessBoard";
import { clearSiegedRooks, setRookMode } from "~/starchess/starChessStore";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";

/** Empty origin after death — kings only (StarChess suppresses classical draws). */
const FEN_GONE: Record<DeathPiece, string> = {
  p: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  n: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  b: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  r: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  q: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  k: "7k/8/8/8/8/8/8/8 w - - 0 1",
};

/** Tank (left) + siege (right) — side-by-side shatter on one board. */
const ROOK_TANK_SQ: Square = "c4";
const ROOK_SIEGE_SQ: Square = "e4";
const FEN_ROOK_DUAL = "7k/8/8/8/2R1R3/8/8/K7 w - - 0 1";

type DeathPhase = "idle" | "dying" | "gone";

type DeathBoardDemoProps = {
  piece: DeathPiece;
};

/**
 * Storybook harness: plays death cues through ChessBoard's production
 * `deathCues` → `DeathAnimation` layer.
 *
 * Rook story seeds tank @ c4 and siege @ e4 so both modes shatter together.
 */
export const DeathBoardDemo: Component<DeathBoardDemoProps> = (props) => {
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

  const prepare = () => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    seedRookModes();
    loadFen(idleFen());
  };

  const makeCues = (): DeathCue[] => {
    const stamp = Date.now();
    if (props.piece === "r") {
      return [
        {
          id: `story-death-r-tank-${stamp}`,
          piece: "r",
          color: "w",
          at: ROOK_TANK_SQ,
        },
        {
          id: `story-death-r-siege-${stamp}`,
          piece: "r",
          color: "w",
          at: ROOK_SIEGE_SQ,
        },
      ];
    }
    return [
      {
        id: `story-death-${props.piece}-${stamp}`,
        piece: props.piece,
        color: "w",
        at: ORIGIN,
      },
    ];
  };

  const runOnce = () => {
    window.clearTimeout(stepTimer);
    setCues([]);
    setPhase("idle");
    seedRookModes();
    loadFen(idleFen());
    stepTimer = window.setTimeout(() => {
      setPhase("dying");
      setCues(makeCues());
      stepTimer = window.setTimeout(() => {
        setCues([]);
        setPhase("gone");
        clearSiegedRooks();
        loadFen(FEN_GONE[props.piece]);
      }, DEATH_MS);
    }, IDLE_MS);
  };

  const armLoop = () => {
    window.clearInterval(loopTimer);
    runOnce();
    loopTimer = window.setInterval(runOnce, IDLE_MS + DEATH_MS + HOLD_MS);
  };

  onMount(() => {
    prepare();
  });

  createEffect(() => {
    void props.piece;
    prepare();
    armLoop();
    onCleanup(() => {
      window.clearInterval(loopTimer);
      window.clearTimeout(stepTimer);
    });
  });

  const dramatic = () => props.piece !== "p" && props.piece !== "k";
  const phaseLabel = () => {
    if (phase() === "idle") return "idle";
    if (phase() === "dying") {
      if (props.piece === "p") return "bubble rip";
      if (props.piece === "k") return "rubble collapse";
      if (props.piece === "r") return "tank + siege boom";
      return "boom + shards";
    }
    return "gone";
  };

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <StarChessBoard
          variant="eclipse"
          fogOfWar
          deathCues={cues()}
        />
      </div>
      <p class={styles.caption}>
        StarChess · {props.piece.toUpperCase()} death · {phaseLabel()}
        {props.piece === "r"
          ? " · c4 tank · e4 siege · 500ms shatter"
          : props.piece === "k"
            ? " · 500ms rubble"
            : dramatic()
              ? " · 500ms shatter"
              : " · 500ms outward pop"}{" "}
        · ChessBoard deathCues
      </p>
    </div>
  );
};
