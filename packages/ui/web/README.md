# Shared web UI

`@chess-coach/ui-web` owns Solid web primitives and visual atoms for Chess and StarChess.

Run the standalone catalog from the repository root:

```sh
pnpm storybook:primitives
```

Open `http://localhost:6008`. The product toolbar switches the default skin. The catalog supplies its own example tokens and data; it imports neither app.

Apps supply production CSS tokens and navigation:

```tsx
import { A } from "@solidjs/router";
import { UiProvider } from "@chess-coach/ui-web/provider";
import { Button } from "@chess-coach/ui-web/primitives/Button";

<UiProvider product="starchess" Link={A}>
  <Button primary variant="neon">Start</Button>
</UiProvider>
```

Render routed controls inside the app's router. Without an injected `Link`, controls use normal anchors. The package also exports components and their props from its root. Leaf imports keep consumers explicit.

The apps retain compatibility exports. App adapters own navigation defaults, stores, game rules, character assets and promotion rendering. `ScreenBackNav` and mobile banner views receive actions through props. CSS variants preserve product layouts; identical styles share one module. The web package does not define an Android renderer or collect analytics.

Verification:

```sh
pnpm --filter @chess-coach/ui-web typecheck
pnpm --filter @chess-coach/ui-web lint
pnpm --filter @chess-coach/ui-web test
pnpm build:storybook:primitives
pnpm e2e:primitives
```

The E2E command starts the catalog and both Vite apps. Install Playwright Chromium through the existing E2E setup, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an available Chromium executable. Root CI includes this package's static checks and unit tests. Run E2E separately.

Architecture and follow-on goals: `_spec/_plans/chess-ui-primitives.puml`.
