// SPEC: _spec/apps/starchess/architecture/composite-vfx-stack.puml, _spec/apps/starchess/architecture/board-entities.puml
/**
 * Parameter object — combat VFX cues for AnimationStage / CombatOverlayRoot.
 */
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

export type CombatCueFrame = {
  attackCues?: readonly AttackCue[];
  attackDying?: Record<string, boolean>;
  deathCues?: readonly DeathCue[];
  moveCues?: readonly MoveCue[];
  moveProgress?: Readonly<Record<string, 0 | 1>>;
  moveLeg?: Record<string, 0 | 1>;
  jumpCues?: readonly MoveCue[];
  jumpTrails?: readonly QueenJumpTrail[];
  mineMissiles?: readonly MineMissileCue[];
  mineMissileTrails?: readonly QueenJumpTrail[];
  deployCues?: readonly DeployCue[];
  gasDropCues?: readonly GasDropCue[];
  kingDamage?: readonly KingDamageCue[];
};

export const EMPTY_COMBAT_CUE_FRAME: CombatCueFrame = {};
