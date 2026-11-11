// SPEC: _spec/resolution-primitives.puml
import { rayBetween } from "./mines";
import { pathRevealSteps, pathRevealStepsKernel } from "./vision";
import type { PathQueryTap, VisionOptions } from "./vision";
import type { ScPiece, Square, StarChessColor } from "./types";

export type RayContact = {
  at: Square; index: number; occ: ScPiece; startVisible: boolean; revealSteps: number | null;
  becomesVisible: boolean; discovery: Square | null; stopBefore: Square | null;
};
export type RayScan = { mids: Square[]; contact: RayContact | null };
export type RayScanInput = {
  board: ReadonlyMap<Square, ScPiece>;
  placement: string;
  from: Square;
  intentTo: Square;
  color: StarChessColor;
  canSee: (color: StarChessColor, square: Square) => boolean;
  visionOpts?: VisionOptions;
};

export const scanRay = (input: RayScanInput, query?: (target: Square) => PathQueryTap | undefined): RayScan => {
  const mids = rayBetween(input.from, input.intentTo);
  for (let index = 0; index < mids.length; index++) {
    const at = mids[index]!;
    const occ = input.board.get(at);
    if (!occ) continue;
    const startVisible = input.canSee(input.color, at);
    const revealSteps = pathRevealStepsKernel(input.placement, input.from, input.intentTo, input.color, at, input.visionOpts, query?.(at));
    const becomesVisible = !startVisible && revealSteps != null && revealSteps > 0;
    return { mids, contact: {
      at, index, occ, startVisible, revealSteps, becomesVisible,
      discovery: becomesVisible ? mids[revealSteps - 1] ?? null : null, stopBefore: index === 0 ? null : mids[index - 1]!,
    } };
  }
  return { mids, contact: null };
};

export const revealStepsTo = (input: Omit<RayScanInput, "board"> & { target: Square }): number | null =>
  pathRevealSteps(input.placement, input.from, input.intentTo, input.color, input.target, input.visionOpts);
