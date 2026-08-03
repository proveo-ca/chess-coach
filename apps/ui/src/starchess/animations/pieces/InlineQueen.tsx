import { NERD_FRAME, TEAM_PRIMARY, type PieceColor } from "~/starchess/animations/teamColors";

type InlineQueenProps = {
  color?: PieceColor;
};

/**
 * Experimental Battlecruiser. Shipping art is bow-down; we rotate the *framed*
 * upright glyph so the laser muzzle stays on local +x (frame-then-rotate drifts
 * the muzzle off-axis and the bolt looks uncentered when aiming).
 */
export function InlineQueen(props: InlineQueenProps) {
  const team = () => TEAM_PRIMARY[props.color ?? "w"];

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true">
      {/* Rotate outside NERD_FRAME so the bow tip stays on y=22.5 after aim normalize. */}
      <g transform="translate(22.5 22.5) rotate(-90) translate(-22.5 -22.5)">
        <g transform={NERD_FRAME.Q}>
          <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8">
            <ellipse fill="#555" cx="22.5" cy="42" rx="16" ry="2" stroke="none" opacity=".25" />
            <rect data-part="jump-thruster" fill="#555" x="13.5" y="2.5" width="7" height="12" rx="3" />
            <rect data-part="jump-thruster" fill="#555" x="24.5" y="2.5" width="7" height="12" rx="3" />
            <ellipse data-part="jump-thruster-cap" fill={team()} cx="17" cy="3.5" rx="3" ry="1.6" />
            <ellipse data-part="jump-thruster-cap" fill={team()} cx="28" cy="3.5" rx="3" ry="1.6" />
            <path fill="#fff" d="M5 9 14 6 18 9h9l4-3 9 3-2 10-11-2-2 5h-5l-2-5-11 2z" />
            <path fill={team()} d="M7 10 14 8l3 3-2 4-8 1z" />
            <path fill={team()} d="m38 10-7-2-3 3 2 4 8 1z" />
            <path fill="#fff" d="m19 12 3.5-2 3.5 2 3 20-6.5 4-6.5-4z" />
            <path fill={team()} d="m18 22 4.5 3 4.5-3 1 7-5.5 4-5.5-4z" />
            <path fill="#fff" d="m4 32 12-4 6.5 3 6.5-3 12 4 1 7-9 4H12l-9-4z" />
            <path fill={team()} d="m6 33 9-3 3 3-3 6-9-1z" />
            <path fill={team()} d="m39 33-9-3-3 3 3 6 9-1z" />
            <path fill="#222" d="m7 35 6-1 1 2-7 1z" />
            <path fill="#222" d="m38 35-6-1-1 2 7 1z" />
            <circle data-part="laser-muzzle" cx="22.5" cy="42" r="2" fill={team()} stroke="none" />
          </g>
        </g>
      </g>
    </svg>
  );
}
