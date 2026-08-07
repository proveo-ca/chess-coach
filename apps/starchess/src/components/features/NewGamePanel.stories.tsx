import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, type Component } from "solid-js";

import { NewGamePanel } from "~/components/features/NewGamePanel";
import { MenuSkyBackdrop } from "~/screens/menuSky/MenuSkyBackdrop";

const meta = {
  title: "Screens/Menu",
  component: NewGamePanel,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Single Player setup: MAP (Eclipse / Butter / Vermeer), TEAM (Blue / Red), locked Adjutant (Script), START.",
      },
    },
  },
} satisfies Meta<typeof NewGamePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const OpenPanel: Component = () => {
  const [open, setOpen] = createSignal(true);
  const [last, setLast] = createSignal("—");

  return (
    <div style={{ position: "relative", width: "100%", "min-height": "100vh" }}>
      <MenuSkyBackdrop world="eclipse" />
      <NewGamePanel
        open={open()}
        onClose={() => setOpen(false)}
        onStart={(opts) => {
          setLast(`${opts.map} / ${opts.team === "w" ? "blue" : "red"}`);
          setOpen(false);
        }}
      />
      <button
        type="button"
        data-testid="reopen-new-game"
        style={{
          position: "fixed",
          bottom: "1rem",
          left: "1rem",
          "z-index": "5",
          padding: "0.5rem 0.85rem",
          "font-family": "ui-sans-serif, system-ui, sans-serif",
          "text-transform": "none",
        }}
        onClick={() => setOpen(true)}
      >
        Open setup (last: {last()})
      </button>
    </div>
  );
};

export const SinglePlayerSetup: Story = {
  name: "Single Player setup",
  render: () => <OpenPanel />,
  args: {
    open: true,
    onClose: () => undefined,
    onStart: () => undefined,
  },
};
