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

/**
 * The player has been made for a nerd — a StarCraft name was recognised — no
 * matter which way they answered the prompt. Persisted so the Menu can keep
 * offering StarChess instead of making them retype the name to find it again.
 */
const [nerdState, setNerdState] = createPersistedStore("isNerd", { isNerd: false });

/** Whether MenuScreen offers the StarChess shortcut. */
export const isNerd = () => nerdState.isNerd;

export const setIsNerd = (val: boolean) => setNerdState("isNerd", val);

/** Classic identities, plus Nerd when unlocked. */
export const identityOptions = (): PlayerIdentity[] =>
  unlockState.unlocked ? [...CLASSIC_IDENTITY_OPTIONS, "Nerd"] : CLASSIC_IDENTITY_OPTIONS;

/** @deprecated Prefer {@link nerdIdentityUnlocked}. */
export const nerdModeUnlocked = nerdIdentityUnlocked;
/** @deprecated Prefer {@link setNerdIdentityUnlocked}. */
export const setNerdModeUnlocked = setNerdIdentityUnlocked;
