// SPEC: _spec/packages/starchess-core/adjutant-definitions.puml
import type { PlayableAdjutantKind, StarChessColor } from "@chess-coach/starchess-core";

import type { BoardVariant } from "~/types/board";

export {
  ADJUTANT_DEFINITIONS,
  ADJUTANT_KINDS,
  isAdjutantKind,
  isPlayableAdjutantKind,
  type AdjutantKind,
  type PlayableAdjutantKind,
} from "@chess-coach/starchess-core";

/** Confirmed Single Player setup (map + team + opponent script). */
export type NewGameOptions = {
  map: BoardVariant;
  team: StarChessColor;
  opponent: PlayableAdjutantKind;
};
