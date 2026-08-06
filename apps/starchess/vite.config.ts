import { URL, fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  base: "/starchess/",
  build: {
    outDir: "dist/starchess",
  },
  plugins: [solid()],
  resolve: {
    dedupe: ["solid-js", "chess.js"],
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
      "@chess-coach/starchess-core": fileURLToPath(
        new URL("../../packages/starchess-core/src/index.ts", import.meta.url),
      ),
    },
  },
});
