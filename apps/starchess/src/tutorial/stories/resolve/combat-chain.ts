// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const combatChain = {
  id: "combat-chain",
  title: "Combat Chain",
  comment: "We're now observers of a past combat. \nReplay it with the arrows on the top. \nNotice how turns are simultaneous!",
  emotion: "idle",
  intentArrows: true,
  completeWhen: {
    kind: "typewriter",
    turn: 3,
    beat: "resolve",
  },
  beats: [
    {
      when: { kind: "reviewPhase", phase: "check" },
      say: "Check phase: Turn-open shots before anyone queues intent.",
      emotion: "shocked",
    },
    {
      when: { kind: "reviewPhase", phase: "intent" },
      say: "Intent: ghosts are promises. Nothing moves until next phase.",
      emotion: "watching",
    },
    {
      when: { kind: "reviewPhase", phase: "resolve" },
      say: "Resolve: in the following order: \n1. (Gas) Specials \n2. Attacks \n3. Moves \n4. (Gas) Specials",
      emotion: "scanning",
    },
    {
      when: { kind: "timelineActive" },
      say: "A classical Chess capture is split in attack/move. \nOnly survivors move.",
      emotion: "thinking",
    },
  ],
} satisfies TutorialStoryScript;
