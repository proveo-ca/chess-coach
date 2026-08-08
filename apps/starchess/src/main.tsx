/**
 * StarChess router entry — menu `/`, live `/single`, replays `/review` + `/review/:id`.
 * Vite base is `/starchess/` → http://localhost:5175/starchess/review/:id
 * // SPEC: _spec/apps/starchess/deployment.puml
 */
import { Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";

import { StarChessMenuRoute } from "~/screens/StarChessMenuRoute";
import { StarChessReviewScreen } from "~/screens/StarChessReviewScreen";
import { StarChessSingleScreen } from "~/screens/StarChessSingleScreen";
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
      <Route path="/*" component={StarChessMenuRoute} />
    </Router>
  ),
  root,
);
