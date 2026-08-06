import { createEffect, createSignal, onCleanup, type Component, type JSX } from "solid-js";

import { svgPivotLocal } from "~/presentation/animations/attackAnim";
import {
  INK_BLACK,
  TEAM_DARK,
  TEAM_LIGHT,
  TEAM_PRIMARY,
  type PieceColor,
  NERD_FRAME,
} from "~/presentation/animations/teamColors";

/** Quiet-move wheel crank — feet trace full circles about the hip. */
export type BishopCrank = {
  stepMs: number;
  stepCount: number;
  /** +1 = clockwise (moving +file / right); −1 = counter-clockwise. */
  sense: 1 | -1;
};

type InlineBishopProps = {
  color?: PieceColor;
  /** `back` = team canopy toward camera (firing up the board); `front` = glass cockpit. */
  face?: "front" | "back";
  /** Aim angle for gatling mounts only (hull stays fixed). Degrees, SVG/CSS y-down. */
  gunDeg?: number;
  /** When true, show short forward cannons; idle shows hole faces. */
  aiming?: boolean;
  /** Charon Booster Missiles armed — twin shoulder missile launchers popped. */
  armed?: boolean;
  /** Play the 2-canister arm animation (cockpit crouch + launcher raise). */
  armAnim?: boolean;
  /** Aim for armed launchers (special-move diagonal). Omit for the default \o/ pose. */
  launcherDeg?: number;
  /** Loaded green missile caps; hidden once the missile attack animation begins. */
  launcherCapsVisible?: boolean;
  crank?: BishopCrank;
};

/** 6 o'clock in SVG y-down (φ=0 at 3 o'clock, increasing clockwise). */
const SIX_OCLOCK = Math.PI / 2;

/**
 * Reach matches nerd `*B.svg` hip→foot distance; equal thigh/shin ⇒ 90° knee
 * puts the foot on a circle of this radius about the hip.
 */
const FOOT_RADIUS = Math.hypot(6, 12); // ≈ 13.416
const SEG = FOOT_RADIUS / Math.SQRT2;

type Pt = { x: number; y: number };

/**
 * Right-triangle leg: hip fixed, foot on circle at `phase`, 90° at knee.
 * `outward` pushes the knee away from the body midline (−1 left, +1 right).
 */
export const bishopLegPose = (hip: Pt, phase: number, outward: -1 | 1) => {
  const ux = Math.cos(phase);
  const uy = Math.sin(phase);
  // 90° CCW from û in y-down.
  const vx = -uy;
  const vy = ux;
  const foot = { x: hip.x + FOOT_RADIUS * ux, y: hip.y + FOOT_RADIUS * uy };
  // K = H + (L²/R)û + outward·(L²/R)v̂ with L=R/√2 ⇒ L²/R = R/2.
  const knee = {
    x: hip.x + (FOOT_RADIUS / 2) * ux + outward * (FOOT_RADIUS / 2) * vx,
    y: hip.y + (FOOT_RADIUS / 2) * uy + outward * (FOOT_RADIUS / 2) * vy,
  };
  return { hip, knee, foot, seg: SEG };
};

