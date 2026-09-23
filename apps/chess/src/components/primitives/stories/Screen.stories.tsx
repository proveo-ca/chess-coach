import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Screen } from "@chess-coach/ui-web/primitives/Screen";

const panelStyle = {
  display: "grid",
  "place-items": "center",
  padding: "16px",
  border: "1px dashed var(--border-color, #777)",
  "border-radius": "8px",
} as const;

const meta = {
  title: "Primitives/Screen",
  component: Screen,
  parameters: { layout: "fullscreen" },
  args: { highlight: false },
} satisfies Meta<typeof Screen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GameplayLayout: Story = {
  render: (args) => (
    <Screen {...args}>
      <Screen.Header>
        <div style={panelStyle}>Coach header</div>
      </Screen.Header>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div style={{ ...panelStyle, "min-height": "360px" }}>Board column</div>
        </Screen.BoardColumn>
        <aside style={panelStyle}>Sidebar</aside>
      </Screen.BoardArea>
      <Screen.Footer>
        <div style={panelStyle}>Coach panel / move list</div>
      </Screen.Footer>
    </Screen>
  ),
};

export const AnalysisLayout: Story = {
  args: { highlight: true },
  render: (args) => (
    <Screen {...args}>
      <Screen.SidebarInset>
        <div style={panelStyle}>Analysis toolbar</div>
      </Screen.SidebarInset>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div style={{ ...panelStyle, "min-height": "360px" }}>Analysis board</div>
        </Screen.BoardColumn>
        <aside style={panelStyle}>Engine controls</aside>
      </Screen.BoardArea>
      <Screen.Footer>
        <div style={panelStyle}>Move timeline</div>
      </Screen.Footer>
    </Screen>
  ),
};
