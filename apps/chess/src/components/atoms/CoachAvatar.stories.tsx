import { onCleanup } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { setCoachEmotion } from "~/store/coachStore";

const meta = {
  title: "Atoms/CoachAvatar",
  component: CoachAvatar,
  parameters: { layout: "centered" },
} satisfies Meta<typeof CoachAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

const withEmotion =
  (emotion: Parameters<typeof setCoachEmotion>[0], compact = false) =>
  () => {
    setCoachEmotion(emotion);
    onCleanup(() => setCoachEmotion("idle"));
    return <CoachAvatar compact={compact} />;
  };

export const Idle: Story = { render: withEmotion("idle") };
export const Watching: Story = { render: withEmotion("watching") };
export const Happy: Story = { render: withEmotion("happy") };
export const Shocked: Story = { render: withEmotion("shocked") };
export const CompactThinking: Story = { render: withEmotion("thinking", true) };

export const Sleeping: Story = {
  args: { sleeping: true },
};
