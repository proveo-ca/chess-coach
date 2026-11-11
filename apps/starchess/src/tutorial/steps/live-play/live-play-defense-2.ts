// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const livePlayDefense2 = {
  id: "live-play-defense-2",
  title: "King Defense II",
  board: {
    scfen: "SCFEN|7k/8/8/8/8/8/6bq/6BK|11|33|P|G:22:22|B:1:1|Q:w:;b:",
    stored: 1,
    choreography: "kingDefenseIIChecks",
  },
  comment: "",
  emotion: "shocked",
  completeWhen: { kind: "lost", pieces: ["b", "q"] },
  restartWhen: { kind: "lives", own: 0 },
  beats: [
    {
      priority: 3,
      when: { kind: "lives", own: 0 },
      say: "Your Command Center fell. \n\nDeploy a Marine onto the Mecha to crush it.",
      emotion: "shocked",
      action: { kind: "retryLesson", label: "Retry lesson" },
    },
    {
      when: { kind: "scfen", re: /deploy:[^:;]*:g2/ },
      say: "Now, queue an attack on that ship with either your Command Center or Mecha.",
      emotion: "watching",
      mark: {
        squares: ["h2"],
        arrows: [
          { from: "g1", to: "h2" },
          { from: "h1", to: "h2" },
        ],
      },
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|11\|1[0-3]\|/ },
      say: "Cornered! \n\nCrush the enemy mecha by deploying a Marine onto its square.",
      emotion: "shocked",
    },
    {
      mark: { squares: ["g2"], gasOnCC: true, arrows: [{ from: "h1", to: "g2" }] },
    },
  ],
} satisfies TutorialStoryScript;
