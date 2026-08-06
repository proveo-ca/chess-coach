import { onMount } from "solid-js";
import type { Component } from "solid-js";

import { browserLocation, readScfenQuery } from "~/adapters/browser";
import { createMatchStore, MatchStoreProvider } from "~/app/MatchStoreContext";
import { StarChessScreen } from "~/app/StarChessScreen";

const DEFAULT_SCFEN =
  "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:";

export const StarChessApp: Component = () => {
  const store = createMatchStore();

  onMount(() => {
    const fromQuery = readScfenQuery(browserLocation.search());
    store.dispatch({
      type: "LOAD_SCFEN",
      scfen: fromQuery ?? DEFAULT_SCFEN,
      stored: 12,
    });
  });

  return (
    <MatchStoreProvider store={store}>
      <StarChessScreen />
    </MatchStoreProvider>
  );
};
