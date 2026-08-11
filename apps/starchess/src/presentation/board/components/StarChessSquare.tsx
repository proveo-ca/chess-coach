/** Square helpers shared with StarChessBoard. */
export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

/** Match UI StarChessBoardView: `(rIndex + fIndex) % 2 === 0` with display order. */
export const isLightSquare = (file: string, rank: string) => {
  const fIndex = "abcdefgh".indexOf(file);
  const rIndex = "87654321".indexOf(rank);
  return (rIndex + fIndex) % 2 === 0;
};
