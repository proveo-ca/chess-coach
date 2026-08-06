import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "storybook-solidjs-vite";
import { mergeConfig } from "vite";

const fromStorybook = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const config = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "storybook-solidjs-vite",
    options: {},
  },
  staticDirs: [{ from: "../public", to: "/starchess" }],
  viteFinal: async (baseConfig) => {
    return mergeConfig(baseConfig, {
      resolve: {
        dedupe: ["solid-js", "chess.js"],
        alias: [
          {
            find: "~",
            replacement: fromStorybook("../src"),
          },
          {
            find: "@chess-coach/starchess-core",
            replacement: fromStorybook("../../../packages/starchess-core/src/index.ts"),
          },
        ],
      },
    });
  },
} satisfies StorybookConfig;

export default config;
