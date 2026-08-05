import type { Square } from "chess.js";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";

import {
  ATTACK_MS,
  IDLE_FRONT_MS,
  type DemoPiece,
} from "~/starchess/animations/attackAnim";
import styles from "~/starchess/animations/AttackBoardDemo.module.css";
import { attackVectorsFor, squareAt } from "~/starchess/animations/attackVectors";
import type { AttackCue } from "~/starchess/animations/types";
import { clearSiegedRooks, setRookMode } from "~/starchess/starChessStore";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";
import type { RookMode } from "~/starchess/types";

const ORIGIN: Square = "d4";
/** Opposing pawn in the Pawn Rifle story — fires down the board (front glass). */
const OPPOSING_PAWN: Square = "d6";

/**
 * Demo positions must be chess.js-valid (both kings present). StarChess keeps
 * the same contract so ChessBoard can always load via FEN.
 */
const FEN_BY_PIECE: Record<DemoPiece, string> = {
  p: "7k/8/3p4/8/3P4/8/8/K7 w - - 0 1",
  n: "7k/8/8/8/3N4/8/8/K7 w - - 0 1",
  b: "7k/8/8/8/3B4/8/8/K7 w - - 0 1",
  r: "7k/8/8/8/3R4/8/8/K7 w - - 0 1",
  q: "7k/8/8/8/3Q4/8/8/K7 w - - 0 1",
  k: "7k/8/8/8/3K4/8/8/8 w - - 0 1",
};

type AttackBoardDemoProps = {
  piece: DemoPiece;
  /** Seed store mode for the origin rook when `piece === "r"`. */
  rookMode?: RookMode;
};

/**
 * Storybook harness: cycles legal attack vectors through ChessBoard's
 * production `attackCues` → `AttackAnimation` layer.
 */
export const AttackBoardDemo: Component<AttackBoardDemoProps> = (props) => {
  const vectors = createMemo(() => attackVectorsFor(props.piece, ORIGIN));
  const opposingVectors = createMemo(() =>
    props.piece === "p" ? attackVectorsFor("p", OPPOSING_PAWN, "b") : [],
  );
  const [vecIndex, setVecIndex] = createSignal(0);
  const [cues, setCues] = createSignal<AttackCue[]>([]);

  let phaseTimer = 0;
  let cycleTimer = 0;

  const prepare = () => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    clearSiegedRooks();
    if (props.piece === "r") {
      setRookMode(ORIGIN, props.rookMode ?? "tank");
    }
    loadFen(FEN_BY_PIECE[props.piece]);
  };

  const targetSq = (origin: Square, list: ReturnType<typeof attackVectorsFor>) => {
    const vec = list[vecIndex() % Math.max(list.length, 1)];
    return vec ? squareAt(origin, vec) : null;
  };

  const beginIdleThenAttack = () => {
    window.clearTimeout(phaseTimer);
    setCues([]);
    phaseTimer = window.setTimeout(() => {
      const next: AttackCue[] = [];
      const to = targetSq(ORIGIN, vectors());
      if (to) {
        next.push({
          id: `story-atk-${props.piece}-${vecIndex()}`,
          piece: props.piece,
          color: "w",
          from: ORIGIN,
          to,
        });
      }
      const oppList = opposingVectors();
      if (oppList.length > 0) {
        const oppTo = targetSq(OPPOSING_PAWN, oppList);
        if (oppTo) {
          next.push({
            id: `story-atk-p-opp-${vecIndex()}`,
            piece: "p",
            color: "b",
            from: OPPOSING_PAWN,
            to: oppTo,
          });
        }
      }
      setCues(next);
    }, IDLE_FRONT_MS);
  };

  const armCycle = () => {
    window.clearInterval(cycleTimer);
    const period = IDLE_FRONT_MS + ATTACK_MS;
    beginIdleThenAttack();
    cycleTimer = window.setInterval(() => {
      const n = Math.max(vectors().length, opposingVectors().length);
      if (n === 0) return;
      setVecIndex((i) => (i + 1) % n);
      beginIdleThenAttack();
    }, period);
  };

  onMount(() => {
    prepare();
    setVecIndex(0);
  });

  createEffect(() => {
    void props.piece;
    void props.rookMode;
    prepare();
    setVecIndex(0);
    armCycle();
    onCleanup(() => {
      window.clearInterval(cycleTimer);
      window.clearTimeout(phaseTimer);
    });
  });

  const captionTargets = () => {
    const live = cues();
    if (live.length === 0) return "idle (board piece)";
    return live.map((c) => `${c.from}→${c.to}`).join(" · ");
  };

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <StarChessChessBoard
          variant="eclipse"
          fogOfWar
          attackCues={cues()}
        />
      </div>
      <p class={styles.caption}>
        StarChess · {props.piece.toUpperCase()} · {captionTargets()} · ChessBoard attackCues
      </p>
    </div>
  );
};
