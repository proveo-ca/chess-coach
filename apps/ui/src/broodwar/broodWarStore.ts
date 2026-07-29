import { createSignal } from "solid-js";

import {
  KING_MAX_LIVES,
  MAX_DEPLOYED_MATERIAL,
  MAX_STORED_MATERIAL,
  TURN_TIMEOUT_MS,
  incomeForTurn,
} from "~/broodwar/constants";
import type { BroodWarColor, PlayerEconomy } from "~/broodwar/types";
import { activePlayerColor } from "~/store/settingsStore";

type Economies = Record<BroodWarColor, PlayerEconomy>;
type KingLives = Record<BroodWarColor, number>;

const defaultEconomies = (): Economies => ({
  w: { stored: 0, deployed: 0 },
  b: { stored: 0, deployed: 0 },
});

const defaultKingLives = (): KingLives => ({
  w: KING_MAX_LIVES,
  b: KING_MAX_LIVES,
});

const clampLives = (n: number) => Math.max(0, Math.min(KING_MAX_LIVES, Math.floor(n)));

const [_turn, _setTurn] = createSignal(1);
const [_economies, _setEconomies] = createSignal<Economies>(defaultEconomies());
/** Per-side king HP (0–3). Engine/game state — VFX maps via kingDamageStateForLives. */
const [_kingLives, _setKingLives] = createSignal<KingLives>(defaultKingLives());
/** Epoch ms when the current planning window ends; null = not running. */
const [_deadlineAt, _setDeadlineAt] = createSignal<number | null>(null);

/** Current Brood War turn index (1-based; drives income tier). */
export const broodWarTurn = () => _turn();
export const setBroodWarTurn = (turn: number) => _setTurn(Math.max(1, turn));

export const broodWarEconomies = () => _economies();

/** Both sides’ king HP (0–3). Source of truth for damage VFX / BWFEN lives. */
export const kingLives = () => _kingLives();
export const kingLivesFor = (color: BroodWarColor) => _kingLives()[color];

export const setKingLives = (next: KingLives) => {
  _setKingLives({ w: clampLives(next.w), b: clampLives(next.b) });
};

export const setKingLivesFor = (color: BroodWarColor, lives: number) => {
  _setKingLives((prev) => ({ ...prev, [color]: clampLives(lives) }));
};

/** Successful king-shot: decrement one life. Returns remaining HP. */
export const chipKingLife = (color: BroodWarColor): number => {
  let remaining = 0;
  _setKingLives((prev) => {
    remaining = clampLives(prev[color] - 1);
    return { ...prev, [color]: remaining };
  });
  return remaining;
};

/** Local / active player's stored material (0..12). */
export const storedMaterial = () => _economies()[activePlayerColor()].stored;

/** Local / active player's deployed supply. */
export const deployedSupply = () => _economies()[activePlayerColor()].deployed;

/**
 * Base material income for the upcoming turn (rules §4).
 * Idle 1.5× bonus is applied at resolve time — ResourceBar shows the base rate.
 */
export const materialIncome = () => incomeForTurn(_turn());

/** Static deploy cap — only constant ResourceBar shows. */
export const maxDeployedSupply = MAX_DEPLOYED_MATERIAL;

export const turnDeadlineAt = () => _deadlineAt();

/** Whole seconds left on the planning timer (0 when expired / idle). */
export const turnSecondsRemaining = () => {
  const deadline = _deadlineAt();
  if (deadline == null) return Math.round(TURN_TIMEOUT_MS / 1000);
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
};

export const startPlanningTimer = (durationMs: number = TURN_TIMEOUT_MS) => {
  _setDeadlineAt(Date.now() + durationMs);
};

export const clearTurnDeadline = () => _setDeadlineAt(null);

export const setPlayerEconomy = (color: BroodWarColor, economy: PlayerEconomy) => {
  _setEconomies((prev) => ({
    ...prev,
    [color]: {
      stored: Math.min(MAX_STORED_MATERIAL, Math.max(0, economy.stored)),
      deployed: Math.min(MAX_DEPLOYED_MATERIAL, Math.max(0, economy.deployed)),
    },
  }));
};

export const spendStored = (color: BroodWarColor, amount: number): boolean => {
  const eco = _economies()[color];
  if (amount <= 0 || eco.stored < amount) return false;
  setPlayerEconomy(color, { stored: eco.stored - amount, deployed: eco.deployed });
  return true;
};

export const refundStored = (color: BroodWarColor, amount: number) => {
  const eco = _economies()[color];
  setPlayerEconomy(color, { stored: eco.stored + Math.max(0, amount), deployed: eco.deployed });
};

export const addDeployed = (color: BroodWarColor, amount = 1): boolean => {
  const eco = _economies()[color];
  if (amount <= 0) return false;
  if (eco.deployed + amount > MAX_DEPLOYED_MATERIAL) return false;
  setPlayerEconomy(color, { stored: eco.stored, deployed: eco.deployed + amount });
  return true;
};

export const removeDeployed = (color: BroodWarColor, amount = 1) => {
  const eco = _economies()[color];
  setPlayerEconomy(color, {
    stored: eco.stored,
    deployed: Math.max(0, eco.deployed - Math.max(0, amount)),
  });
};

/** Storybook / new-game seed for the active side (and optional opponent). */
export const resetBroodWarEconomy = (opts?: {
  turn?: number;
  white?: PlayerEconomy;
  black?: PlayerEconomy;
  kingLives?: KingLives;
  /** When true (default), start a fresh planning timer. */
  startTimer?: boolean;
}) => {
  _setTurn(opts?.turn ?? 1);
  _setEconomies({
    w: opts?.white ?? { stored: 0, deployed: 0 },
    b: opts?.black ?? { stored: 0, deployed: 0 },
  });
  _setKingLives(opts?.kingLives ?? defaultKingLives());
  if (opts?.startTimer === false) {
    clearTurnDeadline();
  } else {
    startPlanningTimer();
  }
};
