// SPEC: _spec/game-core.puml
import type { ScAction, ScFenSnapshot, ScPiece, Square, StarChessColor } from "./types";
import { placementToMap } from "./board";
import { MAX_STORED_MATERIAL, UNIT_COST, incomeForTurn } from "./constants";
import { specialGasCost } from "./specials";

export const OPENING_STORED_MATERIAL = 3;

export const applyStoredIncome = (
  bank: Record<StarChessColor, number>,
  turn: number,
): Record<StarChessColor, number> => {
  const amount = incomeForTurn(Math.max(1, turn));
  if (amount <= 0) return bank;
  return {
    w: Math.min(MAX_STORED_MATERIAL, bank.w + amount),
    b: Math.min(MAX_STORED_MATERIAL, bank.b + amount),
  };
};

export const estimateStoredFromSnap = (snap: Pick<ScFenSnapshot, "turn">): number => {
  let stored = OPENING_STORED_MATERIAL;
  for (let turn = 1; turn <= Math.max(0, snap.turn); turn += 1) {
    stored = applyStoredIncome({ w: stored, b: stored }, turn).w;
  }
  return Math.max(0, stored);
};

export const gasRemainingFor = (
  snap: Pick<ScFenSnapshot, "gas" | "queue">,
  color: StarChessColor,
  overlayActions?: readonly ScAction[] | null,
): number => {
  let rem = Math.max(0, Object.entries(snap.gas).find(([side]) => side === color)?.[1] ?? 0);
  if (!overlayActions?.length) return rem;
  const onSnap = new Set((snap.queue?.actions ?? []).map((action) => action.seq));
  for (const action of overlayActions) {
    if (action.color !== color || action.timing === "C" || onSnap.has(action.seq)) continue;
    rem -= specialGasCost(action.kind);
  }
  return Math.max(0, rem);
};

export const deployedMaterialFromMap = (map: Map<Square, ScPiece>, color: StarChessColor): number => {
  let total = 0;
  for (const piece of map.values()) {
    if (piece.color === color) total += UNIT_COST[piece.type];
  }
  return total;
};

export const deployedMaterialFromPlacement = (placement: string, color: StarChessColor): number =>
  deployedMaterialFromMap(placementToMap(placement), color);

export const placementFromFen = (fen: string): string => {
  const placement = fen.trim().split(/\s+/)[0];
  if (!placement) throw new Error(`Bad FEN / placement: ${fen.slice(0, 48)}`);
  return placement;
};

export const deployedMaterialFromFen = (fen: string, color: StarChessColor): number =>
  deployedMaterialFromPlacement(placementFromFen(fen), color);
