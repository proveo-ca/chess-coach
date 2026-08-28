// SPEC: _spec/apps/starchess/architecture/board-entities.puml
import { For, Show, createMemo, type Component, type JSX } from "solid-js";
import type { Square } from "chess.js";

import { DEATH_MS, scatterSeedFromId } from "~/presentation/animations/deathAnim";
import styles from "~/presentation/animations/components/DeathAnimation.module.css";
import { DeathBishop } from "~/presentation/animations/pieces/components/DeathBishop";
import { DeathKing } from "~/presentation/animations/pieces/components/DeathKing";
import { DeathKnight } from "~/presentation/animations/pieces/components/DeathKnight";
import { DeathMine } from "~/presentation/animations/pieces/components/DeathMine";
import { DeathPawn } from "~/presentation/animations/pieces/components/DeathPawn";
import { DeathQueen } from "~/presentation/animations/pieces/components/DeathQueen";
import { DeathRook } from "~/presentation/animations/pieces/components/DeathRook";
import { squareBoxStyle } from "~/presentation/animations/boardGeom";
import { rookModeAt } from "~/presentation/animations/rookModeStore";
import { teamTintStyle, type PieceColor } from "~/presentation/animations/teamColors";
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
      return <DeathPawn color={color} seed={seed} />;
    case "n":
      return <DeathKnight color={color} seed={seed} />;
    case "b":
      return <DeathBishop color={color} seed={seed} />;
    case "r":
      return <DeathRook color={color} seed={seed} mode={cue.rookMode ?? rookModeAt(cue.at)} />;
    case "q":
      return <DeathQueen color={color} seed={seed} />;
    case "k":
      return <DeathKing color={color} seed={seed} damage="destroyed" collapse />;
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
 * Pawn: outward bubble + shred; king: rubble collapse; others: boom + shards.
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
        const pawnDeath = () => !mineDeath() && cue().piece === "p";
        const kingDeath = () => !mineDeath() && cue().piece === "k";
        const seed = () => scatterSeedFromId(id);
        const gas = () => used().has(cue().at);
        return (
          <div
            class={styles.originSlot}
            classList={{
              [styles.dying]: true,
              [styles.dyingPawn]: pawnDeath(),
              [styles.dyingDrama]: mineDeath() || (!pawnDeath() && !kingDeath()),
              [styles.dyingKing]: kingDeath(),
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
                  <div class={styles.mineFragRing} />
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
