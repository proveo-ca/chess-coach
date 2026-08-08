/**
 * StarChess router entry — menu `/`, live `/single`, replays `/review` + `/review/:id`,
 * tutorial `/tutorial` · `/tutorial/:section` · `/tutorial/:section/:story`
 * (story ids from TUTORIAL_SCRIPT, e.g. `/tutorial/fog/king`).
 * Vite base is `/starchess/` → http://localhost:5175/starchess/tutorial/fog/king
 * // SPEC: _spec/apps/starchess/deployment.puml
 */
import { Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";

import { StarChessMenuRoute } from "~/screens/StarChessMenuRoute";
import { StarChessReviewScreen } from "~/screens/StarChessReviewScreen";
import { StarChessSingleScreen } from "~/screens/StarChessSingleScreen";
import { StarChessTutorialScreen } from "~/screens/StarChessTutorialScreen";
import "~/theme.css";
import "~/styles/index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

render(
  () => (
    <Router base="/starchess">
      <Route path="/" component={StarChessMenuRoute} />
      <Route path="/single" component={StarChessSingleScreen} />
      <Route path="/review" component={StarChessReviewScreen} />
      <Route path="/review/:id" component={StarChessReviewScreen} />
      <Route path="/tutorial" component={StarChessTutorialScreen} />
      <Route path="/tutorial/:section" component={StarChessTutorialScreen} />
      <Route
        path="/tutorial/:section/:story"
        component={StarChessTutorialScreen}
      />
      <Route path="/*" component={StarChessMenuRoute} />
    </Router>
  ),
  root,
);
