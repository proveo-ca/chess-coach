// SPEC: _spec/apps/starchess/architecture/p2-composite-vfx-stack.puml
/**
 * Composite combat VFX stack — stable layer order (never per-layer Show).
 */
import type { Component } from "solid-js";
import type { Square } from "chess.js";

import { AttackAnimation } from "~/presentation/animations/components/AttackAnimation";
import { DeathAnimation } from "~/presentation/animations/components/DeathAnimation";
import { DeployAnimation } from "~/presentation/animations/components/DeployAnimation";
import { GasDropAnimation } from "~/presentation/animations/components/GasDropAnimation";
import { MoveAnimation } from "~/presentation/animations/components/MoveAnimation";
import { MineMissileAnimation } from "~/presentation/animations/components/MineMissileAnimation";
import { QueenJumpAnimation } from "~/presentation/animations/components/QueenJumpAnimation";
import { KingDamageOverlay } from "~/presentation/animations/components/kingDamageOverlay";
import type { CombatCueFrame } from "~/presentation/animations/combatCueFrame";
import type {
  AttackCue,
  DeathCue,
  DeployCue,
  GasDropCue,
  KingDamageCue,
  MineMissileCue,
  MoveCue,
  QueenJumpTrail,
} from "~/presentation/types";
import type { PieceSet } from "~/types/board";

const NO_ATTACKS: AttackCue[] = [];
const NO_DEATHS: DeathCue[] = [];
const NO_MOVES: MoveCue[] = [];
const NO_DEPLOYS: DeployCue[] = [];
const NO_KING_DAMAGE: KingDamageCue[] = [];
const NO_JUMP_TRAILS: QueenJumpTrail[] = [];
const NO_GAS_DROPS: GasDropCue[] = [];
const NO_MINE_MISSILES: MineMissileCue[] = [];
const NO_MOVE_PROGRESS: Record<string, 0 | 1> = {};

export type CombatOverlayRootProps = {
  box: { top: number; left: number; w: number; h: number };
  cues: CombatCueFrame;
  specialUsedSquares: ReadonlySet<Square>;
  pieceSet?: PieceSet;
};

export const CombatOverlayRoot: Component<CombatOverlayRootProps> = (props) => {
  const c = () => props.cues;
  const w = () => props.box.w;
  const h = () => props.box.h;

  return (
    <div
      data-starchess-combat-root
      style={{
        position: "absolute",
        top: `${props.box.top}px`,
        left: `${props.box.left}px`,
        width: `${props.box.w}px`,
        height: `${props.box.h}px`,
        "pointer-events": "none",
        "z-index": "30",
        overflow: "visible",
        contain: "layout",
      }}
      aria-hidden
    >
      {/* Stable layer stack — do not wrap each in Show (remounts restart CSS). */}
      <KingDamageOverlay
        cues={c().kingDamage ?? NO_KING_DAMAGE}
        boardWidth={w()}
        boardHeight={h()}
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
        cues={c().moveCues ?? NO_MOVES}
        progress={c().moveProgress ?? NO_MOVE_PROGRESS}
        leg={c().moveLeg}
        specialUsedSquares={props.specialUsedSquares}
        pieceSet={props.pieceSet}
        boardWidth={w()}
        boardHeight={h()}
      />
      <QueenJumpAnimation
        cues={(c().jumpCues as MoveCue[] | undefined) ?? NO_MOVES}
        trails={(c().jumpTrails as QueenJumpTrail[] | undefined) ?? NO_JUMP_TRAILS}
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
