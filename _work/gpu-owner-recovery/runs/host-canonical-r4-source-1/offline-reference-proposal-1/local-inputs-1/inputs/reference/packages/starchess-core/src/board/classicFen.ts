import type { StarChessColor } from "../model/types";

/** Classic FEN for ChessBoard / chess.js load (always both Command Centers in placement). */
export const toClassicFen = (
  placement: string,
  sideToMove: StarChessColor = "w",
  halfmove = 0,
  fullmove = 1,
): string => `${placement} ${sideToMove} - - ${halfmove} ${fullmove}`;
