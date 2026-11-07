// SPEC: _spec/game-core.puml
export const CC_MAX_LIVES = 3;
export const MAX_STORED_MATERIAL = 12;
export const MAX_DEPLOYED_MATERIAL = 50;
export const MAX_GAME_TURNS = 45;
export const TURN_TIMEOUT_MS = 10_000;

export const UNIT_COST = Object.freeze({
  k: 1,
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
} as const);

export const incomeForTurn = (turn: number): number => {
  if (turn <= 10) return 1;
  if (turn <= 20) return 2;
  return 3;
};

export const energyForTurn = (turn: number): number => incomeForTurn(Math.max(1, turn));

export const turnTimeoutMsForTurn = (turn: number): number => {
  const tier = energyForTurn(turn);
  let ms = TURN_TIMEOUT_MS;
  for (let i = 1; i < tier; i += 1) {
    ms = Math.floor((ms * 1.5) / 1000) * 1000;
  }
  return ms;
};

export const SPECIAL_ENERGY_COST = 1;
export const MECHA_CHARON_GAS_COST = 2;
export const TACTICAL_JUMP_GAS_COST = 3;