/** Idle gatling in local space (origin = pod center). Face toward viewer (no yaw). */
const GatlingFrontFaceLocal = (props: { hubPart: string; team: string }) => (
  <>
    <ellipse fill={props.team} cx="0" cy="0" rx="5" ry="6" />
    <g data-part={props.hubPart}>
      <circle fill="#fff" cx="0" cy="0" r="3.6" stroke="#222" stroke-width="1.2" />
      <circle fill="#555" cx="0" cy="0" r="2.9" stroke="none" />
      <circle fill="#222" cx="2" cy="0" r="0.7" stroke="none" />
      <circle fill="#222" cx="1" cy="1.73" r="0.7" stroke="none" />
      <circle fill="#222" cx="-1" cy="1.73" r="0.7" stroke="none" />
      <circle fill="#222" cx="-2" cy="0" r="0.7" stroke="none" />
      <circle fill="#222" cx="-1" cy="-1.73" r="0.7" stroke="none" />
      <circle fill="#222" cx="1" cy="-1.73" r="0.7" stroke="none" />
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
      <circle fill="#222" cx="0" cy="0" r="1" stroke="none" />
      <g data-part="gatling-recoil">
        <rect fill="#555" x="2" y="-3.2" width={len - 2} height="6.4" rx="1.5" stroke-width="1" />
        <rect fill="#555" x={len - 2.2} y="-4" width="2.2" height="8" rx="0.8" stroke-width="1" />
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

/** Armed Charon launcher in local space: rail + missile nose along +x (1.5× bore). */
const CharonLauncherLocal = (props: {
  team: string;
  teamDark: string;
  capsVisible: boolean;
}) => (
  <g data-part="charon-launcher-body">
    <ellipse fill={props.team} cx="0" cy="0" rx="6.75" ry="8.25" />
    <circle fill={props.teamDark} cx="0" cy="0" r="2.7" stroke="none" />
    <rect fill="#2b3440" x="3" y="-4.65" width="12" height="9.3" rx="3" stroke-width="1.2" />
    {props.capsVisible ? (
      <g data-part="charon-launcher-caps">
        <rect fill="#9ff3c0" x="12" y="-3" width="3" height="6" rx="1.5" stroke="none" />
        <circle fill="#eafff3" cx="15.4" cy="0" r="3.15" stroke="#0f4f35" stroke-width="1.2" />
        <circle
          data-part="charon-launcher-glow"
          fill="#3dce6a"
          cx="15.4"
          cy="0"
          r="5.1"
          stroke="none"
          opacity="0.28"
        />
      </g>
    ) : null}
  </g>
);

const CharonShoulderLauncher = (props: {
  cx: number;
  cy: number;
  deg: number;
  team: string;
  teamDark: string;
  capsVisible: boolean;
}) => (
  <g transform={svgPivotLocal(props.cx, props.cy, props.deg)} data-part="charon-launcher">
    <g data-part="charon-launcher-raise">
      <CharonLauncherLocal
        team={props.team}
        teamDark={props.teamDark}
        capsVisible={props.capsVisible}
      />
    </g>
  </g>
);

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
 * Idle / attack / deploy: standing legs (`*B.svg`). Quiet moves: feet roll on
 * full circles about the hips (steam-wheel crank), 90° knees.
 */
export const InlineBishop: Component<InlineBishopProps> = (props) => {
  const color = () => props.color ?? "w";
  const team = () => TEAM_PRIMARY[color()];
  const teamLight = () => TEAM_LIGHT[color()];
  const teamDark = () => TEAM_DARK[color()];
  const face = () => props.face ?? "front";
  const gunDeg = () => props.gunDeg ?? 0;
  const aiming = () => props.aiming ?? false;
  const armed = () => props.armed === true;
  const armAnim = () => props.armAnim === true;
  const launcherDeg = () => props.launcherDeg;
  const launcherCapsVisible = () => props.launcherCapsVisible !== false;

  /** Left-foot phase; right is always +π (12 when left is at 6). */
  const [phase, setPhase] = createSignal(SIX_OCLOCK);

  createEffect(() => {
    const c = props.crank;
    if (!c) {
      setPhase(SIX_OCLOCK);
      return;
    }
    const t0 = performance.now();
    const total = Math.max(1, c.stepMs * c.stepCount);
    let raf = 0;
    const tick = (now: number) => {
      const e = Math.min(Math.max(0, now - t0), total);
      setPhase(SIX_OCLOCK + c.sense * (e / c.stepMs) * Math.PI * 2);
      if (e < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    onCleanup(() => cancelAnimationFrame(raf));
  });

  const cockpit = (): JSX.Element =>
    face() === "back" ? (
      <>
        <ellipse fill={team()} cx="22.5" cy="20" rx="10" ry="12" />
        <ellipse fill={teamLight()} cx="18" cy="15" rx="4" ry="5" stroke="none" opacity="0.5" />
        <ellipse fill={teamDark()} cx="26" cy="20" rx="3.5" ry="2.5" stroke="none" opacity="0.75" />
      </>
    ) : (
      <>
        <ellipse fill="#fff" cx="22.5" cy="20" rx="10" ry="12" />
        <ellipse fill="#fff" cx="18" cy="16" rx="3" ry="5" stroke="none" />
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

  /** Twin shoulder launchers popped by the 2-gas Charon arm. */
  const charonLaunchers = (): JSX.Element | null => {
    if (!armed()) return null;
    const aim = launcherDeg();
    const leftDeg = aim ?? -135;
    const rightDeg = aim ?? -45;
    return (
      <g data-part="charon-launchers" data-launcher-aim={aim != null ? String(aim) : undefined}>
        <CharonShoulderLauncher
          cx={14}
          cy={20}
          deg={leftDeg}
          team={team()}
          teamDark={teamDark()}
          capsVisible={launcherCapsVisible()}
        />
        <CharonShoulderLauncher
          cx={31}
          cy={20}
          deg={rightDeg}
          team={team()}
          teamDark={teamDark()}
          capsVisible={launcherCapsVisible()}
        />
      </g>
    );
  };

  /**
   * Standing pose matches `*B.svg` (colinear hip→ankle + foot ellipses).
   * Wheel-crank pose only while `crank` is set (quiet moves) — attack/deploy
   * must keep the standing legs frozen.
   */
  const mechaLeg = (side: "left" | "right"): JSX.Element => {
    const left = side === "left";
    const hip = left ? { x: 18, y: 28 } : { x: 27, y: 28 };
    const stand = left
      ? { knee: { x: 16, y: 33 }, foot: { x: 14, y: 38 }, pad: { cx: 12, cy: 40 } }
      : { knee: { x: 29, y: 33 }, foot: { x: 31, y: 38 }, pad: { cx: 33, cy: 40 } };
    const pose = () => {
      if (!props.crank) {
        return {
          knee: stand.knee,
          foot: stand.foot,
          pad: stand.pad,
        };
      }
      const p = bishopLegPose(hip, left ? phase() : phase() + Math.PI, left ? 1 : -1);
      return {
        knee: p.knee,
        foot: p.foot,
        pad: { cx: p.foot.x, cy: p.foot.y },
      };
    };
    return (
      <g data-part={`leg-${side}`}>
        <g data-part={`leg-${side}-top`}>
          <line
            x1={hip.x}
            y1={hip.y}
            x2={pose().knee.x}
            y2={pose().knee.y}
            stroke={INK_BLACK}
            stroke-width="2.5"
            stroke-linecap="round"
          />
          <circle
            fill={INK_BLACK}
            cx={pose().knee.x}
            cy={pose().knee.y}
            r="1.5"
            stroke={INK_BLACK}
            stroke-width="1"
          />
          <g data-part={`leg-${side}-bottom`}>
            <line
              x1={pose().knee.x}
              y1={pose().knee.y}
              x2={pose().foot.x}
              y2={pose().foot.y}
              stroke={INK_BLACK}
              stroke-width="2.5"
              stroke-linecap="round"
            />
            <ellipse
              data-part={`leg-${side}-foot`}
              fill={team()}
              cx={pose().pad.cx}
              cy={pose().pad.cy}
              rx="5"
              ry="2.5"
              stroke={INK_BLACK}
              stroke-width="2"
            />
          </g>
        </g>
      </g>
    );
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 45 45"
      aria-hidden="true"
      overflow="visible"
      data-bishop-face={face()}
      data-charon-armed={armed() ? "true" : undefined}
      data-charon-arm-anim={armAnim() ? "true" : undefined}
    >
      <g transform={NERD_FRAME.B}>
        <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
          {/* Legs under cockpit so the hull always occludes the hip joints. */}
          <g data-part="body">
            {mechaLeg("left")}
            {mechaLeg("right")}
          </g>
          <g data-part="head">
            {face() === "back" ? (
              <>
                {mounts()}
                <g data-part="cockpit">{cockpit()}</g>
                {/* Back: full launchers render over the whole Goliath. */}
                {charonLaunchers()}
              </>
            ) : (
              <>
                {/* Front: 45° / 135° launchers sit under the cockpit glass. */}
                {charonLaunchers()}
                <g data-part="cockpit">{cockpit()}</g>
                {mounts()}
              </>
            )}
          </g>
        </g>
      </g>
    </svg>
  );
};
