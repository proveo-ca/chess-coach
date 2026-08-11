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
      reportsDirectory: "./coverage",
      reporter: ["text", "text-summary", "json-summary", "html", "lcov"],
      // Gated logic surface (four-axis ≥60%). Expand this include as
      // integration tests land — see apps/starchess/coverage-plan.md.
      // Full tree: `pnpm test:coverage:full` (no thresholds).
      // Coverage instruments .ts only (no .tsx components).
      // Enforced floor: 70% four-axis. Stretch target 100% — see coverage-plan.md.
      include: [
        "src/app/matchReducer.ts",
        "src/app/matchEconomy.ts",
        "src/app/selectors.ts",
        "src/app/reviewHistory.ts",
        "src/app/intentOverlayPolicy.ts",
        "src/presentation/timeline/**/*.ts",
        "src/presentation/board/hooks/useBoardInput.ts",
        "src/presentation/board/fogVisibility.ts",
        "src/presentation/board/rookMode.ts",
        "src/presentation/board/occupancyForQueuedMoves.ts",
        "src/presentation/board/occupancyForViewerMoves.ts",
        "src/presentation/board/fogProjection.ts",
        "src/presentation/combat/intentOverlays.ts",
        "src/presentation/specials/pawnGasArm.ts",
        "src/presentation/specials/pieceSpecials.ts",
        "src/store/**/*.ts",
        "src/tutorial/**/*.ts",
      ],
      exclude: [
        "src/**/*.tsx",
        "src/**/*.{test,spec}.ts",
        "src/**/*.stories.ts",
        "src/demos/**",
        "src/stories/**",
        "src/vite-env.d.ts",
        "src/**/*.d.ts",
      ],
      // Four-axis gate (statements · branches · functions · lines).
      thresholds: {
        statements: 75,
        branches: 75,
        functions: 75,
        lines: 75,
      },
    },
  },
});
