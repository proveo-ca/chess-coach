import { createSignal, onMount, type Component } from "solid-js";
import type { Square } from "chess.js";

import { createPhaseClock } from "~/presentation/animations/phaseLoop";

import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import styles from "~/presentation/animations/components/CrushBoardDemo.module.css";
import { CRUSH_DEATH_MS, DEPLOY_MS } from "~/presentation/constants";
import { DEATH_MS, HOLD_MS, IDLE_MS, ORIGIN } from "~/presentation/animations/deathAnim";
import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import type { DeathCue, DeployCue } from "~/presentation/types";

// SPEC: _spec/apps/starchess/architecture/composite-vfx-stack.puml, _spec/apps/starchess/vfx-guarantees.md
/**
 * Ally deploy-crush loop — white Marine drops onto black Hoverbike's square.
 * Mirrors `timelinePlayer.handleDeployWindow`: deploy at t0, crush death at
 * `CRUSH_DEATH_MS`, shared `hideSquares`, so the deploy hull must paint above
 * the death boom (Deploy z37 > Death z35) instead of switching clips.
 */

const AT: Square = ORIGIN;
const CRUSH_WINDOW_MS = Math.max(DEPLOY_MS, CRUSH_DEATH_MS + DEATH_MS);
const LOOP_TAIL_MS = 400;

const FEN_IDLE = "7k/8/8/8/3n4/8/8/K7 w - - 0 1";
const FEN_LANDED = "7k/8/8/8/3P4/8/8/K7 w - - 0 1";

type CrushPhase = "idle" | "crushing" | "landed";

export const CrushBoardDemo: Component = () => {
  const [phase, setPhase] = createSignal<CrushPhase>("idle");
  const [fen, setFen] = createSignal(FEN_IDLE);
  const [deploys, setDeploys] = createSignal<DeployCue[]>([]);
  const [deaths, setDeaths] = createSignal<DeathCue[]>([]);

  onMount(() =>
    createPhaseClock(
      [
        [
          0,
          () => {
            setPhase("idle");
            setFen(FEN_IDLE);
            setDeploys([]);
            setDeaths([]);
          },
        ],
        [
          IDLE_MS,
          () => {
            setPhase("crushing");
            setFen(FEN_LANDED);
            setDeploys([{ id: "crush-deploy", piece: "p", color: "w", at: AT }]);
          },
        ],
        [
          IDLE_MS + CRUSH_DEATH_MS,
          () => setDeaths([{ id: "crush-death", piece: "n", color: "b", at: AT }]),
        ],
        [
          IDLE_MS + CRUSH_WINDOW_MS,
          () => {
            setPhase("landed");
            setDeploys([]);
            setDeaths([]);
          },
        ],
      ],
      IDLE_MS + CRUSH_WINDOW_MS + HOLD_MS + LOOP_TAIL_MS,
    ),
  );

  return (
    <Screen>
      <Screen.SidebarInset />
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class={styles.host}>
            <AnimationStage
              fen={fen()}
              fog={false}
              visionMode="observer"
              combat={{ deployCues: deploys(), deathCues: deaths() }}
              hideSquares={phase() === "crushing" ? [AT] : []}
            />
          </div>
        </Screen.BoardColumn>
      </Screen.BoardArea>
      <Screen.Footer>
        <p class={styles.caption}>
          StarChess · crush deploy+death · {phase()} · deploy p over death n
        </p>
      </Screen.Footer>
    </Screen>
  );
};
