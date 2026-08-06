/** Combat resolve playback — store-free classical timing. */
export {
  playResolve,
  type CombatCommit,
  type CombatFxState,
  type PlayResolveHandle,
  type PlayResolveOptions,
  type ChasingMineCue,
} from "~/presentation/combat/playResolve";
export {
  buildFxHiddenSquares,
  EMPTY_FX_HIDDEN,
  hasCombatFxInput,
  type CombatFxInput,
} from "~/presentation/combat/boardFx";
export {
  intentOverlaysFromQueue,
  type IntentCanisterGhost,
  type IntentCheckGhost,
  type IntentOverlays,
  type IntentOverlayOpts,
} from "~/presentation/combat/intentOverlays";
