// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";
import { and, not } from "~/tutorial/when";

export const cc = {
  id: "cc",
  title: "Command Center",
  board: {
    scfen: "SCFEN|r6k/8/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    stored: 12,
    endTurnAfterQueue: "first",
    armTimer: false,
    docs: "1. Drag gas onto the command center on e1 \u2192 DeployModal. 2. Pick a unit. 3. Tap an adjacent empty square \u2014 queued spawn \u00b7 End to drop.",
  },
  comment: "The Command Center can deploy units! Often the best gas use. \n\nSee that gas canister in the bottom? Drag and drop it into your Command Center.",
  emotion: "watching",
  completeWhen: {
    kind: "queue",
    specialKind: "deploy",
  },
  beats: [
    {
      // SCFEN field 3 is `<white lives><black lives>` (codec.ts) — the
      // second digit alone, so a chip to *our* Command Center does not
      // fire this. Black is the enemy here; the viewer is white.
      when: { kind: "scfen", re: /SCFEN\|[^|]+\|[^|]+\|\d2\|/ },
      say: "I'll explain attacks and King Damage later.",
      emotion: "watching",
    },
    {
      when: and(
        not({ kind: "targeting", targetingKind: "deploy" }),
        not({ kind: "scfen", re: /[BF]=deploy:/ }),
      ),
      mark: { gasSquares: ["e1"] },
    },
    {
      mark: {},
    },
  ],
} satisfies TutorialStoryScript;
