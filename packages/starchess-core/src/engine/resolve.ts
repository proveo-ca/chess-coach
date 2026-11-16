// SPEC: _spec/turn-resolution.puml, _spec/engine-consolidation.puml
import { endScTurnKernel as mutationKernel } from "../resolve/submit-turn";
import type { EndScTurnOptions, EndScTurnResult } from "../resolve/submit-turn";
import type { ResolutionEffects } from "./causal-types";
import type { ScFenSnapshot } from "./types";

export { beginScTurn, beginScTurnKernel, refillTurnGas, rewriteClassicalAfterB } from "../resolve/submit-turn";
export type { ResolveEvent, EndScTurnResult, EndScTurnOptions, BeginScTurnResult } from "../resolve/submit-turn";
export const endScTurnKernel = (snapshot: ScFenSnapshot, options?: EndScTurnOptions, effects?: ResolutionEffects): EndScTurnResult =>
  mutationKernel(snapshot, options, effects, true);
export const endScTurn = (snapshot: ScFenSnapshot, options?: EndScTurnOptions): EndScTurnResult => endScTurnKernel(snapshot, options);
