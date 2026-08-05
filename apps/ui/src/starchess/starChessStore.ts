import { createSignal } from "solid-js";
import type { Square } from "chess.js";

import {
  KING_MAX_LIVES,
  MAX_DEPLOYED_MATERIAL,
  MAX_STORED_MATERIAL,
  SPECIAL_ENERGY_COST,
  TURN_TIMEOUT_MS,
  energyForTurn,
  incomeForTurn,
} from "~/starchess/constants";
import { endScTurn, type EndScTurnResult } from "~/starchess/endScTurn";
import { addScAction } from "~/starchess/scActions";
import type { StarChessColor, PlayerEconomy } from "~/starchess/types";
import type { RookMode, ScAction, ScActionInput, ScFenSnapshot } from "~/starchess/types";
import { activePlayerColor } from "~/store/settingsStore";

type Economies = Record<StarChessColor, PlayerEconomy>;
type KingLives = Record<StarChessColor, number>;
type EnergyPool = Record<StarChessColor, number>;

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
/** Squares whose Siege Tank is unpacked (siege mode). Absent ⇒ tank mode. */
const [_siegedRooks, _setSiegedRooks] = createSignal<ReadonlySet<Square>>(new Set<Square>());
/**
 * Squares whose unit already used a special this planning turn.
 * Serialized in SCFEN as `|U:…` extras; cleared when the turn advances.
 */
const [_specialsUsed, _setSpecialsUsed] = createSignal<ReadonlySet<Square>>(new Set<Square>());
/** Active SCFEN planning snapshot (queue source of truth for TurnBar). */
const [_planningSnap, _setPlanningSnap] = createSignal<ScFenSnapshot | null>(null);

/** Current StarChess turn index (1-based; drives income / energy tier). */
export const starChessTurn = () => _turn();

export const setStarChessTurn = (turn: number) => {
  const next = Math.max(1, turn);
  _setTurn(next);
  // Fresh gas each turn — leftover does not accumulate.
  _setEnergy(fullEnergyForTurn(next));
  clearSpecialsUsed();
};

/**
 * Credit both sides’ mineral income for the planning turn just entered.
 * Cap at {@link MAX_STORED_MATERIAL}. Called when SCFEN `turn` advances.
 */
export const grantTurnIncome = (turn: number) => {
  const amount = incomeForTurn(Math.max(1, turn));
  if (amount <= 0) return;
  for (const color of ["w", "b"] as const) {
    const eco = _economies()[color];
    setPlayerEconomy(color, {
      stored: Math.min(MAX_STORED_MATERIAL, eco.stored + amount),
      deployed: eco.deployed,
    });
  }
};

export const starChessEconomies = () => _economies();

/** Both sides’ king HP (0–3). Source of truth for damage VFX / SCFEN lives. */
export const kingLives = () => _kingLives();
export const kingLivesFor = (color: StarChessColor) => _kingLives()[color];

export const setKingLives = (next: KingLives) => {
  _setKingLives({ w: clampLives(next.w), b: clampLives(next.b) });
};

export const setKingLivesFor = (color: StarChessColor, lives: number) => {
  _setKingLives((prev) => ({ ...prev, [color]: clampLives(lives) }));
};

