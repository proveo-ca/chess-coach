import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";

import {
  createMatchStore,
  MatchStoreProvider,
} from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { DeployModal } from "~/presentation/hud/components/DeployModal";
import { GAS_DEPLOY_FIXTURES } from "~/stories/fixtures/scenarios";

const meta = {
  title: "Atoms/DeployModal",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Command Center unit picker — Modal atom + ResourceBar + 5-unit grid. Must not clip choices.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Open: Story = {
  name: "Open (absolute)",
  render: () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(
        GAS_DEPLOY_FIXTURES.commandCenter.scfen,
        GAS_DEPLOY_FIXTURES.commandCenter.stored,
      ),
      autoArmTimer: false,
    });
    const [pending, setPending] = createSignal<{ color: "w" } | null>({ color: "w" });
    return (
      <MatchStoreProvider store={store}>
        <div
          style={{
            position: "relative",
            width: "28rem",
            height: "22rem",
            border: "1px dashed color-mix(in srgb, #111 25%, transparent)",
            "background-image":
              "linear-gradient(45deg, #1a222c 25%, #12171c 25%, #12171c 50%, #1a222c 50%, #1a222c 75%, #12171c 75%)",
            "background-size": "24px 24px",
          }}
        >
          <DeployModal
            pending={pending()}
            onSelect={() => setPending(null)}
            onCancel={() => setPending(null)}
          />
        </div>
      </MatchStoreProvider>
    );
  },
};
