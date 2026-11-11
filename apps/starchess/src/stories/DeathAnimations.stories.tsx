import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { DeathBoardDemo } from "~/presentation/animations/components/DeathBoardDemo";
import type { DeathSubject } from "~/types/cues";

/**
 * One death per unit on d4, looping idle → dying → gone.
 * `DeathBoardDemo` owns the board and the loop; a story only names the subject.
 * Every unit but the Command Center scatters shards (`dyingDrama` → `shardFly`);
 * the CC collapses into rubble instead, and the Marine shreds inside its bubble.
 * // SPEC: _spec/apps/starchess/demos.puml, _spec/apps/starchess/vfx-guarantees.md
 */
const meta = {
  title: "StarChess/Death Animations",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Store-free AnimationStage + `deathCues`. Each story holds the intact hull, plays the death for `DEATH_MS`, then holds the empty square before looping. The Siege Tank shows both modes at once (tank c4 / siege e4). The spider mine is not a unit — it rides an SCFEN snapshot and darkens its glyph through `spentMines`, the same handoff a real resolve makes.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const deathStory = (subject: DeathSubject, opts: { name: string; docs: string }): Story => ({
  name: opts.name,
  parameters: {
    layout: "fullscreen",
    docs: { description: { story: opts.docs } },
  },
  render: () => <DeathBoardDemo subject={subject} />,
});

export const Marine: Story = deathStory("p", {
  name: "Marine",
  docs:
    "Outward soap-film bubble (`bubbleRingOut` / `bubbleShineOut`) with the body shredding inside it — the one death that is not a shard scatter.",
});

export const Hoverbike: Story = deathStory("n", {
  name: "Hoverbike",
  docs: "Eight body parts peel apart on their own vectors after the boom flash.",
});

export const Mecha: Story = deathStory("b", {
  name: "Mecha",
  docs: "Chassis and shoulder pods scatter; the Charon launcher goes with them.",
});

export const SiegeTank: Story = deathStory("r", {
  name: "Siege Tank (both modes)",
  docs:
    "Two cues in one window: tank mode on c4, siege mode on e4, so the mode-specific wrecks can be compared side by side.",
});

export const BattleShip: Story = deathStory("q", {
  name: "BattleShip",
  docs: "Ten-shard hull break-up — the widest scatter of the roster.",
});

export const CommandCenter: Story = deathStory("k", {
  name: "Command Center",
  docs:
    "No scatter: the hull settles into rubble (`rubbleCollapse`) and stays visible, with a softer flash than an explosion.",
});

export const SpiderMine: Story = deathStory("mine", {
  name: "Spider Mine",
  docs:
    "Crown cracks open, legs peel off, and the Hoverbike's frag boom fires in place — brief and translucent so it never curtains the scatter. Observer vision, since player fog would hide an enemy mine on an unlit tile.",
});
