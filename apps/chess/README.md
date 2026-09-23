## Usage

```bash
npm install
```

## Available Scripts

### Development

```bash
npm run dev:web       # Web mode (in-browser engine, no backend)
npm run dev:desktop   # Desktop mode (expects Kotlin backend on :8080)
```

### Build

```bash
npm run build:web      # Production build for Cloudflare (VITE_TARGET=web)
npm run build:desktop  # Production build for desktop (needs VITE_API_URL)
```

### Preview

```bash
npm run preview        # Vite static preview of last build
npm run preview:cf     # Build + preview with Wrangler (matches CF behavior)
```

### Deploy

```bash
npm run deploy         # Build + deploy to Cloudflare Pages via Wrangler
```

This runs `build:web` then `wrangler deploy`, which pushes the `dist/` folder to Cloudflare using the config in `wrangler.toml`.

## Storybook

Run the local component catalog:

```bash
npm run storybook
```

Build the static catalog into `storybook-static/`:

```bash
npm run build-storybook
```

Stories follow the source hierarchy in the sidebar: `Primitives`, `Atoms`,
`Features`, and `Screens`. The viewport toolbar is the second catalog
dimension:

| Profile | Viewport   | Responsive contract              |
| ------- | ---------- | -------------------------------- |
| Desktop | 1280 × 900 | Width ≥ 720px                    |
| Mobile  | 390 × 844  | Width ≤ 719px and height ≥ 640px |
| Dynamic | 480 × 480  | Height ≤ 639px (short chrome)    |

A separate **Theme** toolbar toggles Light / Dark (`data-theme` on
`document.documentElement`), independent of the viewport profile.

Keep stories beside their components as `*.stories.tsx`, give them an explicit
layer-prefixed title, and use `parameters.storyState` for deterministic store
fixtures. Storybook replaces coach APIs, chess engines, Tailscale/WebRTC, and
browser-only integrations with local mocks; starting it never requires the
backend or an engine worker.
