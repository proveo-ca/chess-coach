import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { GameHistoryFilters } from "@chess-coach/ui-web/atoms/GameHistoryFilters";

const meta = {
  title: "Atoms/GameHistoryFilters",
  component: GameHistoryFilters,
  args: {
    colorFilter: "w",
    setColorFilter: () => undefined,
    firstMoveFilter: null,
    setFirstMoveFilter: () => undefined,
    availableFirstMoves: ["e4", "d4", "Nf3"],
    totalPages: 3,
    activePage: 1,
    currentDateLabel: "July 25, 2026",
    goToPrev: () => undefined,
    goToNext: () => undefined,
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof GameHistoryFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractiveFilters: Story = {
  render: () => {
    const [color, setColor] = createSignal<"w" | "b">("w");
    const [firstMove, setFirstMove] = createSignal<string | null>("e4");
    const [page, setPage] = createSignal(1);

    return (
      <div style={{ width: "34rem", "max-width": "90vw" }}>
        <GameHistoryFilters
          colorFilter={color()}
          setColorFilter={setColor}
          firstMoveFilter={firstMove()}
          setFirstMoveFilter={setFirstMove}
          availableFirstMoves={["e4", "d4", "Nf3"]}
          totalPages={3}
          activePage={page()}
          currentDateLabel="July 25, 2026"
          goToPrev={() => setPage((value) => Math.max(0, value - 1))}
          goToNext={() => setPage((value) => Math.min(2, value + 1))}
        />
      </div>
    );
  },
};
