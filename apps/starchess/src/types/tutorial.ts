/** Tutorial stage ids (Breadcrumb / routes / script). */

export type TutorialSectionId = "fog" | "specials" | "resolve" | "king";

/** Resolve timeline wave partitions for tutorial steppers. */
export type ResolveWaveId =
  | "specialBefore"
  | "attack"
  | "move"
  | "specialAfter";

/** Optional in-bubble CTA from a tutorial reaction. */
export type TutorialReactionAction = {
  kind: "retryLesson";
  label?: string;
};

/** One revealed line in the resolve typewriter footer nav. */
export type TypewriterLine = {
  text: string;
  indent?: boolean;
};

/** Flat beat cursor: Turn N → Check → Intent → Resolve. */
export type TypewriterBeat =
  | { kind: "turn"; turn: number; resolveIndex: number; text: string }
  | {
      kind: "check";
      resolveIndex: number;
      hasCheck: boolean;
      text: string;
    }
  | { kind: "intent"; resolveIndex: number; text: string }
  | { kind: "resolve"; resolveIndex: number; text: string };
