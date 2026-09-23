import { For } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { CoachEmotionIcon } from "@chess-coach/ui-web/primitives/CoachEmotionIcon";
import type { CoachIconEmotion } from "~/types/coach";

const emotions: CoachIconEmotion[] = ["happy", "shocked", "thinking", "shrug"];

const meta = {
  title: "Primitives/CoachEmotionIcon",
  component: CoachEmotionIcon,
  args: {
    emotion: "happy",
    size: 28,
  },
  argTypes: {
    emotion: { control: "select", options: emotions },
  },
} satisfies Meta<typeof CoachEmotionIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Happy: Story = {};

export const Gallery: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "20px", "flex-wrap": "wrap" }}>
      <For each={emotions}>
        {(emotion) => (
          <div style={{ display: "grid", gap: "6px", "justify-items": "center" }}>
            <CoachEmotionIcon emotion={emotion} size={args.size} />
            <span>{emotion}</span>
          </div>
        )}
      </For>
    </div>
  ),
};

export const CustomAccessibleTitle: Story = {
  args: {
    emotion: "thinking",
    size: 48,
    title: "Coach is calculating",
  },
};
