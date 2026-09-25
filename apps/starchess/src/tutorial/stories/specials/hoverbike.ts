// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const hoverbike = {
  id: "hoverbike",
  title: "Hoverbike",
  board: {
    scfen: "SCFEN|4k3/8/8/8/3N4/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    stored: 4,
    endTurnAfterQueue: "moveAndSpecial",
    armTimer: false,
    docs: "Drag gas onto the knight to queue a Spider Mine on its square \u00b7 End to drop. Stack order: gas then move, or move then gas.",
  },
  comment: "Drop a gas canister on that Hoverbike.",
  emotion: "scanning",
  // Two mines on the board (`M:w:` holds a square per mine).
  completeWhen: {
    kind: "scfen",
    re: /M:w:(?:[a-h][1-8]){2}/,
  },
  /*
   * Four beats across two turns — gas *then* move, then move *then* gas —
   * so the lesson shows the order does not matter. First match wins, so
   * these run most-specific first. Turn is SCFEN field 2.
   *
   * The second-turn prompt is pinned to turn `2` rather than "any turn but
   * the first": it announces the new turn, so repeating it on 3 and 4 (a
   * mine landing on a square that already held one leaves the objective
   * unmet) reads like the lesson restarting. Those later turns fall through
   * to the queued-intent beat above, or hold the last line — `holdTutorialLine`
   * keeps the previous reaction sticky rather than going quiet.
   */
  beats: [
    {
      // Closing line once both mines are down; the file count is live.
      when: { kind: "mineGuard" },
      say: "1 unit guarding 4 promoting files!",
      emotion: "happy",
    },
    {
      when: {
        kind: "scfen",
        re: /^(?=SCFEN\|[^|]+\|(?!1\|)\d+\|)(?=.*Q:w:[^;]*C=)/,
      },
      say: "Now drop the gas canister on that transparent Hoverbike, it describes where will it be after moving; and let the turn finish.",
      emotion: "watching",
    },
    {
      when: { kind: "scfen", re: /^SCFEN\|[^|]+\|2\|/ },
      say: "New turn, new mine.\nMove your Hoverbike",
      emotion: "scanning",
    },
    {
      when: { kind: "scfen", re: /^(?=SCFEN\|[^|]+\|1\|)(?=.*[BF]=spiderMine:)/ },
      say: "You have queued a mine intent! \nNow move and let the turn finish",
      emotion: "happy",
    },
    {
      // Off-script: moved before gassing on turn 1. Without this the
      // bubble goes silent (holdTutorialLine will not revive an intro
      // once the player has acted), so restate the ask.
      when: { kind: "scfen", re: /^(?=SCFEN\|[^|]+\|1\|)(?=.*Q:w:[^;]*C=)/ },
      say: "Drop a gas canister on that Hoverbike.",
      emotion: "scanning",
    },
    /*
     * d4 → c2 → a1: the two hops that, with a mine on each turn, leave one
     * Hoverbike watching the a–d files. The closing step rings the mines
     * and draws where the Hoverbike can strike from where it stopped.
     */
    { when: { kind: "mineGuard" }, mark: {} },
    {
      when: {
        kind: "scfen",
        re: /^SCFEN\|(?:[^/]*\/){6}2N[^/|]*\/[^|]*\|2\|/,
      },
      mark: { squares: ["a1"], arrows: [{ from: "c2", to: "a1", via: "a2" }] },
    },
    {
      when: {
        kind: "scfen",
        re: /^SCFEN\|(?:[^/]*\/){4}3N[^|]*\|1\|/,
      },
      mark: { squares: ["c2"], arrows: [{ from: "d4", to: "c2", via: "d2" }] },
    },
  ],
} satisfies TutorialStoryScript;
