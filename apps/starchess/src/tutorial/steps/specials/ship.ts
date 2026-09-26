// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";
import { and, not } from "~/tutorial/when";

export const ship = {
  id: "ship",
  title: "BattleShip",
  board: {
    scfen: "SCFEN|k6b/8/8/8/8/8/8/Q6K|21|33|P|G:31:33|Q:w:;b:B=charonMissiles:h8:a1",
    stored: 4,
    endTurnAfterQueue: "first",
    armTimer: false,
    docs: "Tactical Jump costs 3 vespene: drag onto the BattleShip to arm targeting, click a highlighted visible empty square, then End to resolve.",
  },
  comment: "The BattleShip can teleport anywhere visible in the map in an instant. \nGassing it takes all 3 canisters.",
  emotion: "watching",
  restartWhen: {
    kind: "scfen",
    re: /SCFEN\|[^|Q]*\|(?:2[2-9]|[3-9]\d+)/,
  },
  beats: [
    {
      when: { kind: "scfen", re: /SCFEN\|[^|Q]*\|(?:2[2-9]|[3-9]\d+)/ },
      say: "Bruh",
      emotion: "watching",
    },
    {
      priority: 1,
      phase: "resolve",
      when: { kind: "scfen", re: /^SCFEN\|[^|]*Q[^|]*\|(?:(?:2[2-9]|[3-9]\d+)\||.*tacticalJump:)/ },
      say: "Lightspeed escape!",
      emotion: "shocked",
      holdMs: 600,
    },
    {
      priority: 1,
      phase: "intent",
      when: { kind: "scfen", re: /SCFEN\|[^|]*Q[^|]*\|(?:2[2-9]|[3-9]\d+)/ },
      say: "You have learned how to combine specials, and attack/moves. \nLet's Observe how turns resolve!",
      emotion: "happy",
      action: { kind: "goSection", section: "resolve", label: "Next Section" },
    },
    {
      when: and(
        { kind: "board", at: { a1: "Q" } },
        not({ kind: "targeting", targetingKind: "tacticalJump" }),
        not({ kind: "scfen", re: /tacticalJump:/ }),
      ),
      mark: { gasSquares: ["a1"] },
    },
    {
      mark: {},
    },
  ],
} satisfies TutorialStoryScript;
