/** Transparent panel shell with a team-colored border (`--team`). */
import clsx from "clsx";
import type { JSX } from "solid-js";

import styles from "~/components/primitives/TeamFrame.module.css";

export type TeamFrameProps = {
  /** CSS color for the border (sets `--team`). */
  teamColor: string;
  children: JSX.Element;
  class?: string;
  role?: JSX.HTMLAttributes<HTMLDivElement>["role"];
  "aria-label"?: string;
  "data-testid"?: string;
  "data-team"?: string;
  "data-phase"?: string;
  "data-density"?: string;
  "data-turn"?: number | string;
  "data-gas"?: number | string;
};

export const TeamFrame = (props: TeamFrameProps) => (
  <div
    class={clsx(styles.frame, props.class)}
    style={{ "--team": props.teamColor }}
    role={props.role}
    aria-label={props["aria-label"]}
    data-testid={props["data-testid"]}
    data-team={props["data-team"]}
    data-phase={props["data-phase"]}
    data-density={props["data-density"]}
    data-turn={props["data-turn"]}
    data-gas={props["data-gas"]}
  >
    {props.children}
  </div>
);
