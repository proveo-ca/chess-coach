// SPEC: _spec/game-core.puml
export type Square = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export type StarChessColor = "w" | "b";
export type StarChessPiece = "p" | "n" | "b" | "r" | "q" | "k";
export type TankMode = "tank" | "siege";
export type ScPhaseCode = "P" | "B" | "A" | "M" | "F" | "O";
export type SpawnPiece = "p" | "q" | "r" | "b" | "n";
export type ScSpecialKind =
  | "deploy"
  | "stimStep"
  | "spiderMine"
  | "charonMissiles"
  | "siegeMode"
  | "tacticalJump";

export type ScAction =
  | {
      timing: "B" | "F";
      kind: ScSpecialKind;
      color: StarChessColor;
      from: Square;
      to?: Square;
      unit?: SpawnPiece;
      promotion?: SpawnPiece;
      seq: number;
    }
  | {
      timing: "C";
      kind: "classical";
      color: StarChessColor;
      from: Square;
      to: Square;
      promotion?: SpawnPiece;
      seq: number;
    };

export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type ScActionInput = DistributiveOmit<ScAction, "seq">;
export type ScTurnQueue = { actions: readonly ScAction[] };
export type ScMine = { color: StarChessColor; at: Square };
export type ScPendingCCShot = {
  color: StarChessColor;
  piece: StarChessPiece;
  from: Square;
  to: Square;
};
export type ScFenSnapshot = {
  placement: string;
  turn: number;
  ccLives: Record<StarChessColor, number>;
  phase: ScPhaseCode;
  gas: Record<StarChessColor, number>;
  gasIncome: Record<StarChessColor, number>;
  stored?: Record<StarChessColor, number>;
  specialsUsed?: readonly Square[];
  queue?: ScTurnQueue;
  mines?: readonly ScMine[];
  siegedTanks?: readonly Square[];
  pendingCCShots?: readonly ScPendingCCShot[];
};
export type ScPiece = { type: StarChessPiece; color: StarChessColor };
