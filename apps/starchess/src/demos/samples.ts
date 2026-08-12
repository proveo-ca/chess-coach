// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml, _spec/apps/starchess/demos.puml
/**
 * Demo-only board samples — seeds that no shipped route uses.
 * Storybook projects these; it does not own them. Tutorial lesson boards live
 * on `TutorialStoryScript.board` (`tutorial/tutorialScript.ts`), product
 * positions in `app/seeds.ts`.
 */
import { GAS_USED_FOG_SCFEN, STAR_STARTING_SCFEN } from "~/app/seeds";
import { COMBAT_CHAIN_START_SCFEN } from "~/demos/combatChain";
import type { BoardVariant } from "~/types/board";
import type { LiveLessonBoard } from "~/types/tutorial";

/** Static open board (no fog) — Combat Chain start placement. */
export const OPEN_BOARD_SAMPLE = {
  scfen: COMBAT_CHAIN_START_SCFEN,
  fog: false as const,
  visionMode: "observer" as const,
};

/** Enemy knight spent gas — stays fogged (U: is not a vision pierce). */
export const GAS_USED_FOG_SAMPLE = {
  scfen: GAS_USED_FOG_SCFEN,
  fog: true as const,
  visionMode: "player" as const,
  caption: "Gas-used · Ne5 spent gas · stays fogged (no pierce / no green leak)",
};

export const mapSample = (boardVariant: BoardVariant) => ({
  scfen: STAR_STARTING_SCFEN,
  fog: false as const,
  visionMode: "observer" as const,
  boardVariant,
});

/** Full army + GasDeploy — turn-chrome / gas-rack sample, not a lesson. */
export const FULL_ARMY_SAMPLE: LiveLessonBoard = {
  scfen:
    "SCFEN|rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR|21|33|P|G:33:33|Q:w:;b:",
  stored: 12,
  armTimer: false,
};

/** Vermeer terrain, classic 1K+4P opening vs the adjutant — Storybook only. */
export const VERMEER_LIVE_SAMPLE: LiveLessonBoard = {
  scfen: STAR_STARTING_SCFEN,
  stored: 1,
  opponent: "adjutant",
};
