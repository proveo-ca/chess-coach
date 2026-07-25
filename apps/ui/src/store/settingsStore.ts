import { capabilities } from "~/store/capabilitiesStore";
import { createPersistedStore } from "~/store/createPersistedStore";
import type { Difficulty, PieceSet, PlayerColorPref, PlayerIdentity } from "~/types/settings";
import { randomName } from "~/utils/randomName";

/**
 * Centipawn loss at which a move counts as a blunder, per difficulty.
 * Stronger settings are stricter (a smaller drop already counts). Values are
 * negative because they are compared against a signed cpDelta (delta <= threshold).
 */
export const BLUNDER_THRESHOLD_CP_BY_DIFFICULTY: Record<Difficulty, number> = {
  intermediate: -200,
  advanced: -150,
  expert: -80,
};

/**
 * How the coach names a threshold-crossing move per difficulty. The same loss
 * is held to a higher standard as the player improves: a 200cp drop is a
 * "blunder" for an intermediate, while an expert is pulled up on an 80cp drop
 * as merely "an inaccuracy". Includes the article so "is {label}" reads
 * naturally ("is a blunder" / "is an inaccuracy").
 */
export const BLUNDER_LABEL_BY_DIFFICULTY: Record<Difficulty, string> = {
  intermediate: "a blunder",
  advanced: "a mistake",
  expert: "an inaccuracy",
};

export const IDENTITY_TO_PIECE_SET: Record<PlayerIdentity, PieceSet> = {
  Human: "cburnett",
  Cat: "selena",
  Dog: "gord",
  Rat: "manuel",
  Nerd: "nerd",
};

const CLASSIC_IDENTITY_OPTIONS: PlayerIdentity[] = ["Human", "Cat", "Dog", "Rat"];

const [settingsState, setSettingsState] = createPersistedStore("chess_coach_settings_state", {
  colorPref: "w" as PlayerColorPref,
  activePlayerColor: "w" as "w" | "b",
  difficulty: "intermediate" as Difficulty,
  playerIdentity: "Human" as PlayerIdentity,
  opponentIdentity: "Cat" as PlayerIdentity,
  nerdModeUnlocked: false,
  // Free-text display name for the human player, used to label saved games
  // ("Juan (White) vs Selena (Black)"). The browser cannot supply a real name
  // (no device/host name or MAC is exposed to web pages), so we default to a
  // fun generated name the user can edit or re-roll (🎲).
  playerName: randomName(),
  imLost: true,
});

export const colorPref = () => settingsState.colorPref;
export const activePlayerColor = () => settingsState.activePlayerColor;
export const difficulty = () => settingsState.difficulty;
export const blunderThresholdCp = () =>
  BLUNDER_THRESHOLD_CP_BY_DIFFICULTY[settingsState.difficulty];
export const blunderLabel = () => BLUNDER_LABEL_BY_DIFFICULTY[settingsState.difficulty];
export const playerIdentity = () => settingsState.playerIdentity;
export const opponentIdentity = () => settingsState.opponentIdentity;
export const playerName = () => settingsState.playerName;
export const imLost = () => settingsState.imLost;
export const nerdModeUnlocked = () => settingsState.nerdModeUnlocked;
export const identityOptions = (): PlayerIdentity[] =>
  settingsState.nerdModeUnlocked ? [...CLASSIC_IDENTITY_OPTIONS, "Nerd"] : CLASSIC_IDENTITY_OPTIONS;
export const playerPieceSet = (): PieceSet =>
  settingsState.playerIdentity === "Nerd"
    ? "nerd"
    : settingsState.imLost
      ? "cburnett"
      : IDENTITY_TO_PIECE_SET[settingsState.playerIdentity];
export const opponentPieceSet = (): PieceSet => {
  if (capabilities().opponentUsesPlayerPieceSet && settingsState.playerIdentity === "Nerd") {
    return "nerd";
  }
  if (settingsState.imLost) return "cburnett";
  if (capabilities().opponentUsesPlayerPieceSet) {
    return IDENTITY_TO_PIECE_SET[settingsState.playerIdentity];
  }
  return IDENTITY_TO_PIECE_SET[settingsState.opponentIdentity];
};

export const setColorPref = (val: PlayerColorPref) => setSettingsState("colorPref", val);
export const setActivePlayerColor = (val: "w" | "b") => setSettingsState("activePlayerColor", val);
export const setDifficulty = (val: Difficulty) => setSettingsState("difficulty", val);
export const setPlayerIdentity = (val: PlayerIdentity) => setSettingsState("playerIdentity", val);
export const setPlayerName = (val: string) => setSettingsState("playerName", val);
export const setOpponentIdentity = (val: PlayerIdentity) =>
  setSettingsState("opponentIdentity", val);
export const setImLost = (val: boolean) => setSettingsState("imLost", val);
export const setNerdModeUnlocked = (val: boolean) => setSettingsState("nerdModeUnlocked", val);
