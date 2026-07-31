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

import { squareBoxStyle } from "~/broodwar/animations/boardGeom";
import styles from "~/broodwar/animations/kingDamageOverlay.module.css";
import { HIT_BOOM_MS } from "~/broodwar/animations/kingDamage";
import { DeathKing } from "~/broodwar/animations/pieces/DeathKing";
import { MOVE_MS } from "~/broodwar/constants";
import type { KingDamageCue, KingDamageState } from "~/types/broodwar";

export type { KingDamageCue };

export type KingDamageOverlayProps = {
  cues: KingDamageCue[];
  boardWidth: number;
  boardHeight: number;
};

type SlotProps = {
  id: string;
  at: Square;
  damage: KingDamageState;
  seed?: number;
  impactSeq?: number;
  boardWidth: number;
  boardHeight: number;
};

const isFire = (d: KingDamageState) => d === "smallFire" || d === "bigFire";

/**
 * One king hull: boom only on `impactSeq` bumps (real hits). BWFEN restores
 * mount with fire already lit and seq unchanged — no explosion.
 */
const KingDamageSlot = (props: SlotProps) => {
  // Always start on fire/rubble — never boom on mount from a planning snap.
  const [phase, setPhase] = createSignal<"boom" | "fire">("fire");
  let boomTimer = 0;

  const playBoom = () => {
    window.clearTimeout(boomTimer);
    setPhase("boom");
    boomTimer = window.setTimeout(() => setPhase("fire"), HIT_BOOM_MS);
  };

  createEffect((prevSeq: number | undefined) => {
    const seq = props.impactSeq ?? 0;
    const d = props.damage;
    if (!isFire(d)) {
      setPhase("fire");
      return seq;
    }
    // Hit: seq increased (including mount with seq>0 right after a chip).
    if (prevSeq === undefined) {
      if (seq > 0) playBoom();
      else setPhase("fire");
    } else if (seq > prevSeq) {
      playBoom();
    }
    return seq;
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
    >
      <div class={styles.pieceFace}>
        <DeathKing damage={props.damage} seed={props.seed} />
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
 * Fire is restored quietly from BWFEN; boom requires `impactSeq` from a shot.
 * Keys by `id` so a flee (`at` change) does not remount.
 */
export function KingDamageOverlay(props: KingDamageOverlayProps): JSX.Element {
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
      data-broodwar-king-damage-layer
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
            />
          );
        }}
      </For>
    </div>
  );
}
