import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, type Component } from "solid-js";

import { ColorSwatch } from "@chess-coach/ui-web/atoms/ColorSwatch";
import { MatchHistoryFilters } from "@chess-coach/ui-web/atoms/MatchHistoryFilters";
import type { StarChessColor } from "@chess-coach/starchess-core";

const meta = {
  title: "Atoms/MatchHistoryFilters",
  component: MatchHistoryFilters,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
} satisfies Meta<typeof MatchHistoryFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

const Harness: Component = () => {
  const [color, setColor] = createSignal<StarChessColor>("w");
  const [page, setPage] = createSignal(0);
  const labels = ["Aug 8, 2026", "Aug 1, 2026"];
  return (
    <div style={{ padding: "1.5rem", background: "#0e151c", color: "#e8eaed" }}>
      <MatchHistoryFilters
        colorFilter={color()}
        setColorFilter={(v) => {
          setColor(v);
          setPage(0);
        }}
        totalPages={labels.length}
        activePage={page()}
        currentDateLabel={labels[page()]!}
        goToPrev={() => setPage((p) => Math.max(0, p - 1))}
        goToNext={() => setPage((p) => Math.min(labels.length - 1, p + 1))}
      />
      <div style={{ "margin-top": "1rem", display: "flex", gap: "0.5rem" }}>
        <ColorSwatch color="w" />
        <ColorSwatch color="b" />
      </div>
    </div>
  );
};

export const Default: Story = {
  args: {
    colorFilter: "w",
    setColorFilter: () => undefined,
    totalPages: 2,
    activePage: 0,
    currentDateLabel: "Aug 8, 2026",
    goToPrev: () => undefined,
    goToNext: () => undefined,
  },
  render: () => <Harness />,
};
