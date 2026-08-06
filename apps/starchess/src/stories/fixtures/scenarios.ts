/**
 * Storybook board/SCFEN fixtures — captions + seeds only.
 * DualNav packages live under `demos/`; stories mount them without logic.
 */
import type { BoardVariant } from "~/types/board";
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

/** Enemy knight spent gas — player fog pierce sample (Fog of War / Board). */
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

/** GasDeploy special-move seeds — stories mount these only. */
export const GAS_DEPLOY_FIXTURES = {
  marine: {
    scfen: "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:11:11|Q:w:;b:",
    stored: 4,
  },
  commandCenter: {
    scfen: "SCFEN|r6k/8/8/8/3K4/8/8/7R|1|33|P|G:11:11|Q:w:;b:",
    stored: 12,
  },
  vulture: {
    scfen: "SCFEN|4k3/8/8/8/3N4/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    stored: 4,
  },
  goliath: {
    scfen: "SCFEN|k6q/8/4P3/4p3/3B4/8/8/K7|11|33|P|G:22:22|Q:w:;b:",
    stored: 4,
  },
  battlecruiser: {
    scfen: "SCFEN|7k/8/8/8/8/8/8/Q6K|11|33|P|G:22:22|Q:w:;b:",
    stored: 4,
  },
  siegeTank: {
    scfen: "SCFEN|7k/8/8/8/3R1R2/8/8/K7|11|33|P|G:22:22|Q:w:;b:|S:f4",
    stored: 12,
  },
  fullArmy: {
    scfen:
      "SCFEN|rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR|21|33|P|G:33:33|Q:w:;b:",
    stored: 12,
  },
} as const;
