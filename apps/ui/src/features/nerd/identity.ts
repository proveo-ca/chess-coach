import { createPersistedStore } from "~/store/createPersistedStore";
import type { PlayerIdentity } from "~/types/settings";

const CLASSIC_IDENTITY_OPTIONS: PlayerIdentity[] = ["Human", "Cat", "Dog", "Rat"];

/**
 * Unlock for the classical "Nerd" identity (piece skin under public/pieces/nerd).
 * Separate from StarChess — persisted so Menu/Settings can offer the skin.
 */
const [unlockState, setUnlockState] = createPersistedStore("chess_coach_nerd_identity_unlock", {
  unlocked: false,
});

/** Whether the Nerd identity is available in Menu / Settings / New Game. */
export const nerdIdentityUnlocked = () => unlockState.unlocked;

export const setNerdIdentityUnlocked = (val: boolean) => setUnlockState("unlocked", val);

/** Classic identities, plus Nerd when unlocked. */
export const identityOptions = (): PlayerIdentity[] =>
  unlockState.unlocked ? [...CLASSIC_IDENTITY_OPTIONS, "Nerd"] : CLASSIC_IDENTITY_OPTIONS;

/** @deprecated Prefer {@link nerdIdentityUnlocked}. */
export const nerdModeUnlocked = nerdIdentityUnlocked;
/** @deprecated Prefer {@link setNerdIdentityUnlocked}. */
export const setNerdModeUnlocked = setNerdIdentityUnlocked;
