/**
 * Menu Debris playground — invisible board cropped to top-right 2×2
 * (g7/h7/g8/h8), with a 2rem gutter (Storybook stage + embedded menu) so FX
 * aren’t clipped. Paths that leave the crop (red → g5, Ship → f5) are
 * intentional — pieces walk/jump out of frame.
 *
 * Loop: deploy blue(g7) + red(h8) → rifles → attackDying + deaths at
 * FRAG_FLIGHT_MS → red Marine g8→g5 (exits) → blue Marine h5→h8 (enters, promotes) →
 * deploy battleship → gas → jump to f5 (exits).
 *
 * Team paints: w = blue, b = red (nerd piece set).
 */
import clsx from "clsx";
import type { Square } from "chess.js";
import { onCleanup, onMount, createSignal, type Component } from "solid-js";

import {
  ATTACK_MS,
  FRAG_FLIGHT_MS,
  IDLE_FRONT_MS,
} from "~/presentation/animations/attackAnim";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import { DEATH_MS } from "~/presentation/animations/deathAnim";
import { DEPLOY_MS } from "~/presentation/animations/deployAnim";
import { moveDurationMs } from "~/presentation/animations/moveTiming";
import {
  TACTICAL_JUMP_APPEAR_MS,
  TACTICAL_JUMP_TRAIL_MS,
  TACTICAL_JUMP_TRAVEL_MS,
} from "~/presentation/specials/shipTacticalJump";
import { GAS_DROP_MS } from "~/presentation/constants";
import type {
  AttackCue,
  DeathCue,
  DeployCue,
  GasDropCue,
  MoveCue,
  ShipJumpTrail,
} from "~/types/cues";
import styles from "~/screens/menuSky/DebrisMarinePlayground.module.css";

export type DebrisMarinePlaygroundProps = {
  /** Relative layout inside {@link MenuAnchor} (not viewport-absolute). */
  embedded?: boolean;
};

/** Command Centers parked on the e-file (outside the f–h crop). */
const FEN_EMPTY = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
/** Blue marine g7 + red marine h8. */
const FEN_DUEL = "4k2p/6P1/8/8/8/8/8/4K3 w - - 0 1";
/** Red Marine on g8. */
const FEN_RED_G8 = "4k1p1/8/8/8/8/8/8/4K3 w - - 0 1";
/** Red Marine after g8→g5. */
const FEN_RED_G5 = "4k3/8/8/6p1/8/8/8/4K3 w - - 0 1";
/** Red g5 + blue marine on h5. */
const FEN_BLUE_H5 = "4k3/8/8/6pP/8/8/8/4K3 w - - 0 1";
/** Blue marine arrived on h8 (promotion square). */
const FEN_BLUE_H8 = "4k2P/8/8/6p1/8/8/8/4K3 w - - 0 1";
/** BattleShip on h8. */
const FEN_BATTLESHIP_H8 = "4k2Q/8/8/6p1/8/8/8/4K3 w - - 0 1";
/** BattleShip after Tactical Jump to f5. */
const FEN_BATTLESHIP_F5 = "4k3/8/8/5Q2/8/8/8/4K3 w - - 0 1";

const SQ = {
  blueHome: "g7" as Square,
  redHome: "h8" as Square,
  redStart: "g8" as Square,
  redEnd: "g5" as Square,
  blueStart: "h5" as Square,
  bluePromo: "h8" as Square,
  jumpTo: "f5" as Square,
};

const HOLD_MS = 700;
const BEAT_MS = 320;

