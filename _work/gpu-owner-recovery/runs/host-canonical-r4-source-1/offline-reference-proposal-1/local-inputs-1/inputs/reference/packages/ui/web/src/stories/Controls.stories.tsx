import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
  Button,
  IconButton,
  Input,
  Select,
  Toggle,
  Label,
  Divider,
  ChatBubble,
  ChevronNav,
  DualNavButton,
  Modal,
  ScreenBackNav,
  ShareIcon,
  UiProvider,
} from "../index";

const meta = { title: "Primitives/Controls", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => (
    <div class="fixture">
      <Button>Default</Button>
      <Button primary>Primary</Button>
      <Button disabled>Disabled</Button>
      <Button href="#example">Link</Button>
      <IconButton aria-label="Share">
        <ShareIcon />
      </IconButton>
    </div>
  ),
};
export const ProductVariants: Story = {
  render: () => (
    <div class="fixture-column">
      <UiProvider product="chess">
        <div class="fixture">
          <Label>Chess</Label>
          <Button primary>Play chess</Button>
          <Input aria-label="Chess name" placeholder="Name" />
        </div>
      </UiProvider>
      <UiProvider product="starchess">
        <div class="fixture">
          <Label>StarChess</Label>
          <Button primary variant="neon">
            Play StarChess
          </Button>
          <Input aria-label="StarChess name" placeholder="Name" />
        </div>
      </UiProvider>
    </div>
  ),
};
export const FormControls: Story = {
  render: () => {
    const [enabled, setEnabled] = createSignal(false);
    return (
      <div class="fixture-column">
        <Input aria-label="Player name" placeholder="Player name" />
        <Input aria-label="Disabled input" disabled value="Disabled" />
        <Select aria-label="Difficulty">
          <option>Normal</option>
          <option>Hard</option>
        </Select>
        <Toggle label="Enable hints" checked={enabled()} onChange={setEnabled} />
        <Label variant="caption">Hint status: {enabled() ? "on" : "off"}</Label>
        <Divider />
      </div>
    );
  },
};
export const Navigation: Story = {
  render: () => {
    const [step, setStep] = createSignal(1);
    return (
      <div class="fixture-column">
        <ScreenBackNav
          onBack={() => setStep(1)}
          trailing={
            <ChevronNav direction="forward" href="#next">
              Next
            </ChevronNav>
          }
        >
          Navigation
        </ScreenBackNav>
        <DualNavButton
          label={`Step ${step()}`}
          onBack={() => setStep(step() - 1)}
          onForward={() => setStep(step() + 1)}
          backDisabled={step() === 1}
        />
      </div>
    );
  },
};
export const Dialog: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Modal open={open()} title="Example dialog" onClose={() => setOpen(false)}>
          <p>Package-only content.</p>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </Modal>
      </>
    );
  },
};
export const Bubbles: Story = {
  render: () => (
    <div class="fixture">
      <ChatBubble>Decorative bubble</ChatBubble>
      <ChatBubble label="Continue" onClick={() => {}}>
        Continue
      </ChatBubble>
    </div>
  ),
};
