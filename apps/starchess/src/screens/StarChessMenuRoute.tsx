/**
 * Menu route — `/starchess/` · START → `/single` · Tutorial → `/tutorial/fog/king`
 * · Review → `/review`. Multiplayer stays disabled (Coming Soon).
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import { useNavigate, type RouteSectionProps } from "@solidjs/router";
import type { Component } from "solid-js";

import {
  StarChessMenuScreen,
  type StarChessMenuAction,
} from "~/screens/StarChessMenuScreen";
import { clearMatchSession } from "~/store/matchSessionStore";
import type { NewGameOptions } from "~/types/newGame";
import { tutorialPath } from "~/tutorial/tutorialScript";

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

  const onAction = (action: StarChessMenuAction) => {
    if (action === "tutorial") navigate(tutorialPath("fog"));
    if (action === "review") navigate("/review");
  };

  return (
    <StarChessMenuScreen onStartGame={onStartGame} onAction={onAction} />
  );
};
