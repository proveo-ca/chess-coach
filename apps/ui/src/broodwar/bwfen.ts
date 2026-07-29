/**
 * Brood War FEN dialect (BW-only). Classic FEN is a one-way render export —
 * never the rules oracle. See BROODWAR_MODE.md.
 *
 * BWFEN1|<placement>|<turn>|<wlives><blives>|<phase>
 */

import type { BroodWarColor, BwPhaseCode } from "~/broodwar/types";

export type { BwPhaseCode };

export type BwFenSnapshot = {
  /** Classic piece-placement ranks (FEN field 0). */
  placement: string;
  turn: number;
  kingLives: Record<BroodWarColor, number>;
  phase: BwPhaseCode;
};

const PHASE_OK = new Set<BwPhaseCode>(["P", "B", "A", "M", "F", "O"]);

/** Classic FEN for ChessBoard / chess.js load (always both kings in placement). */
export const toClassicFen = (
  placement: string,
  sideToMove: BroodWarColor = "w",
  halfmove = 0,
  fullmove = 1,
): string => `${placement} ${sideToMove} - - ${halfmove} ${fullmove}`;

export const formatBwFen = (snap: BwFenSnapshot): string => {
  const { placement, turn, kingLives, phase } = snap;
  return `BWFEN1|${placement}|${turn}|${kingLives.w}${kingLives.b}|${phase}`;
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
  return {
    placement,
    turn,
    kingLives: { w: Number(lives[0]), b: Number(lives[1]) },
    phase,
  };
};

/** Classic FEN string from a BWFEN snapshot (render adapter). */
export const classicFenFromBw = (
  snap: BwFenSnapshot,
  sideToMove: BroodWarColor = "w",
): string => toClassicFen(snap.placement, sideToMove, 0, Math.max(1, snap.turn || 1));
