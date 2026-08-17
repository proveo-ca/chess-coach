// SPEC: _spec/apps/starchess/architecture/board-entities.puml
import type { Square } from "chess.js";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";

import { squareBoxStyle } from "~/presentation/animations/boardGeom";
import styles from "~/presentation/animations/components/kingDamageOverlay.module.css";
import { HIT_BOOM_MS } from "~/presentation/animations/kingDamage";
import { DeathKing } from "~/presentation/animations/pieces/components/DeathKing";
import { pieceUrl } from "~/presentation/board/pieceUrl";
import { MOVE_MS } from "~/presentation/constants";
import type { KingDamageCue, KingDamageState } from "~/presentation/types";
import type { PieceSet } from "~/types/board";

export type { KingDamageCue };

export type KingDamageOverlayProps = {
  cues: readonly KingDamageCue[];
  boardWidth: number;
  boardHeight: number;
  /**
   * `cburnett` = fog tutorial Chess skin only (see TutorialScreen). Presentation
   * prop — HP still comes from `kingLives`, the skin only picks the glyph.
   */
  pieceSet?: PieceSet;
};

type SlotProps = {
  id: string;
  at: Square;
  damage: KingDamageState;
  seed?: number;
  impactSeq?: number;
  boardWidth: number;
  boardHeight: number;
  pieceSet?: PieceSet;
  /** Shared across remounts so filtering fire off/on does not re-boom. */
  lastPlayedBoomSeq: Map<string, number>;
};

const isFire = (d: KingDamageState) => d === "smallFire" || d === "bigFire";

/**
 * Chess skin has no burning Command Center to draw — same flattening the rook
 * glyph does for tank/siege, so a damaged CC reads as the classic King.
 * Only the fire states (HP 1–2); `destroyed` keeps the StarChess rubble, which
 * is a death animation rather than a piece.
 */
const isChessKing = (props: SlotProps) =>
  props.pieceSet === "cburnett" && isFire(props.damage);

/**
 * One king hull: boom only when `impactSeq` advances past the last played hit
 * for this side. Remounts (attack ownership hide/show, flee) stay quiet.
 */
const KingDamageSlot = (props: SlotProps) => {
  const [phase, setPhase] = createSignal<"boom" | "fire">("fire");
  let boomTimer = 0;

  const playBoom = () => {
    window.clearTimeout(boomTimer);
    setPhase("boom");
    boomTimer = window.setTimeout(() => setPhase("fire"), HIT_BOOM_MS);
  };

  createEffect(() => {
    const seq = props.impactSeq ?? 0;
    const d = props.damage;
    if (!isFire(d) && d !== "destroyed") {
      setPhase("fire");
      return;
    }
    const last = props.lastPlayedBoomSeq.get(props.id) ?? 0;
    if (seq > last) {
      props.lastPlayedBoomSeq.set(props.id, seq);
      playBoom();
    } else {
      setPhase("fire");
    }
  });

  onCleanup(() => window.clearTimeout(boomTimer));

  const box = () => squareBoxStyle(props.at, props.boardWidth, props.boardHeight);

  return (
    <div
      class={`${styles.originSlot} ${styles.kingDamageSlot}`}
      style={box()}
      data-square={props.at}
      data-king-damage={props.damage}
      data-king-hit-phase={phase()}
      data-king-id={props.id}
      data-king-impact-seq={props.impactSeq ?? 0}
      data-king-glyph={isChessKing(props) ? "cburnett" : "nerd"}
    >
      <div class={styles.pieceFace}>
        <Show
          when={isChessKing(props)}
          fallback={
            <DeathKing
              damage={props.damage}
              seed={props.seed}
              color={props.id === "b" ? "b" : "w"}
            />
          }
        >
          <img
            class={styles.chessKing}
            src={pieceUrl(props.id === "b" ? "b" : "w", "k", "cburnett")}
            alt=""
            draggable={false}
          />
        </Show>
      </div>
      <Show when={phase() === "boom"}>
        <div
          class={styles.kingHitBoom}
          style={{ "--hit-boom-ms": `${HIT_BOOM_MS}ms` }}
          aria-hidden="true"
        >
          <div class={styles.boomFlash} />
          <div class={styles.boomRing} />
        </div>
      </Show>
    </div>
  );
};

/**
 * Persistent king HP presentation (pristine is a no-op — board `<img>` stays).
 * Boom requires an `impactSeq` increase from an HP chip — not fire remounts.
 * Keys by `id` (side color) so a flee (`at` change) does not remount.
 */
export const KingDamageOverlay = (props: KingDamageOverlayProps): JSX.Element => {
  const lastPlayedBoomSeq = new Map<string, number>();
  const slots = createMemo(() => props.cues.filter((c) => c.damage !== "pristine"));
  const ids = createMemo(() => slots().map((c) => c.id));
  const byId = createMemo(() => {
    const m = new Map<string, KingDamageCue>();
    for (const c of slots()) m.set(c.id, c);
    return m;
  });

  return (
    <div
      class={styles.boardOverlay}
      data-starchess-king-damage-layer
      style={{
        inset: "0",
        "--hit-boom-ms": `${HIT_BOOM_MS}ms`,
        "--move-ms": `${MOVE_MS}ms`,
      }}
    >
      <For each={ids()}>
        {(id) => {
          const cue = () => byId().get(id)!;
          return (
            <KingDamageSlot
              id={id}
              at={cue().at}
              damage={cue().damage}
              seed={cue().seed}
              impactSeq={cue().impactSeq}
              boardWidth={props.boardWidth}
              boardHeight={props.boardHeight}
              pieceSet={props.pieceSet}
              lastPlayedBoomSeq={lastPlayedBoomSeq}
            />
          );
        }}
      </For>
    </div>
  );
};
