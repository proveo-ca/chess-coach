// SPEC: _spec/apps/starchess/architecture/composite-vfx-stack.puml, _spec/apps/starchess/architecture/board-entities.puml
/**
 * Parameter object — combat VFX cues for AnimationStage / CombatOverlayRoot.
 */
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

export type CombatCueFrame = {
  attackCues?: readonly AttackCue[];
  attackDying?: Record<string, boolean>;
  deathCues?: readonly DeathCue[];
  moveCues?: readonly MoveCue[];
  moveProgress?: Readonly<Record<string, 0 | 1>>;
  moveLeg?: Record<string, 0 | 1>;
  /**
   * Enemy movers with a fogged origin whose path crosses the viewer's vision.
   * The board renders them *under* the fog veil (revealed tile-by-tile on lit
   * squares); CombatOverlayRoot suppresses their hulls so they never paint
   * above the veil.
   */
  veilMoveCueIds?: ReadonlySet<string>;
  jumpCues?: readonly MoveCue[];
  jumpTrails?: readonly ShipJumpTrail[];
  mineMissiles?: readonly MineMissileCue[];
  mineMissileTrails?: readonly ShipJumpTrail[];
  deployCues?: readonly DeployCue[];
  gasDropCues?: readonly GasDropCue[];
  ccDamage?: readonly CCDamageCue[];
};

export const EMPTY_COMBAT_CUE_FRAME: CombatCueFrame = {};
