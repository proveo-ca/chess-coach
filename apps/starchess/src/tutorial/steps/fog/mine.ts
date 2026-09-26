// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const mine = {
  id: "mine",
  title: "Spider Mine",
  board: {
    scfen: "SCFEN|r6k/8/8/8/8/8/1N1PPP2/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:a4;b:c3e4",
    stored: 4,
    endTurnAfterQueue: "first",
    armTimer: false,
    choreography: "mineRa1Counter",
    docs: "Marines d2/e2/f2 + hoverbike b2 for vision, white mine a4 vs black mines c3/e4 + tank a8. Walk e2-e4, attack c3, then turn 3 auto-ends as black Ra1 trips the a4 mine.",
  },
  comment: "See what happens if a piece walks over that mine",
  emotion: "happy",
  beats: [
    {
      priority: 1,
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|(?:[3-9]|\d\d+)\|/ },
      say: "You have seen how Starchess pieces see, attack and move. Let's explore how specials are used and planned!",
      emotion: "happy",
      action: { kind: "goSection", section: "specials", label: "Next Section" },
    },
    {
      turn: 2,
      say: "See what happens when exploring the fog uncovers a mine",
      emotion: "watching",
    },
    {
      turn: 1,
      say: "Mines can be targetted for attack",
      emotion: "watching",
    },
    {
      turn: 1,
      mark: { squares: ["c3"], arrows: [{ from: "d2", to: "c3" }] },
    },
    {
      turn: 0,
      mark: { squares: ["e4"], arrows: [{ from: "e2", to: "e4" }] },
    },
    {
      mark: { squares: [] },
    },
  ],
} satisfies TutorialStoryScript;
