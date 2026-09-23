export type CoachEmotion =
  | "idle"
  | "watching"
  | "watching--left"
  | "watching--right"
  | "thinking"
  | "happy"
  | "shocked"
  | "shrug"
  | "sleepy"
  | "sleeping";

/** Emotions with dedicated compact move-annotation icon artwork. */
export type CoachIconEmotion = "happy" | "shocked" | "thinking" | "shrug";
