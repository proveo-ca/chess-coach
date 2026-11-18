// SPEC: _spec/_plans/chess-ui-primitives.puml
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
  ChessMobileBanner,
  StarChessMobileBanner,
  StarChessMobileSubBanner,
  Screen,
  ScreenBackNav,
  Label,
  Button,
  UiProvider,
} from "../index";

const meta = { title: "Primitives/Layout", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Regions: Story = {
  render: () => (
    <Screen>
      <Screen.SidebarInset>
        <ScreenBackNav onBack={() => {}}>
          <Label variant="title">Screen regions</Label>
        </ScreenBackNav>
      </Screen.SidebarInset>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class="fixture-board">Board slot</div>
        </Screen.BoardColumn>
        <aside class="fixture-sidebar">Sidebar slot</aside>
      </Screen.BoardArea>
      <Screen.Footer>
        <Button>Footer action</Button>
      </Screen.Footer>
    </Screen>
  ),
};
export const ChessBanner: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: () => (
    <UiProvider product="chess">
      <ChessMobileBanner title="Example title" onBack={() => {}} onMenu={() => {}} />
      <p class="fixture">Visible below 720px; resize the viewport to inspect.</p>
    </UiProvider>
  ),
};
export const StarChessBanner: Story = {
  globals: { viewport: { value: "dynamic", isRotated: false } },
  render: () => (
    <UiProvider product="starchess">
      <StarChessMobileBanner onBack={() => {}} title="Title" />
      <StarChessMobileSubBanner>
        <Label>Resources</Label>
        <Button>End turn</Button>
      </StarChessMobileSubBanner>
      <p class="fixture">Visible below 720px wide.</p>
    </UiProvider>
  ),
};
