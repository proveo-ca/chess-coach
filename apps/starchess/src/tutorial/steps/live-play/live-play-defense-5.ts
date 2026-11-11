// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const livePlayDefense5 = {
  id: "live-play-defense-5",
  title: "Pawn Gas Defense",
  board: {
    scfen: "SCFEN|7k/8/8/8/1b6/8/2PR4/3K4|11|33|P|G:22:22|Q:w:;b:|S:d2",
    stored: 2,
    endTurnAfterQueue: "moveAndSpecial",
    choreography: "pawnGasDefenseCounter",
    docs: "White Kd1 + sieged Rd2 + Pc2 vs Bb4 + Kh8. Black B b4→d2 queued once on T11. Gas pawn c2→c3 (single step) blocks, gas unsiege d2, then R d2→e2. Win R e2 + K d1; fail R/K missing.",
  },
  comment: "",
  emotion: "shocked",
  completeWhen: {
    kind: "scfen",
    re: /SCFEN\|[^|]*4R3\/3K4\|/,
  },
  restartWhen: {
    kind: "scfen",
    re: /SCFEN\|[^|K]*\||SCFEN\|[^|R]*\|/,
  },
  beats: [
    {
      priority: 2,
      turn: 11,
      when: { kind: "scfen", re: /\|Q:w:;/ },
      say: "That Mecha is gonna get your Tank! \n\nGas your Marine to body-block!",
      emotion: "shocked",
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]*4R3\/3K4\|/ },
      say: "Evacuated!",
      emotion: "happy",
    },
    {
      priority: 3,
      when: { kind: "scfen", re: /SCFEN\|[^|K]*\||SCFEN\|[^|R]*\|/ },
      say: "The Mecha broke through. \n\nGas the c2 Marine forward to block, then get the Tank out.",
      emotion: "shocked",
      action: { kind: "retryLesson", label: "Retry lesson" },
    },
    {
      when: { kind: "scfen", re: /[BF]=siegeMode:d2/ },
      say: "Now move your tank out of danger!",
      emotion: "watching",
      mark: { squares: ["e2"], arrows: [{ from: "d2", to: "e2" }] },
    },
    {
      when: { kind: "scfen", re: /[BF]=stimStep:c2/ },
      say: "Now, unsiege your tank by dropping a gas canister on it.",
      emotion: "watching",
      mark: { gasSquares: ["d2"] },
    },
    {
      mark: {
        gasSquares: ["c2"],
        arrows: [
          { from: "c2", to: "c3" },
          { from: "b4", to: "d2" },
        ],
      },
    },
  ],
} satisfies TutorialStoryScript;
