/* @refresh reload */
import { Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";

import { StarChessApp } from "~/screens/StarChessApp";
import "~/styles/index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

render(
  () => (
    <Router base="/starchess">
      <Route path="/*" component={StarChessApp} />
    </Router>
  ),
  root,
);
