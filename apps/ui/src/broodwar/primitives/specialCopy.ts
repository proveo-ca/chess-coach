import type { PieceSymbol } from "chess.js";

export type SpecialCopy = {
  unit: string;
  name: string;
  description: string;
  /** True when dropping gas on this unit commits a special (story: knight / king). */
  deployable: boolean;
};

const TBD: Omit<SpecialCopy, "unit"> = {
  name: "TBD",
  description: "Coming soon.",
  deployable: false,
};

const BY_TYPE: Record<PieceSymbol, SpecialCopy> = {
  p: { unit: "Marine", ...TBD },
  n: {
    unit: "Vulture",
    name: "Spider Mine",
    description: "Spawns a mine that explodes on collision.",
    deployable: true,
  },
  b: { unit: "Goliath", ...TBD },
  r: { unit: "Tank", ...TBD },
  q: { unit: "Battlecruiser", ...TBD },
  k: {
    unit: "Command Center",
    name: "Deploy",
    description: "Purchase and deploy a unit adjacent to the command center.",
    deployable: true,
  },
};

/** Hover / drop copy for Brood War specials. */
export const specialCopyFor = (type: PieceSymbol): SpecialCopy => BY_TYPE[type];
