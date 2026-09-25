// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const kingHunt = {
  id: "king-hunt",
  title: "King Hunt",
  comment: "We're observing a Command Center in the run! \nIt will crumble after 3 attacks.",
  emotion: "watching",
  intentArrows: true,
  completeWhen: { kind: "lives", own: 0 },
  beats: [
    {
      when: { kind: "lives", own: 2 },
      say: "Checked, a fire represents the damage.",
      emotion: "shocked",
    },
    {
      when: { kind: "lives", own: 1 },
      say: "This guy would have fared better deploying units...",
      emotion: "thinking",
    },
    {
      when: { kind: "lives", enemy: 0 },
      say: "Thinking the same thing",
      emotion: "happy",
    },
  ],
} satisfies TutorialStoryScript;
