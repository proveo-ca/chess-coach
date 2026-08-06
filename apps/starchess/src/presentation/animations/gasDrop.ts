/**
 * Gas special resolve VFX — canister drop into the unit + green aura ease-in.
 * // SPEC: _spec/apps/ui/starchess/resolve.puml
 */
import type { Square } from "chess.js";

import { GAS_DROP_MS } from "~/presentation/constants";
import type { GasDropCorner } from "~/presentation/types";

export { GAS_DROP_MS };

/** Stable top-edge start from the square id (left / mid / right). */
export const gasDropCornerFor = (at: Square): GasDropCorner => {
  const n = at.charCodeAt(0) * 31 + at.charCodeAt(1);
  const i = ((n % 3) + 3) % 3;
  return (["left", "mid", "right"] as const)[i]!;
};
