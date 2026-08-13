// SPEC: _spec/packages/starchess-core/ray-scan.puml, _spec/packages/starchess-core/resolve.puml
import type { Square } from "chess.js";

import { rayBetween } from "./mines";
import type { ScPiece } from "./placement";
import { pathRevealSteps, type PathVisionOpts } from "./vision";
import type { StarChessColor } from "../model/types";

export type RayContact = {
  at: Square;
  index: number;
  occ: ScPiece;
  startVisible: boolean;
  revealSteps: number | null;
  becomesVisible: boolean;
  discovery: Square | null;
  stopBefore: Square | null;
};

export type RayScan = {
  mids: Square[];
  contact: RayContact | null;
};

export type RayScanInput = {
  board: ReadonlyMap<Square, ScPiece>;
  placement: string;
  from: Square;
  intentTo: Square;
  color: StarChessColor;
  canSee: (color: StarChessColor, square: Square) => boolean;
  visionOpts?: PathVisionOpts;
};

export const scanRay = (input: RayScanInput): RayScan => {
  const mids = rayBetween(input.from, input.intentTo);
  for (let i = 0; i < mids.length; i += 1) {
    const at = mids[i]!;
    const occ = input.board.get(at);
    if (!occ) continue;
    const startVisible = input.canSee(input.color, at);
    const revealSteps = pathRevealSteps(
      input.placement,
      input.from,
      input.intentTo,
      input.color,
      at,
      input.visionOpts,
    );
    const becomesVisible =
      !startVisible && revealSteps != null && revealSteps > 0;
    return {
      mids,
      contact: {
        at,
        index: i,
        occ,
        startVisible,
        revealSteps,
        becomesVisible,
        discovery: becomesVisible ? (mids[revealSteps! - 1] ?? null) : null,
        stopBefore: i === 0 ? null : mids[i - 1]!,
      },
    };
  }
  return { mids, contact: null };
};

export const revealStepsTo = (
  input: Omit<RayScanInput, "board"> & { target: Square },
): number | null =>
  pathRevealSteps(
    input.placement,
    input.from,
    input.intentTo,
    input.color,
    input.target,
    input.visionOpts,
  );
