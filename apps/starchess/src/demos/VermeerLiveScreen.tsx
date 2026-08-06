/**
 * Vermeer (live) — classic 1K+4P opening on Vermeer terrain vs adjutant.
 * // SPEC: _spec/apps/ui/starchess/demos.puml
 */
import type { Component } from "solid-js";
import { adjutant } from "@chess-coach/starchess-core";

import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { StarChessScreen } from "~/app/StarChessScreen";
import { NERD_STARTING_SCFEN } from "~/stories/fixtures/seeds";

/**
 * Live match seed: both sides Ke1/ke8 + four pawns (c/d/e/f files).
 * Same placement as Maps → Vermeer; playable with fog, chrome, and adjutant.
 *
 * SCFEN is seeded into the store **before** the screen mounts so `armTimer` /
 * turn-open checks / adjutant see the real starting position.
 */
export const VermeerLiveScreen: Component = () => {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(NERD_STARTING_SCFEN, 1),
  });

  return (
    <MatchStoreProvider store={store}>
      <VermeerLiveInner />
    </MatchStoreProvider>
  );
};

const VermeerLiveInner: Component = () => {
  const store = useMatchStore();
  return (
    <StarChessScreen
      boardVariant="vermeer"
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
