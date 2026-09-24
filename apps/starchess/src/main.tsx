// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/starchess/deployment.puml
import { UiProvider } from "@chess-coach/ui-web/provider";
/**
 * StarChess router entry — menu `/`, live `/single`, replays `/review` + `/review/:id`,
 * tutorial `/tutorial` · `/tutorial/:section` · `/tutorial/:section/:story`
 * (story ids from TUTORIAL_SCRIPT, e.g. `/tutorial/fog/king`).
 * Vite base is `/starchess/` → http://localhost:5175/starchess/tutorial/fog/king
 * Perf debug: `npm run dev:debug` · `?debug=perf` · localStorage starchess_debug=perf
 */
import { A, Route, Router } from "@solidjs/router";
import { lazy } from "solid-js";
import { render } from "solid-js/web";

import { initPerfDebug } from "~/debug/perfMonitor";
import { MenuRoute } from "~/screens/MenuRoute.tsx";

// The menu is the landing page; every other screen is its own chunk, fetched
// on first navigation (and precached by the service worker after that).
const SingleScreen = lazy(() =>
  import("~/screens/SingleScreen.tsx").then((m) => ({ default: m.SingleScreen })),
);
const ReviewScreen = lazy(() =>
  import("~/screens/ReviewScreen.tsx").then((m) => ({ default: m.ReviewScreen })),
);
const TutorialScreen = lazy(() =>
  import("~/screens/TutorialScreen.tsx").then((m) => ({ default: m.TutorialScreen })),
);
import "~/theme.css";
import "~/styles/index.css";

initPerfDebug();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

render(
  () => (
    <UiProvider product="starchess" Link={A}>
      <Router base="/starchess">
        <Route path="/" component={MenuRoute} />
        <Route path="/single" component={SingleScreen} />
        <Route path="/review" component={ReviewScreen} />
        <Route path="/review/:id" component={ReviewScreen} />
        <Route path="/tutorial" component={TutorialScreen} />
        <Route path="/tutorial/:section" component={TutorialScreen} />
        <Route path="/tutorial/:section/:story" component={TutorialScreen} />
        <Route path="/*" component={MenuRoute} />
      </Router>
    </UiProvider>
  ),
  root,
);
