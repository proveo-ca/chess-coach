import { For } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import {
  BackArrowIcon,
  BookIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CogIcon,
  DiceIcon,
  FlagIcon,
  FlipBoardIcon,
  HamburgerIcon,
  HintIcon,
  PlusCircleIcon,
  SearchIcon,
  ShareIcon,
  SignalIcon,
  StarIcon,
} from "~/components/primitives/icons";

const icons = [
  ["Back arrow", BackArrowIcon],
  ["Book", BookIcon],
  ["Check", CheckIcon],
  ["Chevron left", ChevronLeftIcon],
  ["Chevron right", ChevronRightIcon],
  ["Cog", CogIcon],
  ["Dice", DiceIcon],
  ["Flag", FlagIcon],
  ["Flip board", FlipBoardIcon],
  ["Hamburger", HamburgerIcon],
  ["Hint", HintIcon],
  ["Plus circle", PlusCircleIcon],
  ["Search", SearchIcon],
  ["Share", ShareIcon],
  ["Signal", SignalIcon],
  ["Star", StarIcon],
] as const;

const meta = {
  title: "Primitives/Icons",
  component: ChevronLeftIcon,
  args: { size: 28 },
} satisfies Meta<typeof ChevronLeftIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: (args) => (
    <div
      style={{
        display: "grid",
        "grid-template-columns": "repeat(auto-fit, minmax(120px, 1fr))",
        gap: "20px",
        color: "var(--text-primary, #f5f5f5)",
      }}
    >
      <For each={icons}>
        {([name, Icon]) => (
          <div
            style={{
              display: "grid",
              gap: "8px",
              "justify-items": "center",
              padding: "16px",
              border: "1px solid var(--border-color, #555)",
              "border-radius": "8px",
            }}
          >
            <Icon size={args.size} />
            <span>{name}</span>
          </div>
        )}
      </For>
    </div>
  ),
};

export const Large: Story = {
  args: { size: 64 },
};
