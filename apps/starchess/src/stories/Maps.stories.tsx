import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MapScreen } from "~/demos/MapScreen";
import type { BoardVariant } from "~/types/board";

/**
 * Terrain gallery — each story mounts MapScreen (Screen grid).
 * Variants: eclipse | butter | vermeer (default eclipse).
 * // SPEC: _spec/apps/ui/responsiveness/rules.md
 */
const meta = {
  title: "StarChess/Maps",
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    boardVariant: {
      control: "select",
      options: ["eclipse", "butter", "vermeer"] satisfies BoardVariant[],
    },
  },
  args: {
    boardVariant: "eclipse" as BoardVariant,
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<{ boardVariant: BoardVariant }>;

export const Eclipse: Story = {
  name: "Eclipse (default)",
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: (args) => <MapScreen boardVariant={args.boardVariant} />,
};

export const Butter: Story = {
  args: { boardVariant: "butter" },
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: (args) => <MapScreen boardVariant={args.boardVariant} />,
};

export const Vermeer: Story = {
  args: { boardVariant: "vermeer" },
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: (args) => <MapScreen boardVariant={args.boardVariant} />,
};

export const EclipseMobile: Story = {
  name: "Eclipse · mobile",
  args: { boardVariant: "eclipse" },
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: (args) => <MapScreen boardVariant={args.boardVariant} />,
};

export const ButterMobile: Story = {
  name: "Butter · mobile",
  args: { boardVariant: "butter" },
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: (args) => <MapScreen boardVariant={args.boardVariant} />,
};

export const VermeerMobile: Story = {
  name: "Vermeer · mobile",
  args: { boardVariant: "vermeer" },
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: (args) => <MapScreen boardVariant={args.boardVariant} />,
};

export const EclipseDynamic: Story = {
  name: "Eclipse · dynamic",
  args: { boardVariant: "eclipse" },
  globals: { viewport: { value: "dynamic", isRotated: false } },
  render: (args) => <MapScreen boardVariant={args.boardVariant} />,
};
