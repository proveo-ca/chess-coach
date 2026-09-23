import { onCleanup } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ResignConfirm } from "~/components/atoms/ResignConfirm";
import { setBaseEvalScore } from "~/store/evalStore";
import { setActivePlayerColor } from "~/store/settingsStore";

const meta = {
  title: "Atoms/ResignConfirm",
  component: ResignConfirm,
  args: {
    open: true,
    onClose: () => undefined,
    onConfirm: () => undefined,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResignConfirm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompetitivePosition: Story = {
  render: (args) => {
    setActivePlayerColor("w");
    setBaseEvalScore({ kind: "cp", value: -75 });
    onCleanup(() => setBaseEvalScore(null));
    return <ResignConfirm {...args} />;
  },
};

export const LosingPosition: Story = {
  render: (args) => {
    setActivePlayerColor("w");
    setBaseEvalScore({ kind: "cp", value: -650 });
    onCleanup(() => setBaseEvalScore(null));
    return <ResignConfirm {...args} />;
  },
};
