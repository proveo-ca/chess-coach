import type { Preview } from "storybook-solidjs-vite";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";

import "~/styles/index.css";

/**
 * Match apps/ui Storybook: viewports + Screen responsiveness tokens.
 * // SPEC: _spec/apps/ui/responsiveness/rules.md
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
    styles: { width: "390px", height: "560px" },
    type: "mobile" as const,
  },
};

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: { default: "light" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: { options: viewports },
    options: {
      storySort: {
        order: ["StarChess", ["Demo", "Maps", "Board", "Harness", "*"]],
      },
    },
  },
  initialGlobals: {
    viewport: { value: "desktop", isRotated: false },
  },
  decorators: [
    (Story) => {
      if (typeof document !== "undefined") {
        /* Prefer light Storybook canvas tokens (maps + DualNav demos). */
        const root = document.documentElement;
        root.style.colorScheme = "light";
        root.style.setProperty("--white-rgb", "255, 255, 255");
        root.style.setProperty("--shadow-rgb", "0, 0, 0");
        root.style.setProperty("--primary-rgb", "0, 86, 179");
        root.style.setProperty("--primary-color", "rgb(0, 86, 179)");
        root.style.setProperty("--primary-hover", "#747bff");
        root.style.setProperty("--bg-color", "#ffffff");
        root.style.setProperty("--surface-color", "#f9f9f9");
        root.style.setProperty("--surface-hover", "#ffffff");
        root.style.setProperty("--text-color", "#213547");
        root.style.setProperty("--text-muted", "#666");
        root.style.setProperty("--text-strong", "#1a1a1a");
        root.style.setProperty("--text", "#213547");
        root.style.setProperty("--border-color", "#ccc");
        root.style.setProperty("--border-radius-md", "8px");
        root.style.setProperty("--avatar-height", "8rem");
        /* Do not hardcode --board-size — let theme media queries own responsiveness. */
        root.style.setProperty("--board-light", "#f0d9b5");
        root.style.setProperty("--board-dark", "#b58863");
        root.style.setProperty("--board-border", "#111a23");
        document.body.style.background = "transparent";
        document.body.style.color = "#213547";
        document.body.style.margin = "0";
        if (!document.getElementById("sc-storybook-font-inherit")) {
          const style = document.createElement("style");
          style.id = "sc-storybook-font-inherit";
          style.textContent = `
            button, input, select, textarea { font-family: inherit; }
          `;
          document.head.appendChild(style);
        }
      }
      const history = createMemoryHistory();
      history.set({ value: "/" });
      return (
        <MemoryRouter history={history}>
          <Route path="*" component={Story} />
        </MemoryRouter>
      );
    },
  ],
};

export default preview;
