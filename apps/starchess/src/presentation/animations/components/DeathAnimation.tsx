// SPEC: _spec/apps/starchess/architecture/board-entities.puml
import { For, Show, createMemo, type Component, type JSX } from "solid-js";
import type { Square } from "chess.js";

import { syncToClock } from "~/presentation/animations/clockSync";
import { vfxTier } from "~/store/vfxTierStore";
import { DEATH_MS, scatterSeedFromId } from "~/presentation/animations/deathAnim";
import styles from "~/presentation/animations/components/DeathAnimation.module.css";
import { DeathMecha } from "~/presentation/animations/pieces/components/DeathMecha";
import { DeathCommandCenter } from "~/presentation/animations/pieces/components/DeathCommandCenter";
import { DeathHoverbike } from "~/presentation/animations/pieces/components/DeathHoverbike";
import { DeathMine } from "~/presentation/animations/pieces/components/DeathMine";
import { DeathMarine } from "~/presentation/animations/pieces/components/DeathMarine";
import { DeathBattleShip } from "~/presentation/animations/pieces/components/DeathBattleShip";
import { DeathTank } from "~/presentation/animations/pieces/components/DeathTank";
import { squareBoxStyle } from "~/presentation/animations/boardGeom";
import { tankModeAt } from "~/presentation/animations/tankModeStore";
import { teamTintStyle, type PieceColor } from "~/presentation/pieces/teamColors";
import type { StarChessPiece, DeathCue } from "~/presentation/animations/types";

const NO_SPECIAL_USED: ReadonlySet<Square> = new Set();

const deathNode = (
  piece: StarChessPiece,
  color: PieceColor,
  seed: number,
  cue: DeathCue,
): JSX.Element => {
  // A mine death cue carries `piece: "n"` — the hoverbike that laid it owns the
  // colour, not the silhouette. Without this branch the wreck is a bike.
  if (cue.mine) return <DeathMine color={color} seed={seed} />;
  switch (piece) {
    case "p":
      return <DeathMarine color={color} seed={seed} />;
    case "n":
      return <DeathHoverbike color={color} seed={seed} />;
    case "b":
      return <DeathMecha color={color} seed={seed} />;
    case "r":
      return <DeathTank color={color} seed={seed} mode={cue.tankMode ?? tankModeAt(cue.at)} />;
    case "q":
      return <DeathBattleShip color={color} seed={seed} />;
    case "k":
      return <DeathCommandCenter color={color} seed={seed} damage="destroyed" collapse />;
  }
};

export type DeathAnimationProps = {
  cues: readonly DeathCue[];
  /** Squares with gas / U: — keep green aura on dying hulls. */
  specialUsedSquares?: ReadonlySet<Square> | readonly Square[];
  boardWidth: number;
  boardHeight: number;
  /**
   * When set, positions the overlay absolutely relative to a host wrapper.
   * Omit when nesting inside the ChessBoard grid (inset 0).
   */
  box?: { top: number; left: number };
};

/**
 * StarChess death VFX layer — every cue finishes in `DEATH_MS` (`ATTACK_MS / 2`).
 * Marine: outward bubble + shred; Command Center: rubble collapse; others: boom + shards.
 * Rows key by cue.id so remapped cue objects do not remount / restart CSS.
 */
export const DeathAnimation: Component<DeathAnimationProps> = (props) => {
  const used = (): ReadonlySet<Square> => {
    const g = props.specialUsedSquares;
    if (!g) return NO_SPECIAL_USED;
    return g instanceof Set ? g : new Set(g);
  };

  const ids = createMemo(() => props.cues.map((c) => c.id));
  const byId = createMemo(() => {
    const m = new Map<string, DeathCue>();
    for (const c of props.cues) m.set(c.id, c);
    return m;
  });

  return (
  <div
    class={styles.boardOverlay}
    data-starchess-death-layer
    style={{
      ...(props.box
        ? {
            top: `${props.box.top}px`,
            left: `${props.box.left}px`,
            width: `${props.boardWidth}px`,
            height: `${props.boardHeight}px`,
          }
        : {
            inset: "0",
            width: "100%",
            height: "100%",
          }),
      "--death-ms": `${DEATH_MS}ms`,
    }}
  >
    <For each={ids()}>
      {(id) => {
        const cue = () => byId().get(id)!;
        const mineDeath = () => !!cue().mine;
        const marineDeath = () => !mineDeath() && cue().piece === "p";
        const ccDeath = () => !mineDeath() && cue().piece === "k";
        const seed = () => scatterSeedFromId(id);
        const gas = () => used().has(cue().at);
        return (
          <div
            ref={(el) => syncToClock(el)}
            class={styles.originSlot}
            classList={{
              [styles.dying]: true,
              [styles.dyingMarine]: marineDeath(),
              [styles.dyingDrama]: mineDeath() || (!marineDeath() && !ccDeath()),
              [styles.dyingCC]: ccDeath(),
            }}
            style={{
              ...squareBoxStyle(cue().at, props.boardWidth, props.boardHeight),
              ...teamTintStyle(cue().color),
            }}
            data-square={cue().at}
            data-death-phase="dying"
            data-death-mine={mineDeath() ? "true" : undefined}
            data-special-used={gas() ? "true" : undefined}
            data-scatter-seed={String(seed())}
          >
            <div class={styles.pieceFace} classList={{ ["sc-special-used"]: gas() }}>
              {deathNode(cue().piece, cue().color, seed(), cue())}
              <div class={styles.boomFlash} aria-hidden="true" />
              <div class={styles.boomRing} aria-hidden="true" />
              {/*
                A mine is hoverbike ordnance, so it goes off like the bike's frag
                does: the same double-pulse fireball and ring the attack layer
                flies to a target, fired in place with no flight delay.
              */}
              <Show when={mineDeath()}>
                <div class={styles.mineFrag} data-part="mine-frag" aria-hidden="true">
                  <div class={styles.mineFragCore} />
                  <Show when={vfxTier() === "full"}>
                    <div class={styles.mineFragRing} />
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        );
      }}
    </For>
  </div>
  );
};