/** Successful king-shot: decrement one life. Returns remaining HP. */
export const chipKingLife = (color: StarChessColor): number => {
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
 * Base material income for the upcoming turn (starchess-mode.puml).
 * Idle 1.5× bonus is applied at resolve time — ResourceBar shows the base rate.
 */
export const materialIncome = () => incomeForTurn(_turn());

/** Vespene capacity for the current turn (ResourceBar denominator). */
export const energyCapacity = () => energyForTurn(_turn());

/** Remaining vespene for the local / active player this turn. */
export const energyRemaining = () => _energy()[activePlayerColor()];

export const energyRemainingFor = (color: StarChessColor) => _energy()[color];

/** Static deploy cap — ResourceBar denominator. */
export const maxDeployedSupply = MAX_DEPLOYED_MATERIAL;

export const turnDeadlineAt = () => _deadlineAt();

/** Squares currently in Siege Tank siege mode. */
export const siegedRooks = () => _siegedRooks();

/** Per-square Siege Tank mode (`tank` when not listed in {@link siegedRooks}). */
export const rookModeAt = (square: Square): RookMode =>
  _siegedRooks().has(square) ? "siege" : "tank";

export const setRookMode = (square: Square, mode: RookMode) => {
  _setSiegedRooks((prev) => {
    const next = new Set(prev);
    if (mode === "siege") next.add(square);
    else next.delete(square);
    return next;
  });
};

/** Toggle tank ↔ siege on a square. Returns the mode after toggle. */
export const toggleRookSiege = (square: Square): RookMode => {
  const next: RookMode = rookModeAt(square) === "siege" ? "tank" : "siege";
  setRookMode(square, next);
  return next;
};

export const clearSiegedRooks = () => _setSiegedRooks(new Set<Square>());

/** Replace the full sieged-rook set (Storybook seeds). */
export const setSiegedRooks = (squares: Iterable<Square>) => {
  _setSiegedRooks(new Set<Square>(squares));
};

/** Squares whose unit already spent its special this turn. */
export const specialsUsedThisTurn = () => _specialsUsed();

export const hasUsedSpecialThisTurn = (square: Square): boolean =>
  _specialsUsed().has(square);

/** Mark a unit (by square) as having used its special this turn. */
export const markSpecialUsed = (square: Square) => {
  _setSpecialsUsed((prev) => {
    if (prev.has(square)) return prev;
    const next = new Set(prev);
    next.add(square);
    return next;
  });
};

/** Follow a unit that relocates after using a special (glow stays on the piece). */
export const migrateSpecialUsed = (from: Square, to: Square) => {
  if (from === to) return;
  _setSpecialsUsed((prev) => {
    if (!prev.has(from)) return prev;
    const next = new Set(prev);
    next.delete(from);
    next.add(to);
    return next;
  });
};

export const clearSpecialsUsed = () => _setSpecialsUsed(new Set<Square>());

/** Replace the full specials-used set (SCFEN load / Storybook seeds). */
export const setSpecialsUsed = (squares: Iterable<Square>) => {
  _setSpecialsUsed(new Set<Square>(squares));
};

/** Active planning SCFEN snap (null when not in a queued planning turn). */
export const planningSnapshot = () => _planningSnap();

/** Queue actions from the planning snap — TurnBar reads this only. */
export const currentQueue = (): readonly ScAction[] =>
  _planningSnap()?.queue?.actions ?? [];

export const setPlanningSnapshot = (snap: ScFenSnapshot | null) => {
  const prevTurn = _planningSnap()?.turn;
  _setPlanningSnap(snap);
  if (!snap) return;
  // Preserve turn 0 (demo / SCFEN start); do not coerce via `|| 1`.
  const turn = Math.max(0, snap.turn);
  const advanced = prevTurn != null && turn > prevTurn;
  _setTurn(turn);
  setKingLives(snap.kingLives);
  // Cap remaining to this turn's tier — leftover never banks past income.
  const cap = energyForTurn(turn);
  _setEnergy({
    w: clampEnergy(snap.gas.w, cap),
    b: clampEnergy(snap.gas.b, cap),
  });
  setSpecialsUsed(snap.specialsUsed ?? []);
  // Minerals credit on End / turn advance (ResourceBar `+N` preview).
  if (advanced) grantTurnIncome(turn);
};

/** Append via `addScAction` and sync the planning snap. */
export const queueScAction = (action: ScActionInput): ScFenSnapshot => {
  const cur = _planningSnap();
  if (!cur) throw new Error("queueScAction: no planning snapshot");
  const { snapshot } = addScAction({ snapshot: cur, action });
  setPlanningSnapshot(snapshot);
  return snapshot;
};

/**
 * End / timeout: `endScTurn` on the planning snap, sync store, return result.
 * Clears the planning deadline.
 */
export const endPlanningTurn = (): EndScTurnResult => {
  const cur = _planningSnap();
  if (!cur) throw new Error("endPlanningTurn: no planning snapshot");
  const result = endScTurn(cur);
  setPlanningSnapshot(result.next);
  clearTurnDeadline();
  return result;
};

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

export const setPlayerEconomy = (color: StarChessColor, economy: PlayerEconomy) => {
  _setEconomies((prev) => ({
    ...prev,
    [color]: {
      stored: Math.min(MAX_STORED_MATERIAL, Math.max(0, economy.stored)),
      deployed: Math.min(MAX_DEPLOYED_MATERIAL, Math.max(0, economy.deployed)),
    },
  }));
};

export const spendStored = (color: StarChessColor, amount: number): boolean => {
  const eco = _economies()[color];
  if (amount <= 0 || eco.stored < amount) return false;
  setPlayerEconomy(color, { stored: eco.stored - amount, deployed: eco.deployed });
  return true;
};

export const refundStored = (color: StarChessColor, amount: number) => {
  const eco = _economies()[color];
  setPlayerEconomy(color, { stored: eco.stored + Math.max(0, amount), deployed: eco.deployed });
};

export const addDeployed = (color: StarChessColor, amount = 1): boolean => {
  const eco = _economies()[color];
  if (amount <= 0) return false;
  if (eco.deployed + amount > MAX_DEPLOYED_MATERIAL) return false;
  setPlayerEconomy(color, { stored: eco.stored, deployed: eco.deployed + amount });
  return true;
};

export const removeDeployed = (color: StarChessColor, amount = 1) => {
  const eco = _economies()[color];
  setPlayerEconomy(color, {
    stored: eco.stored,
    deployed: Math.max(0, eco.deployed - Math.max(0, amount)),
  });
};

/** Burn vespene for a special. Default cost = `SPECIAL_ENERGY_COST` (1). */
export const spendEnergy = (
  color: StarChessColor,
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
  color: StarChessColor,
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
export const resetStarChessEconomy = (opts?: {
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
  clearSiegedRooks();
  clearSpecialsUsed();
  if (opts?.startTimer === false) {
    clearTurnDeadline();
  } else {
    startPlanningTimer();
  }
};
