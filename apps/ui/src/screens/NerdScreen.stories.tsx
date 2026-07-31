import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { NerdScreen } from "~/screens/NerdScreen";

const meta = {
  title: "Screens/Nerd",
  component: NerdScreen,
  parameters: {
    layout: "fullscreen",
    route: "/broodwar",
  },
  args: {
    boardVariant: "eclipse",
  },
} satisfies Meta<typeof NerdScreen>;

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
