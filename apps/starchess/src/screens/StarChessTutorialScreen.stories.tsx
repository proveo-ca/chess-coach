import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { TutorialScreen } from "~/screens/TutorialScreen.tsx";
import { tutorialPath } from "~/tutorial/tutorialScript";

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

/** King Damage · DualNav review. */
export const King: Story = {
  name: "King Damage",
  parameters: { route: tutorialPath("king") },
  render: () => <TutorialScreen />,
};
