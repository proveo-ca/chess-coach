import { createSignal } from "solid-js";

/**
 * Bumped when the player commits a name (input blur or dice roll).
 * NerdModePrompt runs Levenshtein only on commit — not on every keystroke.
 */
const [nameCommitTick, setNameCommitTick] = createSignal(0);

export const playerNameCommitTick = () => nameCommitTick();

/** Call after the name field is committed (blur / dice). */
export const commitPlayerNameCheck = (): void => {
  setNameCommitTick((n) => n + 1);
};

/** Test helper — reset commit counter between cases. */
export const resetPlayerNameCommitTick = (): void => {
  setNameCommitTick(0);
};
