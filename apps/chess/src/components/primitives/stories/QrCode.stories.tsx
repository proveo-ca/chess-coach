import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { QrCode } from "@chess-coach/ui-web/primitives/QrCode";

const meta = {
  title: "Primitives/QrCode",
  component: QrCode,
  args: {
    value: "chess-coach:invite/local-match-7K4M",
    size: 240,
    alt: "Local match invitation QR code",
  },
} satisfies Meta<typeof QrCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Invite: Story = {};

export const Compact: Story = {
  args: { size: 128 },
};

export const LongPayload: Story = {
  args: {
    value: "chess-coach:invite/offer?session=local-demo&color=white&position=start&token=storybook",
    size: 300,
  },
};
