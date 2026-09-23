import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "storybook-solidjs-vite";
import { mergeConfig } from "vite";

const fromStorybook = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const APP_ONLY_PLUGINS = new Set([
  "vite-plugin-oxlint",
  "vite-plugin-pwa",
  "isolate-and-debug",
  "strip-web-engine",
  "strip-unused-stockfish",
]);

const config = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "storybook-solidjs-vite",
    options: {},
  },
  staticDirs: [{ from: "../public", to: "/chess" }],
  viteFinal: async (baseConfig) => {
    const storybookConfig = mergeConfig(baseConfig, {
      define: {
        __HAS_LLM__: JSON.stringify(false),
        __STOCKFISH_VARIANT__: JSON.stringify("stockfish-18-lite-single"),
        "import.meta.env.VITE_TARGET": JSON.stringify("web-no-llm"),
      },
      resolve: {
        dedupe: ["solid-js", "chess.js"],
        alias: [
          {
            find: /^~\/services\/api(?:\.ts)?$/,
            replacement: fromStorybook("./mocks/api.ts"),
          },
          {
            find: /^~\/engine\/EnginePool(?:\.ts)?$/,
            replacement: fromStorybook("./mocks/EnginePool.ts"),
          },
          {
            find: /^~\/services\/peer(?:\.ts)?$/,
            replacement: fromStorybook("./mocks/peer.ts"),
          },
          {
            find: /^~\/services\/tailscale(?:\.ts)?$/,
            replacement: fromStorybook("./mocks/tailscale.ts"),
          },
          {
            find: "~",
            replacement: fromStorybook("../src"),
          },
          {
            find: "@chess-coach/engine-core",
            replacement: fromStorybook("../../../packages/engine-core/src/index.ts"),
          },
        ],
      },
    });
    storybookConfig.plugins = storybookConfig.plugins?.flat(4).filter((plugin) => {
      if (!plugin || typeof plugin !== "object" || !("name" in plugin)) return true;
      const name = String(plugin.name);
      return !APP_ONLY_PLUGINS.has(name) && !name.startsWith("vite-plugin-pwa");
    });
    return storybookConfig;
  },
} satisfies StorybookConfig;

export default config;
