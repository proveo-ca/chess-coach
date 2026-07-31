import { createSignal } from "solid-js";

import {
  KING_MAX_LIVES,
  MAX_DEPLOYED_MATERIAL,
  MAX_STORED_MATERIAL,
  SPECIAL_ENERGY_COST,
  TURN_TIMEOUT_MS,
  energyForTurn,
  incomeForTurn,
} from "~/broodwar/constants";
import type { BroodWarColor, PlayerEconomy } from "~/broodwar/types";
import { activePlayerColor } from "~/store/settingsStore";

type Economies = Record<BroodWarColor, PlayerEconomy>;
type KingLives = Record<BroodWarColor, number>;
type EnergyPool = Record<BroodWarColor, number>;

const defaultEconomies = (): Economies => ({
  w: { stored: 0, deployed: 0 },
  b: { stored: 0, deployed: 0 },
});

const defaultKingLives = (): KingLives => ({
  w: KING_MAX_LIVES,
  b: KING_MAX_LIVES,
});

const clampLives = (n: number) => Math.max(0, Math.min(KING_MAX_LIVES, Math.floor(n)));

const clampEnergy = (n: number, cap: number) => Math.max(0, Math.min(cap, Math.floor(n)));

const fullEnergyForTurn = (turn: number): EnergyPool => {
  const cap = energyForTurn(turn);
  return { w: cap, b: cap };
};

const [_turn, _setTurn] = createSignal(1);
const [_economies, _setEconomies] = createSignal<Economies>(defaultEconomies());
/** Per-side king HP (0–3). Engine/game state — VFX maps via kingDamageStateForLives. */
const [_kingLives, _setKingLives] = createSignal<KingLives>(defaultKingLives());
/** Remaining vespene this planning turn (0..energyForTurn). Does not bank. */
const [_energy, _setEnergy] = createSignal<EnergyPool>(fullEnergyForTurn(1));
/** Epoch ms when the current planning window ends; null = not running. */
const [_deadlineAt, _setDeadlineAt] = createSignal<number | null>(null);

/** Current Brood War turn index (1-based; drives income / energy tier). */
export const broodWarTurn = () => _turn();

export const setBroodWarTurn = (turn: number) => {
  const next = Math.max(1, turn);
  _setTurn(next);
  // Fresh gas each turn — leftover does not accumulate.
  _setEnergy(fullEnergyForTurn(next));
};

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

/** Local / active player's deployed supply (store counter — prefer board sum in UI). */
export const deployedSupply = () => _economies()[activePlayerColor()].deployed;

/**
 * Base material income for the upcoming turn (rules §4).
 * Idle 1.5× bonus is applied at resolve time — ResourceBar shows the base rate.
 */
export const materialIncome = () => incomeForTurn(_turn());

/** Vespene capacity for the current turn (ResourceBar denominator). */
export const energyCapacity = () => energyForTurn(_turn());

/** Remaining vespene for the local / active player this turn. */
export const energyRemaining = () => _energy()[activePlayerColor()];

export const energyRemainingFor = (color: BroodWarColor) => _energy()[color];

/** Static deploy cap — ResourceBar denominator. */
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

/** Burn vespene for a special. Default cost = `SPECIAL_ENERGY_COST` (1). */
export const spendEnergy = (
  color: BroodWarColor,
  amount: number = SPECIAL_ENERGY_COST,
): boolean => {
  if (amount <= 0) return false;
  const cap = energyForTurn(_turn());
  const have = _energy()[color];
  if (have < amount) return false;
  _setEnergy((prev) => ({ ...prev, [color]: clampEnergy(have - amount, cap) }));
  return true;
};

export const refundEnergy = (
  color: BroodWarColor,
  amount: number = SPECIAL_ENERGY_COST,
) => {
  if (amount <= 0) return;
  const cap = energyForTurn(_turn());
  _setEnergy((prev) => ({
    ...prev,
    [color]: clampEnergy(prev[color] + amount, cap),
  }));
};

/** Storybook / new-game seed for the active side (and optional opponent). */
export const resetBroodWarEconomy = (opts?: {
  turn?: number;
  white?: PlayerEconomy;
  black?: PlayerEconomy;
  kingLives?: KingLives;
  /** Override remaining energy after refill (both sides unless per-side passed). */
  energy?: Partial<EnergyPool> | number;
  /** When true (default), start a fresh planning timer. */
  startTimer?: boolean;
}) => {
  const turn = opts?.turn ?? 1;
  _setTurn(turn);
  _setEconomies({
    w: opts?.white ?? { stored: 0, deployed: 0 },
    b: opts?.black ?? { stored: 0, deployed: 0 },
  });
  _setKingLives(opts?.kingLives ?? defaultKingLives());
  const filled = fullEnergyForTurn(turn);
  if (typeof opts?.energy === "number") {
    const n = clampEnergy(opts.energy, energyForTurn(turn));
    _setEnergy({ w: n, b: n });
  } else if (opts?.energy) {
    _setEnergy({
      w: clampEnergy(opts.energy.w ?? filled.w, energyForTurn(turn)),
      b: clampEnergy(opts.energy.b ?? filled.b, energyForTurn(turn)),
    });
  } else {
    _setEnergy(filled);
  }
  if (opts?.startTimer === false) {
    clearTurnDeadline();
  } else {
    startPlanningTimer();
  }
};
