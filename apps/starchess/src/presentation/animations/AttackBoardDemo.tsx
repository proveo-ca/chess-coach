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
} from "~/presentation/animations/attackAnim";
import styles from "~/presentation/animations/AttackBoardDemo.module.css";
import { attackVectorsFor, squareAt } from "~/presentation/animations/attackVectors";
import { AnimationStage } from "~/presentation/animations/AnimationStage";
import {
  clearSiegedRooks,
  setRookMode,
} from "~/presentation/animations/rookModeStore";
import type { AttackCue, RookMode } from "~/presentation/types";

const ORIGIN: Square = "d4";
const OPPOSING_PAWN: Square = "d6";

const FEN_BY_PIECE: Record<DemoPiece, string> = {
  p: "7k/8/3p4/8/3P4/8/8/K7 w - - 0 1",
  n: "7k/8/8/8/3N4/8/8/K7 w - - 0 1",
  b: "7k/8/8/8/3B4/8/8/K7 w - - 0 1",
  r: "7k/8/8/8/3R4/8/8/K7 w - - 0 1",
  q: "7k/8/8/8/3Q4/8/8/K7 w - - 0 1",
  k: "7k/8/8/8/3K4/8/8/8 w - - 0 1",
};

export const AttackBoardDemo: Component<{
  piece: DemoPiece;
  rookMode?: RookMode;
}> = (props) => {
  const vectors = createMemo(() => attackVectorsFor(props.piece, ORIGIN));
  const opposingVectors = createMemo(() =>
    props.piece === "p" ? attackVectorsFor("p", OPPOSING_PAWN, "b") : [],
  );
  const [vecIndex, setVecIndex] = createSignal(0);
  const [cues, setCues] = createSignal<AttackCue[]>([]);
  const [hide, setHide] = createSignal<Square[]>([]);

  let phaseTimer = 0;
  let cycleTimer = 0;

  const prepare = () => {
    clearSiegedRooks();
    if (props.piece === "r") setRookMode(ORIGIN, props.rookMode ?? "tank");
  };

  const targetSq = (origin: Square, list: ReturnType<typeof attackVectorsFor>) => {
    const vec = list[vecIndex() % Math.max(list.length, 1)];
    return vec ? squareAt(origin, vec) : null;
  };

  const beginIdleThenAttack = () => {
    window.clearTimeout(phaseTimer);
    setCues([]);
    setHide([]);
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
          rookMode: props.rookMode,
        });
        setHide([ORIGIN]);
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
          setHide((h) => [...h, OPPOSING_PAWN]);
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
        <AnimationStage
          fen={FEN_BY_PIECE[props.piece]}
          fog
          attackCues={cues()}
          hideSquares={hide()}
        />
      </div>
      <p class={styles.caption}>
        StarChess · {props.piece.toUpperCase()} · {captionTargets()} · attackCues
      </p>
    </div>
  );
};
