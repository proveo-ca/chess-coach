/**
 * Menu route — `/starchess/` · START → `/single` · Tutorial → `/tutorial/fog/king`
 * · Review → `/review`. Multiplayer stays disabled (Coming Soon).
 * Redirects from `/chess/` play {@link MenuArrival} (Chess mockup → StarChess).
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import { useNavigate, type RouteSectionProps } from "@solidjs/router";
import { createSignal, onMount, type Component } from "solid-js";

import {
  MenuArrival,
} from "~/screens/menuSky/MenuArrival";
import type { StarChessMenuAction } from "~/screens/MenuScreen.tsx";
import { consumeChessMenuEntrance } from "~/store/menuEntrance";
import { clearMatchSession } from "~/store/matchSessionStore";
import type { MenuSurface } from "~/types/menu";
import type { NewGameOptions } from "~/types/newGame";
import { tutorialPath } from "~/tutorial/tutorialScript";

export const MenuRoute: Component<RouteSectionProps> = () => {
  const navigate = useNavigate();
  const fromChess = consumeChessMenuEntrance();
  const [surface, setSurface] = createSignal<MenuSurface>(
    fromChess ? "chess" : "starchess",
  );

  onMount(() => {
    if (!fromChess) return;
    // Let the Chess mockup read, then play the arrival.
    const id = window.setTimeout(() => setSurface("starchess"), 480);
    return () => window.clearTimeout(id);
  });

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
    <MenuArrival
      surface={surface()}
      onStartGame={onStartGame}
      onAction={onAction}
    />
  );
};
