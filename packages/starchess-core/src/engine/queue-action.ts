// SPEC: _spec/turn-planning.puml, _spec/engine-consolidation.puml
import { addScActionKernel, removeScActionKernel } from "../commands/queue-action";
import { assertActionAdmission, assertNativeClassicalDependencies } from "./queue-validation";
import type { ScAction, ScActionInput, ScFenSnapshot } from "./types";

export { AddScActionError, RemoveScActionError } from "../commands/queue-action";
export type { AddScActionErrorCode, RemoveScActionErrorCode } from "../commands/queue-action";
export const addScAction = (input: { snapshot: ScFenSnapshot; action: ScActionInput }): { snapshot: ScFenSnapshot; action: ScAction } =>
  addScActionKernel(input, assertActionAdmission, assertNativeClassicalDependencies);
export const removeScAction = (input: { snapshot: ScFenSnapshot; seq: number }): { snapshot: ScFenSnapshot; removed: ScAction } =>
  removeScActionKernel(input, assertNativeClassicalDependencies);
