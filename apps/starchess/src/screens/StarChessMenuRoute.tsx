/**
 * Menu route — `/starchess/` · START navigates to `/single`.
 */
import { useNavigate, type RouteSectionProps } from "@solidjs/router";
import type { Component } from "solid-js";

import { StarChessMenuScreen } from "~/screens/StarChessMenuScreen";
import type { NewGameOptions } from "~/types/newGame";

export const StarChessMenuRoute: Component<RouteSectionProps> = () => {
  const navigate = useNavigate();

  const onStartGame = (opts: NewGameOptions) => {
    const q = new URLSearchParams({
      map: opts.map,
      team: opts.team,
    });
    navigate(`/single?${q.toString()}`);
  };

  return <StarChessMenuScreen onStartGame={onStartGame} />;
};
