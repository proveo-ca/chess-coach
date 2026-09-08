import type { StarChessColor } from "@chess-coach/starchess-core";

import type { BoardVariant } from "~/types/board";

/** Which Adjutant script plays the opponent. */
export type AdjutantKind = "naive" | "strategic";

export const ADJUTANT_KINDS: readonly AdjutantKind[] = ["naive", "strategic"];

export const isAdjutantKind = (v: unknown): v is AdjutantKind =>
  ADJUTANT_KINDS.includes(v as AdjutantKind);

/** Confirmed Single Player setup (map + team + opponent script). */
export type NewGameOptions = {
  map: BoardVariant;
  team: StarChessColor;
  opponent: AdjutantKind;
};
