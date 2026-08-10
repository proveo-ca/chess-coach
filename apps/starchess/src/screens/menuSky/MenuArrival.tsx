/**
 * Chess → StarChess menu arrival — glass clears, Selena → Kerrigan, buttons shatter,
 * spatial StarChess chrome fades in. Driven by story toggle or /chess/ redirect.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import {
  Show,
  createEffect,
  createSignal,
  on,
  type Component,
} from "solid-js";

import { ChessMenuMockup } from "~/screens/menuSky/ChessMenuMockup";
import {
  MenuScreen,
  type StarChessMenuScreenProps,
} from "~/screens/MenuScreen.tsx";
import type { CoachIdentity } from "~/types/coach";
import type { MenuSurface } from "~/types/menu";
import styles from "~/screens/menuSky/MenuArrival.module.css";

export type { MenuSurface } from "~/types/menu";

export type MenuArrivalProps = StarChessMenuScreenProps & {
  /** Target surface — chess shows the Coach mockup; starchess plays the arrival. */
  surface: MenuSurface;
  /** Optional hook when a chess→starchess arrival finishes. */
  onArrived?: () => void;
};

type Phase =
  | "chess"
  | "glass"
  | "identity"
  | "shatter"
  | "reveal"
  | "starchess";

/** Chess → StarChess beat timings (ms from transition start). */
const T_IDENTITY = 420;
const T_SHATTER = 780;
const T_REVEAL = 1050;
const T_DONE = 2200;

export const MenuArrival: Component<MenuArrivalProps> = (props) => {
  const [phase, setPhase] = createSignal<Phase>(
    props.surface === "chess" ? "chess" : "starchess",
  );

  createEffect(
    on(
      () => props.surface,
      (surface, prev) => {
        const timers: ReturnType<typeof setTimeout>[] = [];

        if (surface === "chess") {
          setPhase("chess");
          return () => timers.forEach(clearTimeout);
        }

        // Mounted already on StarChess — no entrance.
        if (prev === undefined) {
          setPhase("starchess");
          return () => timers.forEach(clearTimeout);
        }

        // chess → starchess arrival
        setPhase("glass");
        timers.push(
          setTimeout(() => setPhase("identity"), T_IDENTITY),
          setTimeout(() => setPhase("shatter"), T_SHATTER),
          setTimeout(() => setPhase("reveal"), T_REVEAL),
          setTimeout(() => {
            setPhase("starchess");
            props.onArrived?.();
          }, T_DONE),
        );
        return () => timers.forEach(clearTimeout);
      },
    ),
  );

  const identity = (): CoachIdentity => {
    const p = phase();
    if (p === "chess" || p === "glass") return "selena";
    return "kerrigan";
  };

  const glass = (): "solid" | "clearing" | "gone" => {
    const p = phase();
    if (p === "chess") return "solid";
    if (p === "reveal" || p === "starchess") return "gone";
    return "clearing";
  };

  const showMock = () => phase() !== "starchess";
  const shatter = () => {
    const p = phase();
    return p === "shatter" || p === "reveal";
  };
  const fadeChrome = () => shatter();

  const starChrome = (): "hidden" | "in" | "on" => {
    const p = phase();
    if (p === "starchess") return "on";
    if (p === "reveal") return "in";
    return "hidden";
  };

  return (
    <div
      class={styles.root}
      data-testid="menu-arrival"
      data-phase={phase()}
      data-surface={props.surface}
      data-helm-ferry-stage
    >
      <MenuScreen
        identity={identity()}
        chrome={starChrome()}
        showAvatar={!showMock()}
        onAction={props.onAction}
        onStartGame={props.onStartGame}
      />
      <Show when={showMock()}>
        <ChessMenuMockup
          glass={glass()}
          shatter={shatter()}
          fadeChrome={fadeChrome()}
          identity={identity()}
        />
      </Show>
    </div>
  );
};
