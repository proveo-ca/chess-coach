/**
 * StarChess router entry — menu at `/`, live single-player at `/single`.
 * Vite base is `/starchess/` → http://localhost:5175/starchess/single
 */
import { Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";

import { StarChessMenuRoute } from "~/screens/StarChessMenuRoute";
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
      <Route path="/*" component={StarChessMenuRoute} />
    </Router>
  ),
  root,
);
