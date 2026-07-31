import type { PieceSymbol, Square } from "chess.js";

import { DEPLOY_DROP_MS, DEPLOY_LAND_MS, DEPLOY_MS, DEPLOY_THRUST_MS } from "~/broodwar/constants";
import type { BroodWarPiece, DeployCue, PieceColor } from "~/types/broodwar";

export { DEPLOY_DROP_MS, DEPLOY_LAND_MS, DEPLOY_MS, DEPLOY_THRUST_MS };

export type DeployKind = "humanoid" | "mechanoid";

export type DeployPiece = Exclude<BroodWarPiece, "k">;

/** Pawn / bishop crouch-land; knight / rook / queen thrust-brake. */
export const deployKindFor = (piece: PieceSymbol): DeployKind | null => {
  if (piece === "p" || piece === "b") return "humanoid";
  if (piece === "n" || piece === "r" || piece === "q") return "mechanoid";
  return null;
};

export const MECHANOID_THRUST: Record<"n" | "r" | "q", "air" | "fuel" | "team"> = {
  n: "air",
  r: "fuel",
  q: "team",
};

export const DEPLOY_ORIGIN: Square = "d5";

/** Empty board with both kings (FEN-loadable) — target square vacant until deploy ends. */
export const DEPLOY_FEN_EMPTY = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

/** After animation — white unit on d5. */
export const DEPLOY_FEN_LANDED: Record<DeployPiece, string> = {
  p: "4k3/8/8/3P4/8/8/8/4K3 w - - 0 1",
  n: "4k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
  b: "4k3/8/8/3B4/8/8/8/4K3 w - - 0 1",
  r: "4k3/8/8/3R4/8/8/8/4K3 w - - 0 1",
  q: "4k3/8/8/3Q4/8/8/8/4K3 w - - 0 1",
};

export const makeDeployCue = (
  piece: DeployPiece,
  color: PieceColor = "w",
  at: Square = DEPLOY_ORIGIN,
): DeployCue => ({
  id: `deploy-${piece}-${at}-${Date.now()}`,
  piece,
  color,
  at,
});
