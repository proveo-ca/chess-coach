/** Coach avatar identity + Kerrigan emotion vocabulary. */

export type CoachIdentity = "selena" | "kerrigan";

export type KerriganEmotion =
  | "idle"
  | "watching"
  | "watching--left"
  | "watching--right"
  | "watching--up"
  | "thinking"
  | "happy"
  | "shocked"
  | "sleepy"
  | "sleeping"
  /** Visor slides from forehead down over the eyes. */
  | "scanning";
