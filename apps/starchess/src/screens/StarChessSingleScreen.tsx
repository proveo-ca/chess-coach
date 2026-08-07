/**
 * Single-player match — `/starchess/single?map=&team=` (+ optional `scfen=`).
 * Adjutant script always plays the opposite of `team` (White or Black).
 */
import { useNavigate, useSearchParams, type RouteSectionProps } from "@solidjs/router";
import { adjutant } from "@chess-coach/starchess-core";
import type { StarChessColor } from "@chess-coach/starchess-core";
import type { Component } from "solid-js";

import { browserLocation, readScfenQuery } from "~/adapters/browser";
import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { StarChessScreen } from "~/app/StarChessScreen";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import { NERD_STARTING_SCFEN } from "~/stories/fixtures/seeds";
import type { BoardVariant } from "~/types/board";

const MAPS: readonly BoardVariant[] = ["eclipse", "butter", "vermeer"];

const asOne = (raw: string | string[] | undefined): string | undefined =>
  Array.isArray(raw) ? raw[0] : raw;

const parseMap = (raw: string | string[] | undefined): BoardVariant => {
  const v = asOne(raw);
  return MAPS.includes(v as BoardVariant) ? (v as BoardVariant) : "eclipse";
};

const parseTeam = (raw: string | string[] | undefined): StarChessColor =>
  asOne(raw) === "b" ? "b" : "w";

const MatchInner: Component<{
  boardVariant: BoardVariant;
  team: StarChessColor;
  onExitToMenu: () => void;
}> = (props) => {
  const store = useMatchStore();
  const opponentColor = (): StarChessColor => (props.team === "w" ? "b" : "w");

  return (
    <StarChessScreen
      boardVariant={props.boardVariant}
      starChessMode
      armTimer
      turnChrome="sidebar"
      onExitToMenu={props.onExitToMenu}
      autoQueueOpponent={(snap) =>
        adjutant(snap, {
          color: opponentColor(),
          storedFor: (color) => store.state().economies[color].stored,
        })
      }
    />
  );
};

export const StarChessSingleScreen: Component<RouteSectionProps> = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const map = () => parseMap(params.map);
  const team = () => parseTeam(params.team);
  const scfen =
    readScfenQuery(browserLocation.search()) ?? NERD_STARTING_SCFEN;

  const store = createMatchStore({
    initial: {
      ...createMatchStateFromScfen(scfen, 3),
      viewer: team(),
    },
  });

  const exitToMenu = () => navigate("/");

  return (
    <LiveMatchShell world={map()} testId="starchess-app">
      <MatchStoreProvider store={store}>
        <MatchInner
          boardVariant={map()}
          team={team()}
          onExitToMenu={exitToMenu}
        />
      </MatchStoreProvider>
    </LiveMatchShell>
  );
};
