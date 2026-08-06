/**
 * Spider Mine helpers — path contact, caps, SCFEN M: packing.
 * // SPEC: _spec/apps/ui/starchess/scfen-wire.puml, _spec/apps/ui/starchess/resolve.puml
 */

import type { Square } from "../model/square";
import type { StarChessColor, ScMine } from "../model/types";
import { parseSquare, sq, type ScPiece } from "./placement";

export const MAX_MINES_PER_SIDE = 2;

/** Intermediate squares on a sliding ray (exclusive of both ends). */
export const rayBetween = (from: Square, to: Square): Square[] => {
  const { file: ff, rank: fr } = parseSquare(from);
  const { file: tf, rank: tr } = parseSquare(to);
  const df = tf - ff;
  const dr = tr - fr;
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  if (adf !== 0 && adr !== 0 && adf !== adr) return []; // not a ray
  if (adf === 0 && adr === 0) return [];
  const stepF = Math.sign(df);
  const stepR = Math.sign(dr);
  const out: Square[] = [];
  let f = ff + stepF;
  let r = fr + stepR;
  while (f !== tf || r !== tr) {
    const mid = sq(f, r);
    if (mid) out.push(mid);
    f += stepF;
    r += stepR;
  }
  return out;
};

/** First occupied square strictly between `from` and `to`, or null if clear. */
export const firstBlockerOnRay = (
  map: Map<Square, ScPiece>,
  from: Square,
  to: Square,
): Square | null => {
  for (const mid of rayBetween(from, to)) {
    if (map.has(mid)) return mid;
  }
  return null;
};

/**
 * Squares a moving piece contacts for Spider Mine **chase** wakes (mid-path).
 * Destination-on-mine is handled in the attack phase (attack → occupy), not here.
 * Slides → intermediates only; leaps → no mid-path contacts.
 */
export const pathContactSquares = (
  from: Square,
  to: Square,
  pieceType: ScPiece["type"],
): Square[] => {
  if (pieceType === "n" || pieceType === "k" || pieceType === "p") return [];
  return rayBetween(from, to);
};

export const minesFor = (
  mines: readonly ScMine[] | undefined,
  color: StarChessColor,
): ScMine[] => (mines ?? []).filter((m) => m.color === color);

export const mineAt = (
  mines: readonly ScMine[] | undefined,
  at: Square,
): ScMine | undefined => (mines ?? []).find((m) => m.at === at);

export const formatMinesExtra = (mines: readonly ScMine[]): string | null => {
  if (mines.length === 0) return null;
  const pack = (color: StarChessColor) =>
    mines
      .filter((m) => m.color === color)
      .map((m) => m.at)
      .sort()
      .join("");
  return `M:w:${pack("w")};b:${pack("b")}`;
};

export const parseMinesExtra = (extra: string | undefined): ScMine[] => {
  if (!extra || !extra.startsWith("M:")) return [];
  const body = extra.slice(2);
  const sides = body.includes(";") ? body.split(";") : [body];
  const parseSide = (raw: string): ScMine[] => {
    const color = raw.startsWith("w:") ? "w" : raw.startsWith("b:") ? "b" : null;
    if (!color) return [];
    const sqs = raw.slice(2);
    const out: ScMine[] = [];
    for (let i = 0; i + 1 < sqs.length; i += 2) {
      const at = sqs.slice(i, i + 2);
      if (/^[a-h][1-8]$/.test(at)) out.push({ color, at: at as Square });
    }
    return out;
  };
  return sides.flatMap(parseSide);
};

export const assertMineCap = (mines: readonly ScMine[], color: StarChessColor): void => {
  if (minesFor(mines, color).length > MAX_MINES_PER_SIDE) {
    throw Object.assign(
      new Error(`SCFEN mines: ${color} exceeds cap ${MAX_MINES_PER_SIDE}`),
      { code: "SC_SPECIAL" as const },
    );
  }
};
