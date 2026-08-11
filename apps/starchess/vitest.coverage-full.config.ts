/**
 * Full-tree coverage report (no thresholds). Gap analysis only:
 *   pnpm --filter @chess-coach/starchess test:coverage:full
 */
import { URL, fileURLToPath } from "node:url";

import solidPlugin from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
      "@chess-coach/starchess-core": fileURLToPath(
        new URL("../../packages/starchess-core/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage-full",
      reporter: ["text", "text-summary", "json-summary", "html", "lcov"],
      // Coverage instruments .ts only (no .tsx components).
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.tsx",
        "src/**/*.{test,spec}.ts",
        "src/**/*.stories.ts",
        "src/demos/**",
        "src/stories/**",
        "src/vite-env.d.ts",
        "src/**/*.d.ts",
      ],
    },
  },
});
