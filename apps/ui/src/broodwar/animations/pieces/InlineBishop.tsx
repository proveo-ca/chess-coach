import type { Component, JSX } from "solid-js";

import { svgPivotLocal } from "~/broodwar/animations/attackAnim";
import {
  TEAM_DARK,
  TEAM_LIGHT,
  TEAM_PRIMARY,
  type PieceColor,
} from "~/broodwar/animations/teamColors";

type InlineBishopProps = {
  color?: PieceColor;
  /** `back` = team canopy toward camera (firing up the board); `front` = glass cockpit. */
  face?: "front" | "back";
  /** Aim angle for gatling mounts only (hull stays fixed). Degrees, SVG/CSS y-down. */
  gunDeg?: number;
  /** When true, show short forward cannons; idle shows hole faces. */
  aiming?: boolean;
};

/** Idle gatling in local space (origin = pod center). Face toward viewer (no yaw). */
const GatlingFrontFaceLocal = (props: { hubPart: string; team: string }) => (
  <>
    <ellipse fill={props.team} cx="0" cy="0" rx="5" ry="6" />
    <g data-part={props.hubPart}>
      <circle fill="#9aa3ad" cx="0" cy="0" r="3.6" stroke="#5c6570" stroke-width="1.2" />
      <circle fill="#6a737c" cx="0" cy="0" r="2.9" stroke="none" />
      <circle fill="#1a1e22" cx="2" cy="0" r="0.7" stroke="none" />
      <circle fill="#1a1e22" cx="1" cy="1.73" r="0.7" stroke="none" />
      <circle fill="#1a1e22" cx="-1" cy="1.73" r="0.7" stroke="none" />
      <circle fill="#1a1e22" cx="-2" cy="0" r="0.7" stroke="none" />
      <circle fill="#1a1e22" cx="-1" cy="-1.73" r="0.7" stroke="none" />
      <circle fill="#1a1e22" cx="1" cy="-1.73" r="0.7" stroke="none" />
    </g>
  </>
);

/**
 * Attack gatling in local space: barrel along +x so parent rotate(deg) aims the muzzle.
 */
const GatlingAimCannonLocal = (props: {
  hubPart: string;
  flashPart: string;
  team: string;
  teamDark: string;
  barrelLen?: number;
}) => {
  const len = props.barrelLen ?? 11;

  return (
    <>
      <ellipse fill={props.team} cx="0" cy="0" rx="5" ry="6" />
      <circle data-part={props.hubPart} fill={props.teamDark} cx="0" cy="0" r="2" stroke="none" />
      <circle fill="#0d3a6e" cx="0" cy="0" r="1" stroke="none" />
      <g data-part="gatling-recoil">
        <rect fill="#555" x="2" y="-3.2" width={len - 2} height="6.4" rx="1.5" stroke-width="1" />
        <rect fill="#777" x={len - 2.2} y="-4" width="2.2" height="8" rx="0.8" stroke-width="1" />
        <circle
          data-part={props.flashPart}
          fill="#ffe08a"
          cx={len + 1.2}
          cy="0"
          r="3.2"
          stroke="none"
          opacity="0.15"
        />
      </g>
    </>
  );
};

type ShoulderMountProps = {
  cx: number;
  cy: number;
  near: boolean;
  gunDeg: number;
  aiming: boolean;
  team: string;
  teamDark: string;
};

const ShoulderMount: Component<ShoulderMountProps> = (props) => (
  <g transform={svgPivotLocal(props.cx, props.cy, props.gunDeg)}>
    {props.aiming ? (
      <GatlingAimCannonLocal
        hubPart={props.near ? "gatling-hub" : "gatling-hub-far"}
        flashPart={props.near ? "gatling-flash-near" : "gatling-flash-far"}
        team={props.team}
        teamDark={props.teamDark}
      />
    ) : (
      <>
        <GatlingFrontFaceLocal hubPart={props.near ? "gatling-hub" : "gatling-hub-far"} team={props.team} />
        <circle
          data-part={props.near ? "gatling-flash-near" : "gatling-flash-far"}
          fill="#ffe08a"
          cx="0"
          cy="0"
          r="3.2"
          stroke="none"
          opacity="0.15"
        />
      </>
    )}
  </g>
);

/**
 * Experimental Goliath. Hull/cockpit stay fixed; each shoulder gatling is mounted
 * with `translate(shoulder) rotate(aim)` — same turret pattern as the rook.
 */
export const InlineBishop: Component<InlineBishopProps> = (props) => {
  const color = () => props.color ?? "w";
  const team = () => TEAM_PRIMARY[color()];
  const teamLight = () => TEAM_LIGHT[color()];
  const teamDark = () => TEAM_DARK[color()];
  const face = () => props.face ?? "front";
  const gunDeg = () => props.gunDeg ?? 0;
  const aiming = () => props.aiming ?? false;

  const cockpit = (): JSX.Element =>
    face() === "back" ? (
      <>
        <ellipse fill={team()} cx="22.5" cy="20" rx="10" ry="12" />
        <ellipse fill={teamLight()} cx="18" cy="15" rx="4" ry="5" stroke="none" opacity="0.5" />
        <ellipse fill={teamDark()} cx="26" cy="20" rx="3.5" ry="2.5" stroke="none" opacity="0.75" />
      </>
    ) : (
      <>
        <ellipse fill="#999" cx="22.5" cy="20" rx="10" ry="12" />
        <ellipse fill="#bbb" cx="18" cy="16" rx="3" ry="5" stroke="none" />
      </>
    );

  const mounts = (): JSX.Element => (
    <>
      <ShoulderMount
        cx={10}
        cy={20}
        near
        gunDeg={gunDeg()}
        aiming={aiming()}
        team={team()}
        teamDark={teamDark()}
      />
      <ShoulderMount
        cx={35}
        cy={20}
        near={false}
        gunDeg={gunDeg()}
        aiming={aiming()}
        team={team()}
        teamDark={teamDark()}
      />
    </>
  );

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true" overflow="visible">
      <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
        <ellipse fill={team()} cx="12" cy="40" rx="5" ry="2.5" />
        <ellipse fill={team()} cx="33" cy="40" rx="5" ry="2.5" />
        <line x1="14" y1="38" x2="18" y2="28" stroke-width="2.5" />
        <line x1="31" y1="38" x2="27" y2="28" stroke-width="2.5" />

        {face() === "back" ? (
          <>
            {mounts()}
            {cockpit()}
          </>
        ) : (
          <>
            {cockpit()}
            {mounts()}
          </>
        )}
      </g>
    </svg>
  );
};
