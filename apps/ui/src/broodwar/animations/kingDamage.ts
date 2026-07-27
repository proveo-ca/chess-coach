import type { KingDamageState } from "~/broodwar/types";

/** Map remaining king lives (0–3) to the visual damage state. */
export const kingDamageStateForLives = (lives: number): KingDamageState => {
  if (lives >= 3) return "pristine";
  if (lives === 2) return "smallFire";
  if (lives === 1) return "bigFire";
  return "destroyed";
};
