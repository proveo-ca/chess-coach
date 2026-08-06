/**
 * Storybook board/SCFEN fixtures — captions + seeds only.
 * DualNav packages live under `demos/`; stories mount them without logic.
 */
import type { BoardVariant } from "~/presentation/board/EclipseBoard";
import {
  COMBAT_CHAIN_START_SCFEN,
  GAS_USED_FOG_SCFEN,
  NERD_STARTING_SCFEN,
} from "~/stories/fixtures/seeds";
import { FOG_SIEGE_ROOK_SCFEN } from "~/presentation/animations/FogVisionDemo";

/** Static open board (no fog) — Combat Chain start placement. */
export const OPEN_BOARD_FIXTURE = {
  scfen: COMBAT_CHAIN_START_SCFEN,
  fog: false as const,
  visionMode: "observer" as const,
};

/** Enemy knight spent gas — player fog pierce sample. */
export const GAS_USED_FOG_FIXTURE = {
  scfen: GAS_USED_FOG_SCFEN,
  fog: true as const,
  visionMode: "player" as const,
  caption: "Gas-used · Ne5 spent gas · visible through fog (green ring)",
};

export const mapFixture = (boardVariant: BoardVariant) => ({
  scfen: NERD_STARTING_SCFEN,
  fog: false as const,
  visionMode: "observer" as const,
  boardVariant,
});

/** Siege rook vision sample — caption with the fixture, not the story. */
export const FOG_SIEGE_ROOK_FIXTURE = {
  scfen: FOG_SIEGE_ROOK_SCFEN,
  rookMode: "siege" as const,
  caption: "Siege · SCFEN Rd4 · 9×9 vision, immobile (vision sample)",
};
