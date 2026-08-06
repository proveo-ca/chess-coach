import type { PieceSymbol, Square } from "chess.js";

import { DEPLOY_DROP_MS, DEPLOY_LAND_MS, DEPLOY_MS, DEPLOY_THRUST_MS } from "~/presentation/constants";
import type { StarChessPiece, DeployCue, PieceColor } from "~/presentation/types";

export { DEPLOY_DROP_MS, DEPLOY_LAND_MS, DEPLOY_MS, DEPLOY_THRUST_MS };

export type DeployKind = "humanoid" | "mechanoid";

export type DeployPiece = Exclude<StarChessPiece, "k">;

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

export const DEPLOY_ORIGIN: Square = "e2";

/** Empty board with both kings (FEN-loadable) — target square vacant until deploy ends. */
export const DEPLOY_FEN_EMPTY = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

/** After animation — white unit on e2 (adjacent to the Command Center). */
export const DEPLOY_FEN_LANDED: Record<DeployPiece, string> = {
  p: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
  n: "4k3/8/8/8/8/8/4N3/4K3 w - - 0 1",
  b: "4k3/8/8/8/8/8/4B3/4K3 w - - 0 1",
  r: "4k3/8/8/8/8/8/4R3/4K3 w - - 0 1",
  q: "4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1",
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
