// SPEC: _spec/classical-resolution.puml, _spec/engine-consolidation.puml
import { placementToMap } from "../board/placement";
import { isScMoveShape } from "../board/moves";
import { ScValidateError } from "../rules/validation";
import { resolveTurnKernel } from "../resolve/resolve-turn";
import type { ResolveTurnInput, ResolveTurnResult } from "../resolve/resolve-turn";
import type { StarChessColor } from "./types";
import type { ResolutionEffects } from "./causal-types";

export { applyPendingCCShots, applyPathRevealAttack, applyPathRevealCCShot, hasDepartingPlan, isActorAnchored, isApproachOwnedDestination, clearDepartedGhost } from "../resolve/resolve-turn";
export type { ClassicalPlan, ResolvePromotion, ResolveMove, ResolveAttack, ResolveTurnInput, ResolveBoard, ResolveTurnResult, PathRevealSnap, PathRevealApply } from "../resolve/resolve-turn";

export function resolveClassical(input: ResolveTurnInput, nativeDoubles: Readonly<Record<StarChessColor, boolean>>,
  effects?: ResolutionEffects, sources: Readonly<Record<StarChessColor, number | null>> = { w: null, b: null }): ResolveTurnResult {
  const board = placementToMap(input.placement);
  for (const [plan, color] of [[input.white, "w"], [input.black, "b"]] as const) {
    if (!plan) continue;
    const actor = board.get(plan.from);
    if (actor?.color === color && !isScMoveShape(actor.type, plan.from, plan.to, color) && !(actor.type === "p" && nativeDoubles[color])) {
      throw new ScValidateError("SC_BASELINE_FEN", `invalid ${color} ${actor.type} classical shape ${plan.from}→${plan.to}`);
    }
  }
  return resolveTurnKernel(input, effects, sources);
}

export const resolveTurn = (input: ResolveTurnInput): ResolveTurnResult => resolveClassical(input, { w: false, b: false });
