// SPEC: _spec/apps/starchess/core/adjutant/cc-focus.puml, _spec/apps/starchess/core/adjutant/strategic/promotion-defense.puml, _spec/apps/starchess/core/adjutant/strategic/cc-retaliation.puml
/**
 * Cross-ply strategic state — the CC search posterior, the known-vs-seen
 * material account, the enemy-runner memory and the retaliation record, folded
 * forward one settled ply at a time.
 *
 * Both hosts (the live app and the headless arena) thread these, so they live
 * here rather than in either one. Pure input/output: the host owns the value.
 *
 * Two of the four folds accept a {@link ResolveWitness} — the settled resolve's
 * own account of the ply, fog-gated in `witness.ts`. A host that has the
 * `EndScTurnResult` should always pass it: without it, a marine that only flew
 * through our vision and a shot fired from the dark both go unrecorded.
 */

import type { Square } from "chess.js";

import { placementToMap } from "../../board/placement";
import { getSideVision } from "../../board/vision";
import { deployedMaterialFromPlacement } from "../../rules/economy";
import { UNIT_COST } from "../../rules/constants";
import type { PieceColor, ScFenSnapshot } from "../../model/types";
import { emptyCCIntel, getCCBestGuess, type CCIntel } from "../context/ccIntel";
import { combineKnownVsSeen, knownForTurn, type KnownVsSeen } from "./intel";
import { emptyRunnerMemory, foldRunnerMemory, type RunnerMemory } from "./runners";
import {
  emptyAttackerMemory,
  foldAttackerMemory,
  type AttackerMemory,
} from "./attackers";
import { witnessFromEndTurn, type ResolveWitness } from "./witness";

export { witnessFromEndTurn };
export type { ResolveWitness };

const SIDES = ["w", "b"] as const;

const other = (side: PieceColor): PieceColor => (side === "w" ? "b" : "w");

/* ── CC search state ─────────────────────────────────────────────────────── */

export type CcIntelState = {
  perSide: { w: CCIntel; b: CCIntel };
};

export const seedCcIntelForOpening = (): CcIntelState => ({
  perSide: { w: emptyCCIntel("b"), b: emptyCCIntel("w") },
});

/**
 * Fold one settled snapshot into each side's CC posterior.
 *
 * `lastProbe` names a square a Hoverbike was sent to and found empty, which
 * proves that square is not the CC.
 */
export const updateCcIntelForSnap = (
  state: CcIntelState,
  snap: ScFenSnapshot,
  lastProbe?: { w?: { to: Square; empty: boolean } | null; b?: { to: Square; empty: boolean } | null },
): CcIntelState => {
  const map = placementToMap(snap.placement);
  const perSide = { ...state.perSide };
  for (const side of SIDES) {
    const vision = getSideVision(snap.placement, side);
    perSide[side] = getCCBestGuess(
      state.perSide[side],
      map,
      vision.litSquares,
      vision.revealedPieces,
      lastProbe?.[side] ?? null,
      other(side),
    );
  }
  return { perSide };
};

/* ── Command Center retaliation ──────────────────────────────────────────── */

/** Each side's record of who fired on its own Command Center. */
export type AttackerMemoryState = {
  perSide: { w: AttackerMemory; b: AttackerMemory };
};

export const seedAttackerMemory = (): AttackerMemoryState => ({
  perSide: { w: emptyAttackerMemory(), b: emptyAttackerMemory() },
});

/**
 * Fold one settled ply into each side's retaliation record. `witness` carries
 * the resolve's own account of the ply — without it a shot that landed out of
 * sight is never recorded, which is the whole point of the channel.
 */
export const updateAttackersForSnap = (
  state: AttackerMemoryState,
  snap: ScFenSnapshot,
  witness?: ResolveWitness | null,
): AttackerMemoryState => {
  const perSide = { ...state.perSide };
  for (const side of SIDES) {
    perSide[side] = foldAttackerMemory(state.perSide[side], snap, side, witness);
  }
  return { perSide };
};

/* ── Enemy-runner memory ─────────────────────────────────────────────────── */

/** Each side's memory of the *other* side's promotion runners. */
export type RunnerMemoryState = {
  perSide: { w: RunnerMemory; b: RunnerMemory };
};

export const seedRunnerMemory = (): RunnerMemoryState => ({
  perSide: { w: emptyRunnerMemory(), b: emptyRunnerMemory() },
});

/**
 * Fold one settled snapshot into each side's runner memory. Call exactly once
 * per recorded ply, in order — the fold is a one-turn propagation, so a skipped
 * ply lets a ghost fall a rank behind the marine it is tracking.
 */
export const updateRunnersForSnap = (
  state: RunnerMemoryState,
  snap: ScFenSnapshot,
  witness?: ResolveWitness | null,
): RunnerMemoryState => {
  const perSide = { ...state.perSide };
  for (const side of SIDES) {
    perSide[side] = foldRunnerMemory(state.perSide[side], snap, side, witness);
  }
  return { perSide };
};

/* ── Known-vs-seen material account ──────────────────────────────────────── */

/** Per-side account plus the opponent's deployed value seen last ply. */
export type KvsState = {
  perSide: { w: KnownVsSeen; b: KnownVsSeen };
  lastDeployed: { w: number; b: number };
};

export const seedKvsForOpening = (opening: ScFenSnapshot): KvsState => ({
  perSide: {
    w: combineKnownVsSeen(knownForTurn(0), 0, 0),
    b: combineKnownVsSeen(knownForTurn(0), 0, 0),
  },
  lastDeployed: {
    w: deployedMaterialFromPlacement(opening.placement, "b"),
    b: deployedMaterialFromPlacement(opening.placement, "w"),
  },
});

/** Enemy material value `side` currently sees (lit or revealed). */
const visibleEnemyValue = (snap: ScFenSnapshot, side: PieceColor): number => {
  const vision = getSideVision(snap.placement, side);
  const map = placementToMap(snap.placement);
  let total = 0;
  for (const sq of [...vision.litSquares, ...vision.revealedPieces]) {
    const piece = map.get(sq);
    if (piece && piece.color !== side) total += UNIT_COST[piece.type];
  }
  return total;
};

/**
 * Fold one settled snapshot into the account, per side. Call exactly once per
 * recorded ply.
 *
 * `captured` is an estimator, not an exact count: it reads the opponent's
 * deployed-material deficit between plies, so an enemy spawn in the same ply
 * can mask a real capture. It never exceeds deployed loss, and may undercount.
 */
export const updateKvsForSnap = (state: KvsState, snap: ScFenSnapshot): KvsState => {
  const perSide = { ...state.perSide };
  const lastDeployed = { ...state.lastDeployed };

  for (const side of SIDES) {
    const now = deployedMaterialFromPlacement(snap.placement, other(side));
    const shown = visibleEnemyValue(snap, side);
    const prev = perSide[side];

    const scouted = Math.max(prev.scouted, shown);
    const captured = prev.captured + Math.max(0, lastDeployed[side] - now);
    lastDeployed[side] = now;

    perSide[side] = combineKnownVsSeen(knownForTurn(snap.turn), scouted, captured);
  }

  return { perSide, lastDeployed };
};
