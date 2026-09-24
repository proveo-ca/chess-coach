import type { Square } from "chess.js";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
  type Component,
} from "solid-js";

import {
  ATTACK_MS,
  IDLE_FRONT_MS,
  type DemoPiece,
} from "~/presentation/animations/attackAnim";
import styles from "~/presentation/animations/components/AttackBoardDemo.module.css";
import { attackVectorsFor, squareAt } from "~/presentation/animations/attackVectors";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import {
  clearSiegedTanks,
  setTankMode,
} from "~/presentation/animations/tankModeStore";
import { Screen } from "~/components/primitives/Screen";
import type { AttackCue, TankMode } from "~/presentation/types";

const ORIGIN: Square = "d4";
const OPPOSING_MARINE: Square = "d6";

const FEN_BY_PIECE: Record<DemoPiece, string> = {
  p: "7k/8/3p4/8/3P4/8/8/K7 w - - 0 1",
  n: "7k/8/8/8/3N4/8/8/K7 w - - 0 1",
  b: "7k/8/8/8/3B4/8/8/K7 w - - 0 1",
  // Siege HE needs a victim on an adjacent square (d5) so impact reads clearly.
  r: "7k/8/8/3p4/3R4/8/8/K7 w - - 0 1",
  q: "7k/8/8/8/3Q4/8/8/K7 w - - 0 1",
  k: "7k/8/8/8/3K4/8/8/8 w - - 0 1",
};

export const AttackBoardDemo: Component<{
  piece: DemoPiece;
  tankMode?: TankMode;
  variant?: import("~/types/board").BoardSkin;
  pieceSet?: import("~/types/board").PieceSet;
  header?: import("solid-js").JSX.Element;
  footerExtra?: import("solid-js").JSX.Element;
  sidebar?: import("solid-js").JSX.Element;
}> = (props) => {
  const vectors = createMemo(() => attackVectorsFor(props.piece, ORIGIN));
  const opposingVectors = createMemo(() =>
    props.piece === "p" ? attackVectorsFor("p", OPPOSING_MARINE, "b") : [],
  );
  const [vecIndex, setVecIndex] = createSignal(0);
  const [cues, setCues] = createSignal<AttackCue[]>([]);
  const [hide, setHide] = createSignal<Square[]>([]);

  let phaseTimer = 0;
  let cycleTimer = 0;

  const prepare = () => {
    clearSiegedTanks();
    if (props.piece === "r") setTankMode(ORIGIN, props.tankMode ?? "tank");
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
          tankMode: props.tankMode,
        });
        setHide([ORIGIN]);
      }
      const oppList = opposingVectors();
      if (oppList.length > 0) {
        const oppTo = targetSq(OPPOSING_MARINE, oppList);
        if (oppTo) {
          next.push({
            id: `story-atk-p-opp-${vecIndex()}`,
            piece: "p",
            color: "b",
            from: OPPOSING_MARINE,
            to: oppTo,
          });
          setHide((h) => [...h, OPPOSING_MARINE]);
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
    void props.tankMode;
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
    <Screen>
      <Show when={props.header} fallback={<Screen.SidebarInset />}>
        <Screen.Header>{props.header}</Screen.Header>
      </Show>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class={styles.host}>
            <AnimationStage
              fen={FEN_BY_PIECE[props.piece]}
              fog
              combat={{ attackCues: cues() }}
              hideSquares={hide()}
              variant={props.variant}
              pieceSet={props.pieceSet}
            />
          </div>
        </Screen.BoardColumn>
        <Show when={props.sidebar}>{props.sidebar}</Show>
      </Screen.BoardArea>
      <Screen.Footer>
        <Show when={props.footerExtra}>{props.footerExtra}</Show>
        <p class={styles.caption}>
          StarChess · {props.piece.toUpperCase()} · {captionTargets()} · attackCues
        </p>
      </Screen.Footer>
    </Screen>
  );
};
