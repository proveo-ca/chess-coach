import type { ScMine, StarChessColor } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type {
  AttackCue,
  DeathCue,
  DeployCue,
  CCDamageCue,
  MineMissileCue,
  MoveCue,
  ShipJumpTrail,
} from "~/types/cues";

export type ChasingMineCue = { at: Square; legMs: number[] };

export type CombatCommit = {
  placement: string;
  ccLives: Record<StarChessColor, number>;
  phase: "A" | "M" | "P" | "O";
  mines: readonly ScMine[];
};

export type CombatFxState = {
  attackCues: AttackCue[];
  attackDying: Record<string, boolean>;
  deathCues: DeathCue[];
  moveCues: MoveCue[];
  moveProgress: Record<string, 0 | 1>;
  moveLeg: Record<string, 0 | 1>;
  deployCues: DeployCue[];
  ccDamage: CCDamageCue[];
  chasingMines: ChasingMineCue[];
  mineMissiles: MineMissileCue[];
  mineMissileTrails: ShipJumpTrail[];
  spentMines: Square[];
};

export type PlayResolveOptions = {
  /** Board before this resolve (for damaged-Command Center overlay seeding). */
  startPlacement: string;
  /** Apply mid / final board snapshots (classic placement + lives). */
  commit: (snap: CombatCommit) => void;
  /** Starting lives (before this resolve’s Command Center-shots). */
  livesBefore: Record<StarChessColor, number>;
  /** Viewer for fog-gated mover hulls. Omit → show all move hulls. */
  viewer?: StarChessColor;
  /** Post-B siege flags for mover fog parity. */
  siegedTanks?: readonly Square[];
  onDone?: () => void;
};

export type PlayResolveHandle = {
  cancel: () => void;
};
