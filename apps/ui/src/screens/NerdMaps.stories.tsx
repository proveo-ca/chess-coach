import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { NerdScreen } from "~/screens/NerdScreen";

const meta = {
  title: "Screens/Nerd/StarChess/Maps",
  component: NerdScreen,
  parameters: {
    layout: "fullscreen",
    route: "/starchess",
  },
  args: {
    boardVariant: "eclipse",
    /** Terrain gallery — not StarChess gameplay; fog stays off. */
    starChessMode: false,
  },
} satisfies Meta<typeof NerdScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Eclipse: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Butter: Story = {
  args: { boardVariant: "butter" },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Vermeer: Story = {
  args: { boardVariant: "vermeer" },
  globals: { viewport: { value: "desktop", isRotated: false } },
};
