import type { PieceSymbol } from "chess.js";

export type SpecialCopy = {
  unit: string;
  name: string;
  description: string;
  /** True when dropping gas on this unit commits a special (story: knight / king). */
  deployable: boolean;
  /** Vespene canisters required to arm (default = SPECIAL_ENERGY_COST). */
  gasCost?: number;
};

const BY_TYPE: Record<PieceSymbol, SpecialCopy> = {
  p: {
    unit: "Marine",
    name: "Extra Step",
    description:
      "Gas moves 1 extra square forward. Start-rank classical doubles are free (no gas).",
    deployable: true,
  },
  n: {
    unit: "Hoverbike",
    name: "Spider Mine",
    description: "Spawns a mine that explodes on collision.",
    deployable: true,
  },
  b: {
    unit: "Mecha",
    name: "Charon Booster Missiles",
    description:
      "Arm for 2 gas, then click the revealed enemy queen on a diagonal — twin homing missiles ignore blockers.",
    deployable: true,
    gasCost: 2,
  },
  r: {
    unit: "Tank",
    name: "Siege Mode",
    description: "Toggle packed tank ↔ unpacked siege (vision and mobility).",
    deployable: true,
  },
  q: {
    unit: "BattleShip",
    name: "Tactical Jump",
    description:
      "Arm for 3 gas, then click a visible empty square — teleport through blockers and ignore attacks on the queen.",
    deployable: true,
    gasCost: 3,
  },
  k: {
    unit: "Command Center",
    name: "Deploy",
    description: "Purchase and deploy a unit adjacent to the command center.",
    deployable: true,
  },
};

/** Hover / drop copy for StarChess specials. */
export const specialCopyFor = (type: PieceSymbol): SpecialCopy => BY_TYPE[type];
