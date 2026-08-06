import type { Component } from "solid-js";

import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { StarChessScreen } from "~/app/StarChessScreen";
import { adjutant } from "~/demos/adjutant";
import { KING_HUNT_LIVE_START_SCFEN } from "~/demos/kingHunt";

/**
 * King Hunt (live) — eclipse board, ResourceBar / TurnBar / GasDeploy,
 * combat timeline VFX, adjutant opponent.
 *
 * SCFEN is seeded into the store **before** the screen mounts so `armTimer` /
 * turn-open checks / adjutant see the real starting position (not the empty
 * default board).
 */
export const KingHuntLiveScreen: Component = () => {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(KING_HUNT_LIVE_START_SCFEN, 1),
  });

  return (
    <MatchStoreProvider store={store}>
      <KingHuntLiveInner />
    </MatchStoreProvider>
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
          storedFor: (color) => store.state().economies[color].stored,
        })
      }
    />
  );
};
