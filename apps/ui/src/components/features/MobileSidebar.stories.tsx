import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { MobileSidebar } from "~/components/features/MobileSidebar";
import { IconButton } from "~/components/primitives/IconButton";
import { HamburgerIcon, HintIcon, SearchIcon } from "~/components/primitives/icons";

const controls = (
  <>
    <MobileSidebar.Item drawer>
      <IconButton aria-label="Open menu">
        <HamburgerIcon />
      </IconButton>
    </MobileSidebar.Item>
    <MobileSidebar.Main>
      <strong>Coach Selena</strong>
    </MobileSidebar.Main>
    <MobileSidebar.Item>
      <IconButton aria-label="Get a hint">
        <HintIcon />
      </IconButton>
    </MobileSidebar.Item>
    <MobileSidebar.Item nav>
      <IconButton aria-label="Open analysis">
        <SearchIcon />
      </IconButton>
    </MobileSidebar.Item>
  </>
);

const meta = {
  title: "Features/MobileSidebar",
  component: MobileSidebar,
  parameters: { layout: "fullscreen" },
  args: { children: controls },
  render: (args) => (
    <div style={{ padding: "1rem 0" }}>
      <MobileSidebar {...args}>{args.children}</MobileSidebar>
    </div>
  ),
} satisfies Meta<typeof MobileSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch Desktop / Mobile / Dynamic via the Storybook viewport toolbar. */
export const Default: Story = {
};

export const ReviewToolbar: Story = {
  args: {
    toolbar: true,
    children: (
      <>
        <MobileSidebar.Main>
          <MobileSidebar.MatchupLabel data-testid="matchup-label">
            Knight Owl (White) vs Selena (Black)
          </MobileSidebar.MatchupLabel>
        </MobileSidebar.Main>
        <MobileSidebar.NavActions>
          <IconButton aria-label="Open analysis">
            <SearchIcon />
          </IconButton>
        </MobileSidebar.NavActions>
      </>
    ),
  },
};
