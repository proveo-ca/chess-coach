import type { ArenaGameRecord } from "@chess-coach/starchess-core";

export type ArenaListItem = {
  id: string;
  players: { w: string; b: string };
  mapSeed: string;
  outcome: ArenaGameRecord["outcome"];
  turns: number;
};
