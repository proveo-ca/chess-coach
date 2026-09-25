// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

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
  completeWhen: {
    kind: "scfen",
    re: /SCFEN\|[^|]*Q[^|]*\|(?:2[2-9]|[3-9]\d+)/,
  },
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
      when: { kind: "scfen", re: /tacticalJump:/ },
      say: "Lightspeed escape!",
      emotion: "shocked",
    },
  ],
} satisfies TutorialStoryScript;
