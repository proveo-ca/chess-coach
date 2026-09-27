import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: [
    "public/**/*",
    ".vite",
    "dist/**/*",
    "storybook-static/**/*",
    "lint/**",
    ".storybook/**",
  ],
  // Local architecture plugin (alpha JS-plugin API). See lint/architecture.ts.
  jsPlugins: ["./lint/architecture.ts"],
  rules: {
    "sort-imports": "off",
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["../*", "./*"],
            message:
              "Use absolute alias paths (~/...) instead of relative paths to prevent Vite module duplication and reactivity loss.",
          },
        ],
      },
    ],
    "proveo-starchess/pure-primitive": "error",
    "proveo-starchess/route-target-in-screens": "error",
    "proveo-starchess/own-css-module": "error",
    "proveo-starchess/no-cross-module-types": "error",
    "proveo-starchess/no-raw-timer": "error",
  },
});
