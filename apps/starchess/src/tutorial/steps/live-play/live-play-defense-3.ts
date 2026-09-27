// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const livePlayDefense3 = {
  id: "live-play-defense-3",
  title: "King Defense III",
  board: {
    scfen: "SCFEN|k7/8/8/8/4n3/8/4PP1P/7K|1|13|P|G:11:11|Q:w:;b:C=e4f2",
    stored: 4,
    endTurnAfterQueue: "moveAndSpecial",
    docs: "Command Center on h1 at HP 1. Black has ne4 pre-queued onto f2 — from there it checks h1 next turn open. Only line: gas the f2 marine (B=stimStep:f2:f3) then Pf3×e4 — the B step lands before the attack phase, so the marine shoots the hoverbike off e4 and black's plan never moves.",
  },
  comment: "",
  emotion: "shocked",
  completeWhen: { kind: "lost", pieces: ["n"] },
  restartWhen: { kind: "lives", own: 0 },
  beats: [
    {
      priority: 2,
      turn: 1,
      when: { kind: "scfen", re: /\|Q:w:;/ },
      say: "That hoverbike will end the game if it reaches f2. \nGas your marine in f2 and attack it before it can move!",
      emotion: "shocked",
    },
    {
      priority: 3,
      when: { kind: "lives", own: 0 },
      say: "The Hoverbike reached f2 and finished the Command Center. \n\nGas the f2 Marine first, then shoot e4.",
      emotion: "shocked",
      action: { kind: "retryLesson", label: "Retry lesson" },
    },
    {
      when: { kind: "scfen", re: /[BF]=stimStep:f2/ },
      say: "Now shoot it off e4!",
      emotion: "watching",
      mark: { squares: ["e4"], arrows: [{ from: "f3", to: "e4" }] },
    },
    {
      mark: { gasSquares: ["f2"] },
    },
  ],
} satisfies TutorialStoryScript;
