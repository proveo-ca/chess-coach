// SPEC: _spec/_plans/chess-ui-primitives.puml
import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["storybook-static/**", "node_modules/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          "~/*",
          "**/apps/**",
          "@solidjs/router",
          "@chess-coach/*core*",
          "@chess-coach/server",
        ],
      },
    ],
  },
});
