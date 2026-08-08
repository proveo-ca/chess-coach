import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { CoachScreen } from "~/screens/CoachScreen";

const meta = {
  title: "Screens/Coach",
  component: CoachScreen,
  parameters: {
    layout: "fullscreen",
    route: "/selena",
  },
} satisfies Meta<typeof CoachScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {};
