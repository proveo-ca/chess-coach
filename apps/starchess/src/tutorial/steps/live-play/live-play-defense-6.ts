// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const livePlayDefense6 = {
  id: "live-play-defense-6",
  title: "Ship Snipe Defense",
  board: {
    scfen: "SCFEN|7k/8/8/3q4/4B3/8/5b1P/4N2K|21|13|P|G:33:33|Q:w:;b:",
    stored: 0,
    endTurnAfterQueue: "moveAndSpecial",
    choreography: "shipSnipeCounter",
    objective: "Catch the jump: Be4 to g2, then snipe f1 after it lands.",
    docs: "Ally CC h1 at HP 1 with g1/f1 free. Enemy ship warps to f1 in B phase. Move Be4→g2, then F snipe g2→f1 in the 2nd gas phase to catch it post-jump. White marine h2 holds the flank; ally hoverbike e1 screens the base. Enemy mecha f2 spots the jump square.",
  },
  comment: "That ship is jumping to f1 for your base! Move your Mecha to g2 first.",
  emotion: "shocked",
  completeWhen: { kind: "lost", pieces: ["q", "Q"] },
  restartWhen: { kind: "lives", own: 0 },
  beats: [
    {
      when: { kind: "lost", pieces: ["q", "Q"] },
      say: "Lightspeed blunder!",
      emotion: "happy",
    },
    {
      when: { kind: "lives", own: 0 },
      say: "Bruh",
      emotion: "watching",
    },
    {
      when: { kind: "targeting", targetingKind: "charonMissiles" },
      say: "Target f1. \n\nSneaky BattleShip will arrive to flying missiles.",
      emotion: "scanning",
      mark: { squares: ["f1"], arrows: [{ from: "g2", to: "f1" }] },
    },
    {
      when: { kind: "scfen", re: /charonMissiles:/ },
      say: "Locked on f1, end your turn!",
      emotion: "happy",
      mark: { squares: ["f1"], arrows: [{ from: "g2", to: "f1" }] },
    },
    {
      when: { kind: "scfen", re: /Q:w:[^;]*C=e4g2/ },
      say: "Now gas the Mecha ghost.",
      emotion: "scanning",
      mark: { squares: ["f1"], gasSquares: ["g2"], arrows: [{ from: "g2", to: "f1" }] },
    },
    {
      when: { kind: "scfen", re: /tacticalJump:/ },
      say: "I doubt the opponent wants to trade their BattleShip for your Mecha... \n\nMove your Mecha to g2.",
      emotion: "thinking",
    },
    {
      mark: {
        squares: ["f1", "g2"],
        arrows: [
          { from: "e4", to: "g2" },
          { from: "g2", to: "f1" },
        ],
      },
    },
  ],
} satisfies TutorialStoryScript;
