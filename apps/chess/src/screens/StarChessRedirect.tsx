/**
 * Compatibility redirect: /chess/starchess → /starchess/ (preserve search + hash).
 * // SPEC: _spec/apps/starchess/deployment.puml
 */
import { onMount, type Component } from "solid-js";

import { goStarChess } from "~/features/nerd/goStarChess";

export const StarChessRedirect: Component = () => {
  onMount(() => goStarChess("replace"));
  return (
    <p style={{ margin: "2rem", "text-align": "center" }}>
      Opening StarChess…
    </p>
  );
};
