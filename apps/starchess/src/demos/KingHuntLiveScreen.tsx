import type { Component } from "solid-js";
import { adjutant } from "@chess-coach/starchess-core";

import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { StarChessScreen } from "~/app/StarChessScreen";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import { KING_HUNT_LIVE_START_SCFEN } from "~/demos/kingHunt";

/**
 * King Hunt (live) — same HUD shell as `/starchess/single`.
 */
export const KingHuntLiveScreen: Component = () => {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(KING_HUNT_LIVE_START_SCFEN, 1),
  });

  return (
    <LiveMatchShell world="eclipse">
      <MatchStoreProvider store={store}>
        <KingHuntLiveInner />
      </MatchStoreProvider>
    </LiveMatchShell>
  );
};

const KingHuntLiveInner: Component = () => {
  const store = useMatchStore();
  return (
    <StarChessScreen
      boardVariant="eclipse"
      starChessMode
      armTimer
      autoQueueOpponent={(snap) =>
        adjutant(snap, {
          color: "b",
          storedFor: (color) => store.state().economies[color].stored,
        })
      }
    />
  );
};
