import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { LiveLessonHost } from "~/demos/LiveLessonHost";
import { FULL_ARMY_SAMPLE, VERMEER_LIVE_SAMPLE } from "~/demos/samples";
import { ResourceBar } from "~/presentation/hud/components/ResourceBar";
import { TurnBar } from "~/presentation/hud/components/TurnBar";
import { WithMatchStore, sampleStory } from "~/stories/project";

/**
 * Turn chrome + full-army GasDeploy. Boards come from `demos/samples.ts`.
 */
const meta = {
  title: "Features/Turn Chrome",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Stacked above the board (replaces captured pieces): ResourceBar (minerals, vespene, deploy), then TurnBar (queue chips + End + 10s gauge) underneath so chips grow height without shifting the board horizontally. GasDeploy: drag vespene onto a unit for specials. TurnBarSidebar is an experimental vertical rail variation.",
      },
    },
  },
} satisfies Meta;

export default meta;

export const ResourceAndTurn: StoryObj = {
  name: "ResourceBar + TurnBar",
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <div
        style={{
          width: "420px",
          display: "flex",
          "flex-direction": "column",
          "align-items": "stretch",
          gap: "6px",
        }}
      >
        <ResourceBar />
        <TurnBar autoStart={false} resolveOnEnd={false} onEnd={() => undefined} />
      </div>
    </WithMatchStore>
  ),
};

export const TurnSidebarRail = sampleStory(VERMEER_LIVE_SAMPLE, {
  name: "TurnBarSidebar (vertical)",
  docs:
    "Experimental vertical turn chrome in the live side rail (same as `/starchess/single`). Horizontal TurnBar stays unused.",
  boardVariant: "vermeer",
  shell: "vermeer",
  turnChrome: "sidebar",
});

export const GasDeploy: StoryObj = {
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Full army + GasDeploy: pawn / knight / bishop / rook / queen / king specials. Controls → gas (1–3). End to resolve queued actions.",
      },
    },
  },
  args: { gas: 3 },
  argTypes: {
    gas: {
      control: { type: "inline-radio" },
      options: [1, 2, 3],
      description: "Remaining vespene canisters (turn 21 capacity = 3)",
    },
  },
  render: (args) => (
    <LiveLessonHost
      board={FULL_ARMY_SAMPLE}
      gas={Number((args as { gas?: number }).gas) || 3}
    />
  ),
};
