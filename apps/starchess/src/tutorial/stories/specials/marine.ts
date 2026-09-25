// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const marine = {
  id: "marine",
  title: "Marine",
  board: {
    scfen: "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:11:11|Q:w:;b:",
    stored: 4,
    endTurnAfterQueue: "moveAndSpecial",
    armTimer: false,
    docs: "Turn 1: move, then gas (order matters not). Turn 2: gas first for the slip-away, then move off the ghost \u00b7 End to resolve.",
  },
  comment: "Order a Marine to move.",
  emotion: "idle",
  completeWhen: {
    kind: "scfen",
    re: /SCFEN\|[^|]+\|(?:[3-9]|\d\d+)\|/,
  },
  /*
   * Four beats across two turns — turn 1 moves then gasses, turn 2
   * gasses then moves off the ghost. First match wins, so these run
   * most-specific first. The seed opens on SCFEN turn 1, so the second
   * window is turn field `2` and the lesson ends on field `3`.
   */
  beats: [
    {
      // Turn-2 gas queued — the transparent ghost marks where the Marine
      // lands after the Extra Step; the follow-up classical starts there.
      when: { kind: "scfen", re: /^(?=SCFEN\|[^|]+\|2\|)(?=.*[BF]=stimStep:)/ },
      say: "Now click that gas-ghost Marine and queue a move intent",
      emotion: "watching",
    },
    {
      // Turn-1 gas queued, before or after the move.
      when: { kind: "scfen", re: /^(?=SCFEN\|[^|]+\|1\|)(?=.*[BF]=stimStep:)/ },
      say: "Oh, yeah!",
      emotion: "watching",
    },
    {
      // Second planning window, no gas yet — teach the slip-away.
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|2\|/ },
      say: "Now the slipping away technique, drop a gas canister in your Marine",
      emotion: "scanning",
    },
    {
      // Turn-1 classical queued from a Marine square (d2 / e3 on this
      // seed); the King on e1 cannot match. First match wins, so once
      // gas is queued the cheer above takes over.
      when: { kind: "scfen", re: /^(?=SCFEN\|[^|]+\|1\|)(?=.*Q:w:[^;]*C=[de][23])/ },
      say: "You just queued an intent! \nIt looks like a ghost. \n\nSee that gas canister in the bottom? Drag and drop it into that transparent Marine.",
      emotion: "idle",
    },
    {
      when: { kind: "scfen", re: /^(?=SCFEN\|[^|]+\|2\|)(?=.*[BF]=stimStep:)/ },
      mark: { squares: ["e5"], arrows: [{ from: "e4", to: "e5" }] },
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|2\|/ },
      mark: { squares: ["e3"] },
    },
    {
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|1\|/ },
      mark: { squares: ["d4"], arrows: [{ from: "d2", to: "d4" }] },
    },
    {
      mark: { squares: [] },
    },
  ],
} satisfies TutorialStoryScript;