export const DebrisMarinePlayground: Component<DebrisMarinePlaygroundProps> = (props) => {
  const [fen, setFen] = createSignal(FEN_EMPTY);
  const [attackCues, setAttackCues] = createSignal<AttackCue[]>([]);
  const [attackDying, setAttackDying] = createSignal<Record<string, boolean>>(
    {},
  );
  const [deathCues, setDeathCues] = createSignal<DeathCue[]>([]);
  const [moveCues, setMoveCues] = createSignal<MoveCue[]>([]);
  const [moveProgress, setMoveProgress] = createSignal<Record<string, 0 | 1>>(
    {},
  );
  const [deployCues, setDeployCues] = createSignal<DeployCue[]>([]);
  const [gasDropCues, setGasDropCues] = createSignal<GasDropCue[]>([]);
  const [gasAbsorb, setGasAbsorb] = createSignal<Square[]>([]);
  const [jumpCues, setJumpCues] = createSignal<MoveCue[]>([]);
  const [jumpTrails, setJumpTrails] = createSignal<ShipJumpTrail[]>([]);
  const [hide, setHide] = createSignal<Square[]>([]);

  const timers: number[] = [];
  let cancelled = false;

  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      const i = timers.indexOf(id);
      if (i >= 0) timers.splice(i, 1);
      fn();
    }, ms);
    timers.push(id);
  };

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      later(ms, () => resolve());
    });

  const clearTimers = () => {
    for (const id of timers) window.clearTimeout(id);
    timers.length = 0;
  };

  const resetFx = () => {
    setAttackCues([]);
    setAttackDying({});
    setDeathCues([]);
    setMoveCues([]);
    setMoveProgress({});
    setDeployCues([]);
    setGasDropCues([]);
    setGasAbsorb([]);
    setJumpCues([]);
    setJumpTrails([]);
    setHide([]);
  };

  const playMove = async (
    id: string,
    piece: MoveCue["piece"],
    color: MoveCue["color"],
    from: Square,
    to: Square,
  ) => {
    setHide([from]);
    setMoveCues([{ id, piece, color, from, to }]);
    setMoveProgress({ [id]: 0 });
    await wait(16);
    if (cancelled) return;
    setMoveProgress({ [id]: 1 });
    await wait(moveDurationMs(from, to, piece) + 40);
  };

  const runLoop = async () => {
    let cycle = 0;
    while (!cancelled) {
      cycle += 1;
      resetFx();
      setFen(FEN_EMPTY);
      await wait(BEAT_MS);
      if (cancelled) break;

      // 0) Deploy both marines (no FEN pop-in)
      setFen(FEN_DUEL);
      setHide([SQ.blueHome, SQ.redHome]);
      setDeployCues([
        {
          id: `debris-deploy-w-${cycle}`,
          piece: "p",
          color: "w",
          at: SQ.blueHome,
        },
        {
          id: `debris-deploy-b-${cycle}`,
          piece: "p",
          color: "b",
          at: SQ.redHome,
        },
      ]);
      await wait(DEPLOY_MS);
      if (cancelled) break;
      setDeployCues([]);
      setHide([]);
      await wait(BEAT_MS);
      if (cancelled) break;

      // 1) Idle → mutual rifle (board SVGs hidden for the whole combat window)
      await wait(IDLE_FRONT_MS);
      if (cancelled) break;
      const atkW = `debris-atk-w-${cycle}`;
      const atkB = `debris-atk-b-${cycle}`;
      setHide([SQ.blueHome, SQ.redHome]);
      setAttackDying({});
      setAttackCues([
        {
          id: atkW,
          piece: "p",
          color: "w",
          from: SQ.blueHome,
          to: SQ.redHome,
        },
        {
          id: atkB,
          piece: "p",
          color: "b",
          from: SQ.redHome,
          to: SQ.blueHome,
        },
      ]);
      // Kill→death meeting point — interrupt attack hulls (attackDying).
      await wait(FRAG_FLIGHT_MS);
      if (cancelled) break;

      // 2) Both die — hide attack SVGs via dyingIds; clear board FEN; death owns the squares.
      setFen(FEN_EMPTY);
      setHide([SQ.blueHome, SQ.redHome]);
      setAttackDying({ [atkW]: true, [atkB]: true });
      setDeathCues([
        {
          id: `debris-death-w-${cycle}`,
          piece: "p",
          color: "w",
          at: SQ.blueHome,
          seed: cycle * 17,
        },
        {
          id: `debris-death-b-${cycle}`,
          piece: "p",
          color: "b",
          at: SQ.redHome,
          seed: cycle * 31,
        },
      ]);
      await wait(DEATH_MS);
      if (cancelled) break;
      setDeathCues([]);
      // Finish remaining attack window with hulls already suppressed, then clear.
      await wait(Math.max(0, ATTACK_MS - FRAG_FLIGHT_MS - DEATH_MS));
      if (cancelled) break;
      setAttackCues([]);
      setAttackDying({});
      setHide([]);
      await wait(BEAT_MS);
      if (cancelled) break;

      // 3) Red Marine g8 → g5
      setFen(FEN_RED_G8);
      await wait(BEAT_MS);
      if (cancelled) break;
      await playMove(`debris-red-${cycle}`, "p", "b", SQ.redStart, SQ.redEnd);
      if (cancelled) break;
      setFen(FEN_RED_G5);
      resetFx();
      await wait(BEAT_MS);
      if (cancelled) break;

      // 4) Blue Marine h5 → h8 (promotion square)
      setFen(FEN_BLUE_H5);
      await wait(BEAT_MS);
      if (cancelled) break;
      await playMove(
        `debris-blue-${cycle}`,
        "p",
        "w",
        SQ.blueStart,
        SQ.bluePromo,
      );
      if (cancelled) break;
      setFen(FEN_BLUE_H8);
      resetFx();
      await wait(BEAT_MS);
      if (cancelled) break;

      // 5) Deploy BattleShip onto h8
      setFen(FEN_BATTLESHIP_H8);
      setHide([SQ.bluePromo]);
      setDeployCues([
        {
          id: `debris-deploy-q-${cycle}`,
          piece: "q",
          color: "w",
          at: SQ.bluePromo,
        },
      ]);
      await wait(DEPLOY_MS);
      if (cancelled) break;
      setDeployCues([]);
      setHide([]);
      await wait(BEAT_MS);
      if (cancelled) break;

      // 6) Gas / special absorb, then Tactical Jump → f5
      setGasAbsorb([SQ.bluePromo]);
      setGasDropCues([
        {
          id: `debris-gas-${cycle}`,
          at: SQ.bluePromo,
          color: "w",
          corner: "mid",
        },
      ]);
      await wait(GAS_DROP_MS + 120);
      if (cancelled) break;
      setGasDropCues([]);

      const jumpId = `debris-jump-${cycle}`;
      setHide([SQ.bluePromo]);
      setJumpCues([
        {
          id: jumpId,
          piece: "q",
          color: "w",
          from: SQ.bluePromo,
          to: SQ.jumpTo,
          shipJump: true,
        },
      ]);
      setJumpTrails([{ id: jumpId, from: SQ.bluePromo, to: SQ.jumpTo }]);
      await wait(TACTICAL_JUMP_TRAVEL_MS + TACTICAL_JUMP_APPEAR_MS);
      if (cancelled) break;

      setFen(FEN_BATTLESHIP_F5);
      setJumpCues([]);
      setHide([]);
      setGasAbsorb([]);
      // Trails linger, then hold on f5 before looping.
      await wait(TACTICAL_JUMP_TRAIL_MS);
      if (cancelled) break;
      setJumpTrails([]);
      await wait(HOLD_MS);
    }
  };

  onMount(() => {
    void runLoop();
    onCleanup(() => {
      cancelled = true;
      clearTimers();
    });
  });

  return (
    <div
      class={clsx(styles.root, props.embedded && styles.embedded)}
      data-testid="debris-marine-playground"
      aria-hidden="true"
    >
      <div class={`${styles.shift} ${styles.invisible}`}>
        <AnimationStage
          fen={fen()}
          fog={false}
          combat={{
            attackCues: attackCues(),
            attackDying: attackDying(),
            deathCues: deathCues(),
            moveCues: moveCues(),
            moveProgress: moveProgress(),
            deployCues: deployCues(),
            gasDropCues: gasDropCues(),
            jumpCues: jumpCues(),
            jumpTrails: jumpTrails(),
          }}
          gasAbsorbSquares={gasAbsorb()}
          hideSquares={hide()}
        />
      </div>
    </div>
  );
};
