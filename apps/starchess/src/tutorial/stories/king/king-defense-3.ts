// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const kingDefense3 = {
  id: "king-defense-3",
  title: "King Defense III",
  board: {
    scfen: "SCFEN|k7/8/8/8/4n3/8/4PP1P/7K|1|13|P|G:11:11|Q:w:;b:C=e4f2",
    stored: 4,
    endTurnAfterQueue: "moveAndSpecial",
    docs: "Command Center on h1 at HP 1. Black has ne4 pre-queued onto f2 — from there it checks h1 next turn open. Only line: gas the f2 marine (B=stimStep:f2:f3) then Pf3×e4 — the B step lands before the attack phase, so the marine shoots the hoverbike off e4 and black's plan never moves.",
  },
  comment: "That hoverbike will end the game if it reaches f2. \nGas your marine in f2 and attack it before it can move!",
  emotion: "shocked",
  completeWhen: { kind: "lost", pieces: ["n"] },
  restartWhen: { kind: "lives", own: 0 },
  beats: [
    {
      when: { kind: "lives", own: 0 },
      say: "Bruh",
      emotion: "watching",
    },
    {
      when: { kind: "scfen", re: /[BF]=stimStep:f2/ },
      say: "Now shoot it off e4!",
      emotion: "watching",
    },
    {
      when: { kind: "scfen", re: /[BF]=stimStep:f2/ },
      mark: { squares: ["e4"], arrows: [{ from: "f3", to: "e4" }] },
    },
    {
      mark: { squares: ["f2"] },
    },
  ],
} satisfies TutorialStoryScript;
