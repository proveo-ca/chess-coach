import type { Component } from "solid-js";

import type { AimPose } from "~/presentation/pieces/geometry";
import { TEAM_PRIMARY, type PieceColor, PIECE_FRAME } from "~/presentation/pieces/teamColors";

type InlineHoverbikeProps = {
  color?: PieceColor;
  /**
   * When set (attack / L-path move), only the craft hull aims — the ground
   * oval stays axis-aligned under the square.
   */
  aimPose?: AimPose;
};

/**
 * Hoverbike nose → local +x. The art is drawn nose-up-right, so normalizing it
 * costs a mirror *and* 40°; the rest pose is simply this transform's absence,
 * which is what makes it match `apps/chess/public/pieces/nerd/*N.svg`.
 */
const NOSE_TO_PLUS_X = "scale(-1, 1) rotate(40deg)";

/**
 * Combined aim: `aimPose` first, then the normalization — the same order the
 * old nested `hullAimTransform` → mirror → rotate(40) groups produced. Returns
 * `undefined` at rest so the group falls back to the shipping silhouette.
 */
const hullPoseCss = (aim?: AimPose): string | undefined => {
  if (!aim) return undefined;
  const flip = aim.mirrorX ? "scale(-1, 1) " : "";
  return `${flip}rotate(${aim.rotateDeg}deg) ${NOSE_TO_PLUS_X}`;
};

/** Experimental Hoverbike. Rest ≡ `*N.svg`; aim normalizes the nose to +x. */
export const InlineHoverbike: Component<InlineHoverbikeProps> = (props) => {
  const team = () => TEAM_PRIMARY[props.color ?? "w"];

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true" overflow="visible">
      {/* Ground blob in raw viewBox space — never inside PIECE_FRAME or aim. */}
      <ellipse
        data-part="ground-shadow"
        fill="#555"
        cx="22.5"
        cy="41"
        rx="11"
        ry="2.2"
        stroke="none"
        opacity="0.3"
      />
      <g transform={PIECE_FRAME.N}>
        <g transform="translate(22.5 22.5) scale(1.1) translate(-22.5 -22.5)">
          <g
            data-part="hull"
            data-pose={props.aimPose ? "aim" : "rest"}
            class="sc-unit-pose"
            style={{ transform: hullPoseCss(props.aimPose) }}
          >
            <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">
              <g data-part="body">
                <ellipse
                  fill={team()}
                  cx="31"
                  cy="10"
                  rx="5"
                  ry="3.5"
                  transform="rotate(-50 31 10)"
                />
                <path fill="#fff" d="M5 40 Q1 37 4 33 L34 9 Q39 6 42 10 Q44 14 39 17z" />
                <path fill="#fff" stroke="none" d="M8 36 L36 10 Q41 8 41 12 L11 36z" />
                <ellipse
                  fill={team()}
                  cx="16"
                  cy="34"
                  rx="5"
                  ry="3.5"
                  transform="rotate(-30 -1 -14)"
                />
                <path fill="#fff" d="M14 32 L9 35 L11 34 L15 30z" />
                <path fill="#fff" d="M27 15 L22 18 L24 17 L28 13z" />
                <circle data-part="frag-muzzle" cx="40" cy="12" r="1.5" fill="#fff" stroke="none" />
                <ellipse fill="#fff" cx="24" cy="20" rx="4" ry="3.5" />
                <ellipse fill="#fff" cx="24" cy="18" rx="3.5" ry="3" />
                <path fill={team()} d="M21.5 18 L24 16.5 L26.5 18 L24 19.5z" />
                <path fill="#fff" stroke="#222" stroke-width="1" d="M22 21 Q24 23.5 26 21z" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
};
