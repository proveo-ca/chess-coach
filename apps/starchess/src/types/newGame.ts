import type { StarChessColor } from "@chess-coach/starchess-core";

import type { BoardVariant } from "~/types/board";

/** Confirmed Single Player setup (map + team). */
export type NewGameOptions = {
  map: BoardVariant;
  team: StarChessColor;
};
