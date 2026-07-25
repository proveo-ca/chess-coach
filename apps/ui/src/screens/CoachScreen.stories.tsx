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

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Dynamic: Story = {
  globals: { viewport: { value: "dynamic", isRotated: false } },
};
