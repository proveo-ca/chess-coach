import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Collapsible } from "@chess-coach/ui-web/primitives/Collapsible";

const meta = {
  title: "Primitives/Collapsible",
  component: Collapsible,
  args: {
    title: "Connect to the same network",
    index: 1,
    open: true,
    onToggle: () => undefined,
    children: <p>Both players must be reachable over the local or private network.</p>,
  },
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: (args) => {
    const [open, setOpen] = createSignal(args.open);
    return <Collapsible {...args} open={open()} onToggle={() => setOpen((value) => !value)} />;
  },
};

export const Completed: Story = {
  args: {
    title: "Invite accepted",
    done: true,
    open: false,
  },
};

export const Disabled: Story = {
  args: {
    title: "Start the match",
    index: 3,
    open: false,
    disabled: true,
  },
};
