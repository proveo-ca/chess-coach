// SPEC: _spec/_plans/starchess-achievements.puml, _spec/apps/starchess/architecture/layers.puml
import { createContext, useContext, type Accessor } from "solid-js";

import type { AchievementBubble } from "~/types/achievements";

const NO_BUBBLES: readonly AchievementBubble[] = [];

const AchievementBubblesContext = createContext<Accessor<readonly AchievementBubble[]>>(() => NO_BUBBLES);

/** A match host hands the board the bubbles to paint; boards without a host paint none. */
export const AchievementBubblesProvider = AchievementBubblesContext.Provider;

export const useAchievementBubbles = (): Accessor<readonly AchievementBubble[]> =>
  useContext(AchievementBubblesContext);
