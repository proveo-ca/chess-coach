// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const livePlayDefense4 = {
  id: "live-play-defense-4",
  title: "King Defense IV",
  board: {
    scfen: "SCFEN|k7/8/8/4B3/8/8/4r3/5NPK|1|13|P|G:11:11|Q:w:;b:C=e2h2",
    stored: 4,
    endTurnAfterQueue: "first",
    docs: "Command Center on h1 at HP 1, guarded by Nf1 + Pg1. The hoverbike is the only unit whose vision reaches re2 — and e2 is off its move graph, so spotting is all it can do. Black has the tank pre-queued e2→h2, one square from the CC. Order Be5→h2: two movers land on the same tile in the move phase, so both die — the mecha trades itself for the tank.",
  },
  comment: "Your Hoverbike found a Tank... \nOrder either your Hoverbike or Mecha to h2 to cause a collision.",
  emotion: "thinking",
  completeWhen: { kind: "lost", pieces: ["r"] },
  restartWhen: { kind: "lives", own: 0 },
  beats: [
    {
      when: { kind: "lives", own: 0 },
      say: "Bruh",
      emotion: "watching",
    },
    {
      mark: {
        squares: ["h2"],
        arrows: [
          { from: "e5", to: "h2" },
          { from: "f1", to: "h2", via: "f2" },
        ],
      },
    },
  ],
} satisfies TutorialStoryScript;
