/**
 * Vermeer (live) — classic 1K+4P opening on Vermeer terrain vs adjutant.
 * Same HUD shell as `/starchess/single`.
 * // SPEC: _spec/apps/starchess/demos.puml
 */
import type { Component } from "solid-js";
import { adjutant } from "@chess-coach/starchess-core";

import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { BaseScreen } from "~/app/BaseScreen.tsx";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import { NERD_STARTING_SCFEN } from "~/stories/fixtures/seeds";

export type VermeerLiveScreenProps = {
  /** Experimental: vertical turn chrome in the side rail. */
  turnChrome?: "bar" | "sidebar";
};

export const VermeerLiveScreen: Component<VermeerLiveScreenProps> = (props) => {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(NERD_STARTING_SCFEN, 1),
  });

  return (
    <LiveMatchShell world="vermeer">
      <MatchStoreProvider store={store}>
        <VermeerLiveInner turnChrome={props.turnChrome} />
      </MatchStoreProvider>
    </LiveMatchShell>
  );
};

const VermeerLiveInner: Component<VermeerLiveScreenProps> = (props) => {
  const store = useMatchStore();
  return (
    <BaseScreen
      boardVariant="vermeer"
      starChessMode
      armTimer
      turnChrome={props.turnChrome}
      autoQueueOpponent={(snap) =>
        adjutant(snap, {
          color: "b",
          storedFor: (color) => store.state().economies[color].stored,
        })
      }
    />
  );
};
