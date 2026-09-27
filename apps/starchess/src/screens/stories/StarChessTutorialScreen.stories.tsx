import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, type JSX } from "solid-js";

import { TutorialHudLabels } from "~/components/features/TutorialHudLabels";
import { PromotionModal } from "~/components/primitives/PromotionModal";
import { DeployModal } from "~/presentation/hud/components/DeployModal";
import { TutorialScreen } from "~/screens/TutorialScreen.tsx";
import { WithMatchStore } from "~/stories/project";
import { lessonBoard, tutorialPath } from "~/tutorial/tutorialScript";

const meta = {
  title: "Screens/Tutorial",
  component: TutorialScreen,
  parameters: {
    layout: "fullscreen",
    route: tutorialPath("fog"),
    docs: {
      description: {
        component:
          "Tutorial shell (`/tutorial/:section/:story`). Kerrigan header · floating guide · HOME-only rail. Sections: Fog · Specials · Resolve · King.",
      },
    },
  },
} satisfies Meta<typeof TutorialScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fog of War · King (first fog lesson). */
export const Fog: Story = {
  name: "Fog of War",
  parameters: { route: tutorialPath("fog", "king") },
  render: () => <TutorialScreen />,
};

/** Special Moves · Marine gas deploy. */
export const Specials: Story = {
  name: "Special Moves",
  parameters: { route: tutorialPath("specials", "marine") },
  render: () => <TutorialScreen />,
};

/** Turn Resolution · combat chain DualNav. */
export const Resolve: Story = {
  name: "Turn Resolution",
  parameters: { route: tutorialPath("resolve") },
  render: () => <TutorialScreen />,
};

export const CommandCenter: Story = {
  name: "Live Play",
  parameters: { route: tutorialPath("live-play") },
  render: () => <TutorialScreen />,
};

/**
 * Both pickers open on a lesson board, so the tutorial-only naming layer is
 * reviewable without playing to the beat that raises them. `Modal` positions
 * itself absolutely, hence the sized relative host.
 */
const PickerStage = (props: { children: JSX.Element }): JSX.Element => (
  <WithMatchStore board={lessonBoard("specials", "cc")}>
    <div
      style={{
        position: "relative",
        width: "30rem",
        height: "24rem",
        margin: "3rem auto",
      }}
    >
      {props.children}
      <TutorialHudLabels enabled />
    </div>
  </WithMatchStore>
);

/** Command Center picker — unit names + ResourceBar strip names. */
export const DeployLabels: Story = {
  name: "Deploy unit · labels",
  parameters: { layout: "centered" },
  render: () => {
    const [pending, setPending] = createSignal<{ color: "w" } | null>({ color: "w" });
    return (
      <PickerStage>
        <DeployModal
          pending={pending()}
          onSelect={() => setPending(null)}
          onCancel={() => setPending(null)}
        />
      </PickerStage>
    );
  },
};

/** Last-rank picker — same unit names, no ResourceBar. */
export const PromotionLabels: Story = {
  name: "Promote Marine · labels",
  parameters: { layout: "centered" },
  render: () => {
    const [pending, setPending] = createSignal<{
      color: "w";
      from: "a7";
      to: "a8";
    } | null>({ color: "w", from: "a7", to: "a8" });
    return (
      <PickerStage>
        <PromotionModal
          pending={pending()}
          onSelect={() => setPending(null)}
          onCancel={() => setPending(null)}
        />
      </PickerStage>
    );
  },
};
