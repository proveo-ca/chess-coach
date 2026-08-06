// SPEC: _spec/apps/starchess/deployment.puml
import { URL, fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import oxlintPlugin from "vite-plugin-oxlint";
import { VitePWA } from "vite-plugin-pwa";
import solid from "vite-plugin-solid";

export default defineConfig({
  base: "/starchess/",
  build: {
    outDir: "dist/starchess",
  },
  plugins: [
    solid(),
    oxlintPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      filename: "sw.js",
      // Keep SW registration under /starchess/ (Vite base).
      scope: "/starchess/",
      workbox: {
        cacheId: "starchess-shell",
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: [
          "**/*.{js,css,html,ico,svg,png,webp,woff,woff2,webmanifest}",
        ],
        // Small shell only — no engine / WebLLM / Stockfish exception.
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        navigateFallback: "/starchess/index.html",
        navigateFallbackDenylist: [/^\/chess/, /^\/$/],
      },
      manifest: {
        name: "StarChess",
        short_name: "StarChess",
        description: "Fog-of-war chess with StarCraft specials",
        start_url: "/starchess/",
        scope: "/starchess/",
        display: "standalone",
        background_color: "#0a1a22",
        theme_color: "#005F7F",
        icons: [
          { src: "/starchess/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/starchess/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
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
