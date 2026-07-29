import type { Component } from "solid-js";

import { TEAM_PRIMARY, type PieceColor } from "~/broodwar/animations/teamColors";

type InlineKnightProps = {
  color?: PieceColor;
};

/** Experimental Vulture. Nose / throw aim normalized to +x. */
export const InlineKnight: Component<InlineKnightProps> = (props) => {
  const team = () => TEAM_PRIMARY[props.color ?? "w"];

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true">
      <g transform="translate(22.5 22.5) scale(1.1) translate(-22.5 -22.5)">
        <g transform="translate(22.5 22.5) scale(-1 1) translate(-22.5 -22.5)">
          <g transform="translate(22.5 22.5) rotate(40) translate(-22.5 -22.5)">
            <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">
              <ellipse fill="#555" cx="22" cy="42" rx="12" ry="2" stroke="none" opacity="0.3" />
              <g data-part="body">
                <ellipse fill={team()} cx="31" cy="10" rx="5" ry="3.5" transform="rotate(-50 31 10)" />
                <path fill="#bbb" d="M5 40 Q1 37 4 33 L34 9 Q39 6 42 10 Q44 14 39 17z" />
                <path fill="#ccc" stroke="none" d="M8 36 L36 10 Q41 8 41 12 L11 36z" />
                <ellipse fill={team()} cx="16" cy="34" rx="5" ry="3.5" transform="rotate(-30 -1 -14)" />
                <path fill="#aaa" d="M14 32 L9 35 L11 34 L15 30z" />
                <path fill="#aaa" d="M27 15 L22 18 L24 17 L28 13z" />
                <circle data-part="frag-muzzle" cx="40" cy="12" r="1.5" fill="#888" stroke="none" />
                <ellipse fill="#bbb" cx="24" cy="20" rx="4" ry="3.5" />
                <ellipse fill="#ddd" cx="24" cy="18" rx="3.5" ry="3" />
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
