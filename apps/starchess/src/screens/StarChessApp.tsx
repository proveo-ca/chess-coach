/**
 * StarChess app shell — menu at `/starchess/`, live match on Single Player
 * or when deep-linked with `?scfen=`.
 */
import { Show, createSignal, type Component } from "solid-js";

import { browserLocation, readScfenQuery } from "~/adapters/browser";
import { createMatchStore, MatchStoreProvider } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { StarChessScreen } from "~/app/StarChessScreen";
import {
  StarChessMenuScreen,
  type StarChessMenuAction,
} from "~/screens/StarChessMenuScreen";

const DEFAULT_SCFEN =
  "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:";

const MatchPlay: Component<{ scfen: string }> = (props) => {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(props.scfen, 12),
  });

  return (
    <MatchStoreProvider store={store}>
      <StarChessScreen />
    </MatchStoreProvider>
  );
};

export const StarChessApp: Component = () => {
  const fromQuery = readScfenQuery(browserLocation.search());
  const [playing, setPlaying] = createSignal(!!fromQuery);

  const onMenuAction = (action: StarChessMenuAction) => {
    if (action === "single-player") setPlaying(true);
  };

  return (
    <Show
      when={playing()}
      fallback={<StarChessMenuScreen onAction={onMenuAction} />}
    >
      <MatchPlay scfen={fromQuery ?? DEFAULT_SCFEN} />
    </Show>
  );
};
