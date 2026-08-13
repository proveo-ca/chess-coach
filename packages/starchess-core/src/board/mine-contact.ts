// SPEC: _spec/packages/starchess-core/mine-contact.puml, _spec/packages/starchess-core/resolve.puml
import type { Square } from "chess.js";

import { mineAt } from "./mines";
import type { ScMine, StarChessColor, StarChessPiece } from "../model/types";

export type MineContactMode = "attack" | "walk" | "arrive";

export type MineContact =
  | { kind: "inert" }
  | { kind: "cleared"; at: Square; mineColor: StarChessColor }
  | {
      kind: "detonated";
      at: Square;
      mineColor: StarChessColor;
      chaseFrom?: Square;
    };

export type MineContactQuery = {
  mines: readonly ScMine[] | undefined;
  color: StarChessColor;
  piece: StarChessPiece;
  squares: readonly Square[];
  mode: MineContactMode;
};

export const mineContact = ({
  mines,
  color,
  piece,
  squares,
  mode,
}: MineContactQuery): MineContact => {
  if (piece === "k" || squares.length === 0) return { kind: "inert" };
  const landing = squares[squares.length - 1]!;
  for (const at of squares) {
    const m = mineAt(mines, at);
    if (!m || m.color === color) continue;
    if (mode === "attack") return { kind: "cleared", at, mineColor: m.color };
    return {
      kind: "detonated",
      at: landing,
      mineColor: m.color,
      ...(at !== landing ? { chaseFrom: at } : {}),
    };
  }
  return { kind: "inert" };
};

export const withoutMine = (
  mines: readonly ScMine[],
  hit: MineContact,
): ScMine[] => {
  if (hit.kind === "inert") return [...mines];
  const spent = hit.kind === "detonated" ? (hit.chaseFrom ?? hit.at) : hit.at;
  return mines.filter((m) => m.at !== spent);
};

export const hostileMineOn = (
  mines: readonly ScMine[] | undefined,
  color: StarChessColor,
  at: Square,
): boolean => {
  const m = mineAt(mines, at);
  return !!m && m.color !== color;
};
