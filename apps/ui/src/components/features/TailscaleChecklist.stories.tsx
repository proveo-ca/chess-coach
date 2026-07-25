import { onCleanup, type Component } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { TailscaleChecklist } from "~/components/features/TailscaleChecklist";
import { Button } from "~/components/primitives/Button";

const LocalChecklistStory: Component = () => {
  const rtcDescriptor = Object.getOwnPropertyDescriptor(globalThis, "RTCPeerConnection");
  Reflect.deleteProperty(globalThis, "RTCPeerConnection");
  onCleanup(() => {
    if (rtcDescriptor) Object.defineProperty(globalThis, "RTCPeerConnection", rtcDescriptor);
  });

  return (
    <TailscaleChecklist>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <strong>Host a private game</strong>
        <span>Choose a color, then share the invite with another player.</span>
        <Button primary>Create room</Button>
      </div>
    </TailscaleChecklist>
  );
};

const meta = {
  title: "Features/TailscaleChecklist",
  component: TailscaleChecklist,
  parameters: { layout: "centered" },
  args: { children: <></> },
  render: () => (
    <div style={{ width: "min(42rem, calc(100vw - 2rem))" }}>
      <LocalChecklistStory />
    </div>
  ),
} satisfies Meta<typeof TailscaleChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Dynamic: Story = {
  globals: { viewport: { value: "dynamic", isRotated: false } },
};
