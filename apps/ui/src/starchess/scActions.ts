/**
 * Pure SCFEN planning appenders / removers — the only way a queue mutates.
 * See _spec/apps/ui/starchess/scfen-queue.puml.
 *
 * Compatibility facade — implementation lives in `@chess-coach/starchess-core`.
 * // SPEC: _spec/apps/ui/starchess/scfen-queue.puml
 */
export {
  AddScActionError,
  RemoveScActionError,
  addScAction,
  removeScAction,
  addScMove,
  addScMoveSan,
  type AddScActionErrorCode,
  type RemoveScActionErrorCode,
} from "@chess-coach/starchess-core";
