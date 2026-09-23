/** A live achievement lifting off its birth square. */
export type AchievementBubble = {
  id: string;
  shortId: string;
  level: 1 | 2 | 3 | 4 | 5;
  /** Birth square the bubble lifts off. */
  origin: string;
  icon: string;
};
