import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import type { Preview } from "storybook-solidjs-vite";

import {
  applyStorybookTheme,
  readStorybookTheme,
  storybookThemeGlobalTypes,
} from "~/storybookApplyTheme";
import "~/theme.css";
import "~/index.css";
import { installStorybookBrowserMocks } from "~/storybook/browserMocks";
import { resetStoryState, type StoryState } from "~/storybook/storyState";

installStorybookBrowserMocks();

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
  },
  decorators: [
    (Story, context) => {
      applyStorybookTheme(readStorybookTheme(context.globals));

      const parameters = context.parameters as {
        route?: string;
        storyState?: StoryState;
      };
      resetStoryState(parameters.storyState);

      const history = createMemoryHistory();
      history.set({ value: parameters.route ?? "/" });

      return (
        <MemoryRouter history={history}>
          <Route path="/review/:id" component={Story} />
          <Route path="*" component={Story} />
        </MemoryRouter>
      );
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: { codePanel: true },
    options: {
      storySort: {
        order: [
          "Screens",
          [
            "Nerd",
            [
              "StarChess",
              [
                "Demo",
                "Maps",
                "Attack Animations",
                "Death Animations",
                "Deploy Animations",
                "Fog of War and Move Animations",
                "Special Moves",
                "Turn Chrome",
              ],
              "Piece Sets",
              "*",
            ],
          ],
          "Features",
          "Atoms",
          "Primitives",
        ],
      },
    },
    viewport: { options: viewports },
  },
  initialGlobals: {
    // Toolbar: Desktop · Mobile · Dynamic — do not lock viewport on stories
    // (`globals.viewport` disables the toolbar). Same pattern as apps/starchess.
    viewport: { value: "desktop", isRotated: false },
    // Match apps/ui :root default (dark).
    theme: "dark",
  },
};

export default preview;
