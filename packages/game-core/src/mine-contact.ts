// SPEC: _spec/resolution-primitives.puml
import { mineAt } from "./mines";
import type { ScMine, Square, StarChessColor, StarChessPiece } from "./types";

export type MineContactMode = "attack" | "walk" | "arrive" | "walkThenAttack";
export type MineContact =
  | { kind: "inert" }
  | { kind: "cleared"; at: Square; mineColor: StarChessColor }
  | { kind: "detonated"; at: Square; mineColor: StarChessColor; chaseFrom?: Square };
export type MineContactQuery = {
  mines: readonly ScMine[] | undefined;
  color: StarChessColor;
  piece: StarChessPiece;
  squares: readonly Square[];
  mode: MineContactMode;
};

export const mineContact = ({ mines, color, piece, squares, mode }: MineContactQuery): MineContact => {
  if (!squares.length) return { kind: "inert" };
  const landing = squares[squares.length - 1]!;
  for (const at of squares) {
    const mine = mineAt(mines, at);
    if (!mine || mine.color === color) continue;
    const firedUpon = mode === "attack" || (mode === "walkThenAttack" && at === landing);
    if (firedUpon || piece === "k") return { kind: "cleared", at, mineColor: mine.color };
    return { kind: "detonated", at: landing, mineColor: mine.color, ...(at !== landing ? { chaseFrom: at } : {}) };
  }
  return { kind: "inert" };
};

export const withoutMine = (mines: readonly ScMine[], hit: MineContact): ScMine[] => {
  if (hit.kind === "inert") return [...mines];
  const spent = hit.kind === "detonated" ? hit.chaseFrom ?? hit.at : hit.at;
  return mines.filter(mine => mine.at !== spent);
};

export const hostileMineOn = (mines: readonly ScMine[] | undefined, color: StarChessColor, at: Square): boolean => {
  const mine = mineAt(mines, at);
  return !!mine && mine.color !== color;
};
