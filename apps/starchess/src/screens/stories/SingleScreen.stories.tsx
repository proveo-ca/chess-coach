import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { SingleScreen } from "~/screens/SingleScreen.tsx";
import { clearMatchSession } from "~/store/matchSessionStore";

const meta = {
  title: "Screens/Single",
  component: SingleScreen,
  parameters: {
    layout: "fullscreen",
    route: "/single?map=eclipse&team=w",
    docs: {
      description: {
        component:
          "Live single-player match (`/single?map=&team=`). Adjutant plays the opposite color; ResourceBar + TurnBarSidebar + GasDeploy on the Screen grid.",
      },
    },
  },
} satisfies Meta<typeof SingleScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fresh Eclipse match as Blue. Switch Desktop / Mobile / Dynamic via the viewport toolbar. */
export const Default: Story = {
  render: () => {
    clearMatchSession();
    return <SingleScreen />;
  },
};

/** Vermeer map as Red (Black). */
export const VermeerRed: Story = {
  name: "Vermeer · Red",
  parameters: { route: "/single?map=vermeer&team=b" },
  render: () => {
    clearMatchSession();
    return <SingleScreen />;
  },
};
