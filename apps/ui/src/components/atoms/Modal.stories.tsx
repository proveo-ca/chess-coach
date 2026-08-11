import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { Modal } from "~/components/atoms/Modal";
import { Button } from "~/components/primitives/Button";

const meta = {
  title: "Atoms/Modal",
  component: Modal,
  args: {
    open: true,
    title: "Review complete",
    children: <p style={{ margin: 0 }}>Your game is ready to review.</p>,
    onClose: () => undefined,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dismissible: Story = {};

export const RequiredDecision: Story = {
  args: {
    title: "Choose a side",
    dismissible: false,
    showCloseButton: false,
    children: (
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <Button type="button">Play White</Button>
        <Button type="button">Play Black</Button>
      </div>
    ),
  },
};

export const Absolute: Story = {
  render: (args) => (
    <div style={{ position: "relative", width: "32rem", height: "20rem", margin: "2rem auto" }}>
      <Modal {...args} position="absolute" title="Board message">
        This modal is constrained to its positioned parent.
      </Modal>
    </div>
  ),
};
