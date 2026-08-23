// SPEC: _spec/apps/starchess/core/turn/turn-bonus-broadcast.puml
import {
  energyForTurn,
  incomeForTurn,
  turnTimeoutMsForTurn,
} from "@chess-coach/starchess-core";

import type { TurnBonus } from "~/types/match";

export const TURN_BONUS_BROADCAST_MS = 3000;

/** HUD numbering — the engine's raw counter starts at 0. */
const displayedTurn = (turn: number): number => Math.max(1, turn);

export const isMilestoneTurn = (turn: number): boolean =>
  Number.isInteger(turn) && turn >= 0 && (displayedTurn(turn) - 1) % 10 === 0;

export const turnBonusFor = (turn: number): TurnBonus | null => {
  const shown = displayedTurn(turn);
  if (!isMilestoneTurn(turn)) return null;
  return {
    turn: shown,
    minerals: incomeForTurn(shown),
    gas: energyForTurn(shown),
    seconds: Math.round(turnTimeoutMsForTurn(shown) / 1000),
  };
};
