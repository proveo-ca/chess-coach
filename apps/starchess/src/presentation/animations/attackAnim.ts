import type { Square } from "chess.js";

import { ATTACK_MS } from "~/presentation/constants";
import type { AttackAnimKind } from "~/presentation/types";

export { ATTACK_MS, FRAG_FLIGHT_MS } from "~/presentation/constants";
export type { AttackAnimKind } from "~/presentation/types";

export type DemoPiece = "p" | "n" | "b" | "r" | "q" | "k";

export const ANIM_BY_PIECE: Record<DemoPiece, AttackAnimKind> = {
  p: "marineRifle",
  n: "hoverbikeFrag",
  b: "mechaGatlings",
  r: "tankBattery",
  q: "battleShipLaser",
  k: "ccDualCannon",
};

/** Stand still facing the player before each attack — one attack window. */
export const IDLE_FRONT_MS = ATTACK_MS;

/**
 * Absolute screen aim for a turret: live `aimDeg` while active, else `restDeg`.
 */
export const screenAimDeg = (active: boolean, aimDeg: number, restDeg: number): number =>
  active ? aimDeg : restDeg;

/**
 * Which silhouette to show for Marine/Mecha attack or quiet travel
 * (camera-relative, white at bottom).
 *
 * - Marine / Mecha: team rear (`back` / helmet) when moving or firing up the
 *   board (`dr > 0`); front glass visor when moving or firing down (`dr ≤ 0`).
 *   Same rule for both colors — opposing units keep the glass toward the
 *   camera when they walk/shoot toward the player (do not reuse white’s
 *   “toward-opponent ⇒ back” test, which would hide it).
 */
export const attackFaceFor = (
  piece: DemoPiece,
  vec: { df: number; dr: number },
): "front" | "back" => {
  if (piece === "p" || piece === "b") return vec.dr > 0 ? "back" : "front";
  return "front";
};

export type BoardBox = { width: number; height: number };

export const cellSize = (box: BoardBox): { w: number; h: number } => ({
  w: box.width / 8,
  h: box.height / 8,
});

/** Cover one board square (white at bottom). */
export const squareBoxStyle = (
  sq: Square,
  boardWidth: number,
  boardHeight: number,
): Record<string, string> => {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]);
  const { w, h } = cellSize({ width: boardWidth, height: boardHeight });
  return {
    left: `${file * w}px`,
    top: `${(8 - rank) * h}px`,
    width: `${w}px`,
    height: `${h}px`,
  };
};

/** Centered box on a square (e.g. star burst). */
export const centeredBoxStyle = (
  c: { x: number; y: number },
  width: number,
  height: number,
): Record<string, string> => ({
  left: `${c.x}px`,
  top: `${c.y}px`,
  width: `${width}px`,
  height: `${height}px`,
  "margin-left": `${-width / 2}px`,
  "margin-top": `${-height / 2}px`,
});

/** Ground-anchored box (e.g. Tank impact rising from square bottom). */
export const groundedBoxStyle = (
  c: { x: number; y: number },
  width: number,
  height: number,
  groundYOffset: number,
): Record<string, string> => ({
  left: `${c.x}px`,
  top: `${c.y + groundYOffset}px`,
  width: `${width}px`,
  height: `${height}px`,
  "margin-left": `${-width / 2}px`,
  "margin-top": `${-height}px`,
});

/** Muzzle offset from piece center given an aim pose (CSS y-down). */
export const muzzleOffsetPx = (
  pose: { mirrorX: boolean; rotateDeg: number },
  dist: number,
): { x: number; y: number } => {
  const α = (pose.rotateDeg * Math.PI) / 180;
  let x = dist * Math.cos(α);
  const y = dist * Math.sin(α);
  if (pose.mirrorX) x = -x;
  return { x, y };
};
