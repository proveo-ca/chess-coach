import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { NeonModal } from "@chess-coach/ui-web/atoms/NeonModal";

const meta = {
  title: "Atoms/NeonModal",
  component: NeonModal,
  args: {
    open: true,
    onClose: () => undefined,
    title: "Neon Modal",
    children: "Shared Brood War chrome for menu modals.",
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NeonModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = { args: { size: "md" } };

export const Large: Story = { args: { size: "lg", title: "Credits" } };
