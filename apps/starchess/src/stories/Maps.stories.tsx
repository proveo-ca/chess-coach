import type { Meta, StoryObj } from "storybook-solidjs-vite";

import type { BoardVariant } from "~/presentation/board/EclipseBoard";
import { StaticScfenBoard } from "~/presentation/board/StaticScfenBoard";
import { mapFixture } from "~/stories/fixtures/scenarios";

/**
 * Terrain gallery — eclipse | butter | vermeer only (default eclipse).
 * Stories select boardVariant; SCFEN lives in fixtures.
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

const MapBoard = (props: { boardVariant: BoardVariant }) => {
  const fixture = mapFixture(props.boardVariant);
  return (
    <StaticScfenBoard
      scfen={fixture.scfen}
      fog={fixture.fog}
      visionMode={fixture.visionMode}
      boardVariant={fixture.boardVariant}
    />
  );
};

export const Eclipse: Story = {
  name: "Eclipse (default)",
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: (args) => <MapBoard boardVariant={args.boardVariant} />,
};

export const Butter: Story = {
  args: { boardVariant: "butter" },
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: (args) => <MapBoard boardVariant={args.boardVariant} />,
};

export const Vermeer: Story = {
  args: { boardVariant: "vermeer" },
  globals: { viewport: { value: "desktop", isRotated: false } },
  render: (args) => <MapBoard boardVariant={args.boardVariant} />,
};

export const EclipseMobile: Story = {
  name: "Eclipse · mobile",
  args: { boardVariant: "eclipse" },
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: (args) => <MapBoard boardVariant={args.boardVariant} />,
};

export const ButterMobile: Story = {
  name: "Butter · mobile",
  args: { boardVariant: "butter" },
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: (args) => <MapBoard boardVariant={args.boardVariant} />,
};

export const VermeerMobile: Story = {
  name: "Vermeer · mobile",
  args: { boardVariant: "vermeer" },
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: (args) => <MapBoard boardVariant={args.boardVariant} />,
};

export const EclipseDynamic: Story = {
  name: "Eclipse · dynamic",
  args: { boardVariant: "eclipse" },
  globals: { viewport: { value: "dynamic", isRotated: false } },
  render: (args) => <MapBoard boardVariant={args.boardVariant} />,
};
