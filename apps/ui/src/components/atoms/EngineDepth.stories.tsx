import { onCleanup } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { EngineDepth } from "~/components/atoms/EngineDepth";
import { setBaseEvalDepth } from "~/store/evalStore";

const meta = {
  title: "Atoms/EngineDepth",
  component: EngineDepth,
  parameters: { layout: "centered" },
} satisfies Meta<typeof EngineDepth>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Analyzing: Story = {
  render: () => {
    setBaseEvalDepth(18);
    onCleanup(() => setBaseEvalDepth(0));
    return <EngineDepth />;
  },
};

export const Idle: Story = {
  render: () => {
    setBaseEvalDepth(0);
    return <EngineDepth />;
  },
};
