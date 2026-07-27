import type { Component } from "solid-js";

/** Experimental Battlecruiser. Bow / laser aim normalized to +x. */
export const InlineQueen: Component = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true">
    {/* Original hammerhead bow pointed +y (down); rotate -90° so bow aims +x */}
    <g transform="translate(22.5 22.5) rotate(-90) translate(-22.5 -22.5)">
      <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8">
        <ellipse fill="#555" cx="22.5" cy="42" rx="16" ry="2" stroke="none" opacity=".25" />
        <rect fill="#777" x="13.5" y="2.5" width="7" height="12" rx="3" />
        <rect fill="#777" x="24.5" y="2.5" width="7" height="12" rx="3" />
        <ellipse fill="#69bdff" cx="17" cy="3.5" rx="3" ry="1.6" />
        <ellipse fill="#69bdff" cx="28" cy="3.5" rx="3" ry="1.6" />
        <path fill="#aaa" d="M5 9 14 6 18 9h9l4-3 9 3-2 10-11-2-2 5h-5l-2-5-11 2z" />
        <path fill="#3b7dd8" d="M7 10 14 8l3 3-2 4-8 1z" />
        <path fill="#3b7dd8" d="m38 10-7-2-3 3 2 4 8 1z" />
        <path fill="#888" d="m19 12 3.5-2 3.5 2 3 20-6.5 4-6.5-4z" />
        <path fill="#3b7dd8" d="m18 22 4.5 3 4.5-3 1 7-5.5 4-5.5-4z" />
        <path fill="#aaa" d="m4 32 12-4 6.5 3 6.5-3 12 4 1 7-9 4H12l-9-4z" />
        <path fill="#3b7dd8" d="m6 33 9-3 3 3-3 6-9-1z" />
        <path fill="#3b7dd8" d="m39 33-9-3-3 3 3 6 9-1z" />
        <path fill="#333" d="m7 35 6-1 1 2-7 1z" />
        <path fill="#333" d="m38 35-6-1-1 2 7 1z" />
        <circle data-part="laser-muzzle" cx="22.5" cy="42" r="2" fill="#69bdff" stroke="none" />
      </g>
    </g>
  </svg>
);
