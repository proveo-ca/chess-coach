// SPEC: _spec/_plans/chess-ui-primitives.puml
import type { StorybookConfig } from "storybook-solidjs-vite";

export default {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: { name: "storybook-solidjs-vite", options: {} },
  core: { disableTelemetry: true },
  viteFinal: async (config) => ({
    ...config,
    resolve: { ...config.resolve, dedupe: ["solid-js"] },
  }),
} satisfies StorybookConfig;
