import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";

import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { Breadcrumb } from "~/components/primitives/Breadcrumb";

const TUTORIAL_STAGES = [
  { id: "fog", label: "Fog of War" },
  { id: "specials", label: "Special Moves" },
  { id: "resolve", label: "Turn Resolution" },
  { id: "king", label: "King Damage" },
] as const;

const meta = {
  title: "Primitives/Breadcrumb",
  component: Breadcrumb,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Clickable stage trail. Tutorial places it under Kerrigan (`CoachAvatar`).",
      },
    },
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TutorialStages: Story = {
  args: {
    items: [...TUTORIAL_STAGES],
    current: "fog",
  },
  render: () => {
    const [current, setCurrent] = createSignal<(typeof TUTORIAL_STAGES)[number]["id"]>(
      "fog",
    );
    return (
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          gap: "0.75rem",
          width: "min(36rem, 92vw)",
        }}
        data-helm-ferry-stage
      >
        <CoachAvatar identity="kerrigan" />
        <Breadcrumb
          items={TUTORIAL_STAGES}
          current={current()}
          onSelect={setCurrent}
          aria-label="Tutorial sections"
        />
      </div>
    );
  },
};

export const MidTrail: Story = {
  args: {
    items: [...TUTORIAL_STAGES],
    current: "resolve",
  },
};
