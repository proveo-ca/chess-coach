/**
 * Brood War FEN dialect (BW-only). Classic FEN is a one-way render export —
 * never the rules oracle. See BROODWAR_MODE.md / BROODWAR_FEN.md.
 *
 * BWFEN1|<placement>|<turn>|<wlives><blives>|<phase>[|U:<squares>]
 *
 * Optional extras: `U:` + packed squares (e.g. `U:c4e4`) = units that already
 * used a special this turn.
 */

import type { Square } from "chess.js";

import type { BroodWarColor, BwPhaseCode } from "~/broodwar/types";
import type { BwFenSnapshot } from "~/types/broodwar";

export type { BwPhaseCode, BwFenSnapshot };

const PHASE_OK = new Set<BwPhaseCode>(["P", "B", "A", "M", "F", "O"]);
const SQ_RE = /^[a-h][1-8]$/;

/** Classic FEN for ChessBoard / chess.js load (always both kings in placement). */
export const toClassicFen = (
  placement: string,
  sideToMove: BroodWarColor = "w",
  halfmove = 0,
  fullmove = 1,
): string => `${placement} ${sideToMove} - - ${halfmove} ${fullmove}`;

/** Pack specials-used squares for the BWFEN `U:` extras field. */
export const formatSpecialsUsedExtra = (squares: readonly Square[]): string | null => {
  if (squares.length === 0) return null;
  const uniq = [...new Set(squares)].filter((s) => SQ_RE.test(s)).sort();
  if (uniq.length === 0) return null;
  return `U:${uniq.join("")}`;
};

/** Parse `U:a1c4…` (and ignore unknown extras). */
export const parseSpecialsUsedExtra = (extra: string | undefined): Square[] => {
  if (!extra || !extra.startsWith("U:")) return [];
  const body = extra.slice(2);
  const out: Square[] = [];
  for (let i = 0; i + 1 < body.length; i += 2) {
    const sq = body.slice(i, i + 2);
    if (SQ_RE.test(sq)) out.push(sq as Square);
  }
  return out;
};

export const formatBwFen = (snap: BwFenSnapshot): string => {
  const { placement, turn, kingLives, phase, specialsUsed } = snap;
  let s = `BWFEN1|${placement}|${turn}|${kingLives.w}${kingLives.b}|${phase}`;
  const used = formatSpecialsUsedExtra(specialsUsed ?? []);
  if (used) s += `|${used}`;
  return s;
};

export const parseBwFen = (raw: string): BwFenSnapshot => {
  const parts = raw.trim().split("|");
  if (parts[0] !== "BWFEN1" || parts.length < 5) {
    throw new Error(`Invalid BWFEN (expected BWFEN1|…): ${raw.slice(0, 48)}`);
  }
  const placement = parts[1]!;
  const turn = Number(parts[2]);
  const lives = parts[3]!;
  const phase = parts[4] as BwPhaseCode;
  if (!Number.isFinite(turn) || turn < 0) throw new Error(`Invalid BWFEN turn: ${parts[2]}`);
  if (!/^[0-3]{2}$/.test(lives)) throw new Error(`Invalid BWFEN lives: ${lives}`);
  if (!PHASE_OK.has(phase)) throw new Error(`Invalid BWFEN phase: ${phase}`);
  if (placement.split("/").length !== 8) {
    throw new Error(`Invalid BWFEN placement ranks: ${placement}`);
  }
  const specialsUsed = parseSpecialsUsedExtra(parts[5]);
  return {
    placement,
    turn,
    kingLives: { w: Number(lives[0]), b: Number(lives[1]) },
    phase,
    ...(specialsUsed.length ? { specialsUsed } : {}),
  };
};

/** Classic FEN string from a BWFEN snapshot (render adapter). */
export const classicFenFromBw = (
  snap: BwFenSnapshot,
  sideToMove: BroodWarColor = "w",
): string => toClassicFen(snap.placement, sideToMove, 0, Math.max(1, snap.turn || 1));
