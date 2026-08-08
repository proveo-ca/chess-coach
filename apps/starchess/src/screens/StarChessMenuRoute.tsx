/**
 * Menu route — `/starchess/` · START → `/single`.
 * Review / Multiplayer anchors stay disabled (Coming Soon).
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import { useNavigate, type RouteSectionProps } from "@solidjs/router";
import type { Component } from "solid-js";

import { StarChessMenuScreen } from "~/screens/StarChessMenuScreen";
import { clearMatchSession } from "~/store/matchSessionStore";
import type { NewGameOptions } from "~/types/newGame";

export const StarChessMenuRoute: Component<RouteSectionProps> = () => {
  const navigate = useNavigate();

  const onStartGame = (opts: NewGameOptions) => {
    // Fresh match — drop any mid-game resume blob.
    clearMatchSession();
    const q = new URLSearchParams({
      map: opts.map,
      team: opts.team,
    });
    navigate(`/single?${q.toString()}`);
  };

  return <StarChessMenuScreen onStartGame={onStartGame} />;
};
