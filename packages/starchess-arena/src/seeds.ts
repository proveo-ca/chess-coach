/**
 * Arena opening corpus — SCFEN map seeds.
 *
 * Seed provenance: starts from the web app's canonical opening
 * (`apps/starchess/src/app/seeds.ts`, STAR_STARTING_SCFEN) so arena results
 * compare 1:1 with human games from the same board. First slice ships the
 * canonical seed alone; the curated corpus extends from here (`--seeds N`
 * winds through these deterministically — the engine/scripts carry no RNG).
 *
 * Ranks are 8→1; `0` = opening turn; `33` Command Center lives; `P` planning phase;
 * `B:` stored minerals; `Q:` empty queue.
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml
 */

export const STAR_STARTING_SCFEN =
  "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";

export const ARENA_SEEDS: string[] = [STAR_STARTING_SCFEN];

/** Deterministic cycling through {@link ARENA_SEEDS}. */
export const seedForIndex = (index: number): string =>
  ARENA_SEEDS[index % ARENA_SEEDS.length]!;