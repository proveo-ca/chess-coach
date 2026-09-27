// SPEC: _spec/apps/starchess/architecture/composite-vfx-stack.puml, _spec/apps/starchess/architecture/timeline-perf.puml, _spec/apps/starchess/architecture/board-entities.puml, _spec/apps/starchess/architecture/reactivity/presentation.md, _spec/apps/starchess/board-rendering.puml
/**
 * Composite combat VFX stack — stable layer order (never per-layer Show).
 */
import { createMemo, type Component } from "solid-js";
import type { Square } from "chess.js";

import { AttackAnimation } from "~/presentation/animations/components/AttackAnimation";
import { DeathAnimation } from "~/presentation/animations/components/DeathAnimation";
import { DeployAnimation } from "~/presentation/animations/components/DeployAnimation";
import { GasDropAnimation } from "~/presentation/animations/components/GasDropAnimation";
import { MoveAnimation } from "~/presentation/animations/components/MoveAnimation";
import { MineMissileAnimation } from "~/presentation/animations/components/MineMissileAnimation";
import { ShipJumpAnimation } from "~/presentation/animations/components/ShipJumpAnimation";
import { CCDamageOverlay } from "~/presentation/animations/components/ccDamageOverlay";
import type { CombatCueFrame } from "~/presentation/animations/combatCueFrame";
import {
  overlayDevicePixelRatio,
  overlayRootPerfStyle,
} from "~/presentation/animations/vfxPerf";
import type {
  AttackCue,
  DeathCue,
  DeployCue,
  GasDropCue,
  CCDamageCue,
  MineMissileCue,
  MoveCue,
  ShipJumpTrail,
} from "~/presentation/types";
import type { PieceSet } from "~/types/board";
import { sameList } from "~/presentation/board/memoEquals";

const NO_ATTACKS: AttackCue[] = [];
const NO_DEATHS: DeathCue[] = [];
const NO_MOVES: MoveCue[] = [];
const NO_DEPLOYS: DeployCue[] = [];
const NO_CC_DAMAGE: CCDamageCue[] = [];
const NO_JUMP_TRAILS: ShipJumpTrail[] = [];
const NO_GAS_DROPS: GasDropCue[] = [];
const NO_MINE_MISSILES: MineMissileCue[] = [];
const NO_MOVE_PROGRESS: Record<string, 0 | 1> = {};
const NO_VEIL_IDS: ReadonlySet<string> = new Set();

export type CombatOverlayRootProps = {
  box: { top: number; left: number; w: number; h: number };
  cues: CombatCueFrame;
  specialUsedSquares: ReadonlySet<Square>;
  charonSquares?: ReadonlySet<Square>;
  pieceSet?: PieceSet;
};

export const CombatOverlayRoot: Component<CombatOverlayRootProps> = (props) => {
  const c = () => props.cues;
  const w = () => props.box.w;
  const h = () => props.box.h;
  /** Enemy veil-reveal movers — hull suppressed (board renders them under fog). */
  const veilIds = () => c().veilMoveCueIds ?? NO_VEIL_IDS;
  const hullCues = createMemo(
    (): readonly MoveCue[] => {
      const all = c().moveCues ?? NO_MOVES;
      const ids = veilIds();
      return ids.size > 0 ? all.filter((m) => !ids.has(m.id)) : all;
    },
    undefined,
    { equals: sameList },
  );

  return (
    <div
      data-starchess-combat-root
      data-overlay-dpr={overlayDevicePixelRatio()}
      style={{
        position: "absolute",
        top: `${props.box.top}px`,
        left: `${props.box.left}px`,
        width: `${props.box.w}px`,
        height: `${props.box.h}px`,
        "pointer-events": "none",
        "z-index": "30",
        overflow: "visible",
        ...overlayRootPerfStyle(),
      }}
      aria-hidden
    >
      {/* Stable layer stack — do not wrap each in Show (remounts restart CSS). */}
      <CCDamageOverlay
        cues={c().ccDamage ?? NO_CC_DAMAGE}
        boardWidth={w()}
        boardHeight={h()}
        pieceSet={props.pieceSet}
      />
      <GasDropAnimation
        cues={c().gasDropCues ?? NO_GAS_DROPS}
        boardWidth={w()}
        boardHeight={h()}
      />
      <AttackAnimation
        cues={c().attackCues ?? NO_ATTACKS}
        dyingIds={c().attackDying}
        specialUsedSquares={props.specialUsedSquares}
        charonSquares={props.charonSquares}
        boardWidth={w()}
        boardHeight={h()}
      />
      <DeathAnimation
        cues={c().deathCues ?? NO_DEATHS}
        specialUsedSquares={props.specialUsedSquares}
        boardWidth={w()}
        boardHeight={h()}
      />
      <MoveAnimation
        cues={hullCues()}
        progress={c().moveProgress ?? NO_MOVE_PROGRESS}
        leg={c().moveLeg}
        specialUsedSquares={props.specialUsedSquares}
        charonSquares={props.charonSquares}
        pieceSet={props.pieceSet}
        boardWidth={w()}
        boardHeight={h()}
      />
      <ShipJumpAnimation
        cues={(c().jumpCues as MoveCue[] | undefined) ?? NO_MOVES}
        trails={(c().jumpTrails as ShipJumpTrail[] | undefined) ?? NO_JUMP_TRAILS}
        boardWidth={w()}
        boardHeight={h()}
      />
      <MineMissileAnimation
        cues={c().mineMissiles ?? NO_MINE_MISSILES}
        trails={c().mineMissileTrails ?? NO_JUMP_TRAILS}
        boardWidth={w()}
        boardHeight={h()}
      />
      <DeployAnimation
        cues={c().deployCues ?? NO_DEPLOYS}
        specialUsedSquares={props.specialUsedSquares}
        boardWidth={w()}
        boardHeight={h()}
      />
    </div>
  );
};
