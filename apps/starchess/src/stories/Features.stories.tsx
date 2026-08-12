import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { FULL_ARMY_SAMPLE } from "~/demos/samples";
import { GasRack } from "~/presentation/hud/components/GasRack";
import { WithMatchStore, lessonStory } from "~/stories/project";

const meta = {
  title: "Features/GasDeploy",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Footer vespene rack — drag a canister onto a friendly unit to arm its special.",
      },
    },
  },
} satisfies Meta;

export default meta;

export const RackOnly: StoryObj = {
  name: "Rack",
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <div style={{ padding: "2rem", width: "24rem" }}>
        <GasRack />
      </div>
    </WithMatchStore>
  ),
};

export const OnBoard = {
  ...lessonStory("specials", "cc"),
  name: "On board (Command Center)",
};
