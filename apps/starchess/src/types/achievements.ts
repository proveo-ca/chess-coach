/** A live achievement rising off the achieving unit. */
export type AchievementBubble = {
  id: string;
  shortId: string;
  level: 1 | 2 | 3 | 4 | 5;
  /** Square the bubble rises from: where the achieving unit stands after the ply. */
  origin: string;
  icon: string;
  /** Who earned it. The player's are granted; the opponent's only show. */
  side: "w" | "b";
};
