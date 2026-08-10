/**
 * StarChess router entry — menu `/`, live `/single`, replays `/review` + `/review/:id`,
 * tutorial `/tutorial` · `/tutorial/:section` · `/tutorial/:section/:story`
 * (story ids from TUTORIAL_SCRIPT, e.g. `/tutorial/fog/king`).
 * Vite base is `/starchess/` → http://localhost:5175/starchess/tutorial/fog/king
 * // SPEC: _spec/apps/starchess/deployment.puml
 */
import { Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";

import { MenuRoute } from "~/screens/MenuRoute.tsx";
import { ReviewScreen } from "~/screens/ReviewScreen.tsx";
import { SingleScreen } from "~/screens/SingleScreen.tsx";
import { TutorialScreen } from "~/screens/TutorialScreen.tsx";
import "~/theme.css";
import "~/styles/index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

render(
  () => (
    <Router base="/starchess">
      <Route path="/" component={MenuRoute} />
      <Route path="/single" component={SingleScreen} />
      <Route path="/review" component={ReviewScreen} />
      <Route path="/review/:id" component={ReviewScreen} />
      <Route path="/tutorial" component={TutorialScreen} />
      <Route path="/tutorial/:section" component={TutorialScreen} />
      <Route
        path="/tutorial/:section/:story"
        component={TutorialScreen}
      />
      <Route path="/*" component={MenuRoute} />
    </Router>
  ),
  root,
);
