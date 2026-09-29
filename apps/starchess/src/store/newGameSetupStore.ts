// SPEC: _spec/apps/starchess/menu-flow.puml
/**
 * Last Adjutant script chosen in the Single Player modal.
 * Coach difficulty (intermediate / advanced / expert) stays in
 * chess_coach_settings_state — this key is StarChess-only.
 */
import { createPersistedStore } from "~/store/createPersistedStore";
import { isPlayableAdjutantKind, type PlayableAdjutantKind } from "~/types/newGame";

export const NEW_GAME_SETUP_KEY = "starchess_setup";

const [state, setState] = createPersistedStore(NEW_GAME_SETUP_KEY, {
  opponent: "naive" as PlayableAdjutantKind,
});

if (!isPlayableAdjutantKind(state.opponent)) {
  setState("opponent", "naive");
}

export const savedOpponent = (): PlayableAdjutantKind =>
  isPlayableAdjutantKind(state.opponent) ? state.opponent : "naive";

export const setSavedOpponent = (kind: PlayableAdjutantKind): void => {
  if (!isPlayableAdjutantKind(kind)) return;
  setState("opponent", kind);
};
