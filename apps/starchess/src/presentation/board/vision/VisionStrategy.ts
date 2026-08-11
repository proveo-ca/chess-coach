// SPEC: _spec/apps/starchess/architecture/p1-strategy-starchess-board.puml
/**
 * Vision presentation strategy — player fog veil vs observer dual borders.
 * Selection only; fog math stays in fogProjection / StarChessBoard.
 */
import type { VisionMode } from "~/types/board";

export type VisionStrategy = {
  readonly id: VisionMode;
  /** Player fog veil when true (observer always false). */
  usePlayerFog(fog: boolean | undefined): boolean;
  readonly isObserver: boolean;
};

export const PlayerFogStrategy: VisionStrategy = {
  id: "player",
  usePlayerFog: (fog) => fog !== false,
  isObserver: false,
};

export const ObserverDualVisionStrategy: VisionStrategy = {
  id: "observer",
  usePlayerFog: () => false,
  isObserver: true,
};

export const visionStrategyFor = (mode: VisionMode | undefined): VisionStrategy =>
  mode === "observer" ? ObserverDualVisionStrategy : PlayerFogStrategy;
