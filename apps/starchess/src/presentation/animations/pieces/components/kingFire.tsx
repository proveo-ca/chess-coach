import { type Component } from "solid-js";

/** Candidate hull spots for fire columns (cx, cy). */
export const KING_FIRE_SPOTS: ReadonlyArray<{ cx: number; cy: number }> = [
  { cx: 8.5, cy: 26 },
  { cx: 36.5, cy: 26 },
  { cx: 14, cy: 24 },
  { cx: 31, cy: 24 },
  { cx: 22.5, cy: 22 },
  { cx: 18, cy: 30 },
  { cx: 27, cy: 30 },
  { cx: 22.5, cy: 33 },
  { cx: 11, cy: 32 },
  { cx: 34, cy: 32 },
];

/** Deterministic pick of `count` distinct spots from seed. */
export const pickFireSpots = (
  seed: number,
  count: number,
): Array<{ cx: number; cy: number }> => {
  const order = KING_FIRE_SPOTS.map((_, i) => i);
  let s = seed >>> 0 || 1;
  for (let i = order.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  return order.slice(0, count).map((i) => KING_FIRE_SPOTS[i]!);
};

/** One soft fire column + local smoke (sizes match small/big HP look). */
export const FireColumn: Component<{
  cx: number;
  cy: number;
  size: "small" | "big";
  coreId: string;
  emberId: string;
  smokeId: string;
}> = (props) => {
  const big = () => props.size === "big";
  const colRx = () => (big() ? 6 : 3.2);
  const colRy = () => (big() ? 11 : 9.5);
  const washRx = () => (big() ? 8 : 7);
  const washRy = () => (big() ? 12 : 10);
  const smokeRx = () => (big() ? 6.5 : 5.5);
  const smokeRy = () => (big() ? 8 : 7);

  return (
    <g transform={`translate(${props.cx - 9} ${props.cy - 26})`}>
      <g data-part="fire-smoke">
        <ellipse
          cx="9.5"
          cy="14"
          rx={smokeRx()}
          ry={smokeRy()}
          fill={`url(#${props.smokeId})`}
        />
        <ellipse
          cx="7.5"
          cy="10"
          rx={big() ? 5 : 4}
          ry={big() ? 6.5 : 5.5}
          fill={`url(#${props.smokeId})`}
          opacity="0.7"
        />
      </g>
      <g data-part="fire-glow">
        <ellipse cx="9" cy="28" rx={washRx()} ry={washRy()} fill={`url(#${props.emberId})`} />
        <ellipse cx="8.8" cy="26" rx={colRx()} ry={colRy()} fill={`url(#${props.coreId})`} />
        <ellipse
          cx="8.5"
          cy="29"
          rx={big() ? 3.2 : 2.2}
          ry={big() ? 7 : 5.5}
          fill={`url(#${props.coreId})`}
          opacity="0.85"
        />
        <ellipse
          cx="9.2"
          cy="22"
          rx={big() ? 3.2 : 2.4}
          ry={big() ? 5 : 4}
          fill="#ffe8a0"
          opacity="0.45"
        />
      </g>
    </g>
  );
};
