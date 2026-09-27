// SPEC: _spec/_plans/chess-ui-primitives.puml
import { UiProvider } from "@chess-coach/ui-web/provider";
import { A, MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import type { Preview } from "storybook-solidjs-vite";

import {
  applyStorybookTheme,
  readStorybookTheme,
  storybookThemeGlobalTypes,
} from "~/storybookApplyTheme";
import { applyStorybookVfxTier, storybookVfxTierGlobalTypes } from "~/storybookVfxTier";
import "~/theme.css";
import "~/styles/index.css";

/**
 * Match apps/chess Storybook: viewports + theme toolbar + Screen responsiveness tokens.
 * // SPEC: _spec/apps/chess/responsiveness/rules.md, _spec/apps/starchess/navigation-chrome.md, _spec/apps/starchess/vfx-tier.puml
 */
const viewports = {
  desktop: {
    name: "Desktop",
    styles: { width: "1280px", height: "900px" },
    type: "desktop" as const,
  },
  mobile: {
    name: "Mobile",
    styles: { width: "390px", height: "844px" },
    type: "mobile" as const,
  },
  dynamic: {
    name: "Dynamic",
    styles: { width: "560px", height: "420px" },
    type: "mobile" as const,
  },
};

const preview: Preview = {
  globalTypes: {
    ...storybookThemeGlobalTypes,
    ...storybookVfxTierGlobalTypes,
  },
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: { options: viewports },
    options: {
      storySort: {
        order: [
          "StarChess",
          [
            "Demo",
            "Maps",
            "Board",
            "Engine",
            "Fog of War and Move Animations",
            "Attack Animations",
            "Special Moves",
            "Spider Mines",
            "*",
          ],
          "Screens",
          [
            "Menu",
            [
              "StarChess",
              "Single Player setup",
              "Sky · Debris",
              "Sky · Network signal",
              "Sky · Moon (Review)",
              "Sky · Planet",
              "Sky · Black Hole",
              "*",
            ],
            "Single",
            "Tutorial",
            "Review",
          ],
          "Navigation",
          ["Chrome", "*"],
          "Features",
          ["Credits", "GasDeploy", "Side Rail Tools", "Turn Chrome", "*"],
          "Atoms",
          [
            "CoachAvatar",
            "ColorSwatch",
            "DeployModal",
            "MatchHistoryFilters",
            "Modal",
            "NeonModal",
            "*",
          ],
          "Primitives",
          [
            "Breadcrumb",
            "Button",
            "Chip",
            "CountdownRing",
            "DualNavButton",
            "Label",
            "PromotionModal",
            "Screen",
            "Select",
            "SpecialPreview",
            "TeamFrame",
            "Toggle",
            "*",
          ],
        ],
      },
    },
  },
  initialGlobals: {
    viewport: { value: "desktop", isRotated: false },
    // Match apps/starchess :root default (dark).
    theme: "dark",
    vfxTier: "full",
  },
  decorators: [
    (Story, context) => {
      applyStorybookTheme(readStorybookTheme(context.globals));
      applyStorybookVfxTier(context.globals);
      const parameters = context.parameters as { route?: string };
      const history = createMemoryHistory();
      history.set({ value: parameters.route ?? "/" });
      return (
        <UiProvider product="starchess" Link={A}>
          <MemoryRouter history={history}>
            <Route path="/review/:id" component={Story} />
            <Route path="/tutorial/:section/:story" component={Story} />
            <Route path="/tutorial/:section" component={Story} />
            <Route path="/single" component={Story} />
            <Route path="*" component={Story} />
          </MemoryRouter>
        </UiProvider>
      );
    },
  ],
};

export default preview;
