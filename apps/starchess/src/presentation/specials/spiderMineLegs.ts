/**
 * Spider mine leg geometry — corner stance (deploy/chase) vs trail-hugging missile.
 */

export const MINE_LEG_COUNT = 4;

/**
 * Four corner tips in the 40×40 viewBox (body center 20,20) —
 * top-left, top-right, bottom-right, bottom-left.
 */
export const RADIAL_LEG_TIPS: readonly [number, number][] = [
  [7.5, 7.5],
  [32.5, 7.5],
  [32.5, 32.5],
  [7.5, 32.5],
];

export type LegGeom = {
  hx: number;
  hy: number;
  mx: number;
  my: number;
  tx: number;
  ty: number;
};

/** Corner spider stance — hips on enamel rim, tips toward board corners. */
export const radialLeg = (i: number): LegGeom => {
  const [tx, ty] = RADIAL_LEG_TIPS[i]!;
  // TL / TR / BR / BL in SVG (y-down).
  const ang = - (3 * Math.PI) / 4 + (i * Math.PI) / 2;
  const hx = 20 + Math.cos(ang) * 7.2;
  const hy = 20 + Math.sin(ang) * 7.2;
  const mx = (hx + tx) / 2 + Math.cos(ang + Math.PI / 2) * 1.4;
  const my = (hy + ty) / 2 + Math.sin(ang + Math.PI / 2) * 1.4;
  return { hx, hy, mx, my, tx, ty };
};

/**
 * Missile stance — legs swept opposite flight (+x in the aimed hull frame),
 * hugging the green trail behind the body.
 */
export const missileLeg = (i: number): LegGeom => {
  // Fan ~±36° around local −x (opposite of target / trail direction).
  const spread = ((i - 1.5) / 1.5) * (36 * Math.PI) / 180;
  const ang = Math.PI + spread;
  const tipR = 15.5;
  const hipR = 6.8;
  const hx = 20 + Math.cos(ang) * hipR;
  const hy = 20 + Math.sin(ang) * hipR;
  const tx = 20 + Math.cos(ang) * tipR;
  const ty = 20 + Math.sin(ang) * tipR;
  const mx = (hx + tx) / 2 + Math.cos(ang + Math.PI / 2) * 0.9;
  const my = (hy + ty) / 2 + Math.sin(ang + Math.PI / 2) * 0.9;
  return { hx, hy, mx, my, tx, ty };
};

export const legPath = (g: LegGeom): string =>
  `M${g.hx.toFixed(1)} ${g.hy.toFixed(1)} Q${g.mx.toFixed(1)} ${g.my.toFixed(1)} ${g.tx.toFixed(1)} ${g.ty.toFixed(1)}`;
