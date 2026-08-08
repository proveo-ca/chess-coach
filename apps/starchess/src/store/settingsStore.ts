/**
 * Shared Coach settings blob — same localStorage key as `apps/ui` so
 * proveo.ca/chess and proveo.ca/starchess share the player name.
 */
import { createSharedSettingsFieldStore } from "~/store/createPersistedStore";
import { randomName } from "~/utils/randomName";

/** Must match `apps/ui/src/store/settingsStore.ts`. */
export const SETTINGS_STORAGE_KEY = "chess_coach_settings_state";

const [settingsState, setSettingsState] = createSharedSettingsFieldStore(
  SETTINGS_STORAGE_KEY,
  {
    playerName: randomName(),
  },
);

export const playerName = () => settingsState.playerName;
export const setPlayerName = (val: string) => setSettingsState("playerName", val);
