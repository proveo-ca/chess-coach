import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Input } from "@chess-coach/ui-web/primitives/Input";

const meta = {
  title: "Primitives/Input",
  component: Input,
  args: {
    placeholder: "Paste a FEN or PGN",
    "aria-label": "Position notation",
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithValue: Story = {
  args: {
    value: "1. e4 e5 2. Nf3 Nc6",
  },
};

export const Disabled: Story = {
  args: {
    value: "Engine is loading…",
    disabled: true,
  },
};

export const Invalid: Story = {
  args: {
    value: "not a valid position",
    "aria-invalid": true,
  },
};
