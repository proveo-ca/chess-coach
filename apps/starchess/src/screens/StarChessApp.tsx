import type { Component } from "solid-js";

import { browserLocation, readScfenQuery } from "~/adapters/browser";
import { createMatchStore, MatchStoreProvider } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { StarChessScreen } from "~/app/StarChessScreen";

const DEFAULT_SCFEN =
  "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:";

export const StarChessApp: Component = () => {
  const fromQuery = readScfenQuery(browserLocation.search());
  const store = createMatchStore({
    initial: createMatchStateFromScfen(fromQuery ?? DEFAULT_SCFEN, 12),
  });

  return (
    <MatchStoreProvider store={store}>
      <StarChessScreen />
    </MatchStoreProvider>
  );
};
