/**
 * Match-store selectors used by ResourceBar / TurnBar / GasDeploy.
 * Replaces apps/chess starChessStore reads for the standalone app.
 * // SPEC: _spec/apps/starchess/core/board/planning-projection.puml
 */
import {
  MAX_DEPLOYED_MATERIAL,
  OPENING_STORED_MATERIAL,
  applyStoredIncome,
  deployedMaterialFromPlacement,
  energyForTurn,
  gasRemainingFor,
  incomeForTurn,
  toClassicFen,
  type EndScTurnResult,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { MatchStore } from "~/app/MatchStoreContext";
import { readDisplayedSnapshot } from "~/app/selectors";
import { isCheckOnlyResolve } from "~/presentation/hud/isCheckOnlyResolve";

export { OPENING_STORED_MATERIAL };

/** Sole owner for mineral income on turn advance (live + review history). */
export const applyTurnIncome = (
  bank: { w: number; b: number },
  turn: number,
): { w: number; b: number } => applyStoredIncome(bank, turn);

/**
 * Rebuild per-snap mineral banks for history missing `B:`.
 * Opening bank + income on turn advance − deployed-material increases (spawns).
 * Deaths reduce supply without refunding the bank.
 */
export const reconstructStoredBanks = (
  snaps: readonly ScFenSnapshot[],
  opening: number = OPENING_STORED_MATERIAL,
): ScFenSnapshot[] => {
  if (snaps.length === 0) return [];
  let bank = { w: opening, b: opening };
  let prev = snaps[0]!;
  const out: ScFenSnapshot[] = [
    prev.stored ? prev : { ...prev, stored: { ...bank } },
  ];
  if (prev.stored) bank = { ...prev.stored };

  for (let i = 1; i < snaps.length; i += 1) {
    const s = snaps[i]!;
    if (s.stored) {
      bank = { ...s.stored };
      out.push(s);
      prev = s;
      continue;
    }
    if (s.turn > prev.turn) {
      bank = applyTurnIncome(bank, s.turn);
    }
    try {
      for (const c of ["w", "b"] as const) {
        const before = deployedMaterialFromPlacement(prev.placement, c);
        const after = deployedMaterialFromPlacement(s.placement, c);
        const spent = Math.max(0, after - before);
        bank[c] = Math.max(0, bank[c] - spent);
      }
    } catch {
      /* keep bank */
    }
    const next = { ...s, stored: { ...bank } };
    out.push(next);
    prev = next;
  }
  return out;
};

/**
 * Spawn mineral spend implied by afterB placement vs base snap.
 * Deploy almost always lands (rare ship collision / check-mate interrupt) —
 * safe to preview this debit through intent **and** resolve.
 */
export const spawnSpendFromResolve = (
  base: ScFenSnapshot,
  result: EndScTurnResult,
  color: StarChessColor,
): number => {
  try {
    const before = deployedMaterialFromPlacement(base.placement, color);
    const after = deployedMaterialFromPlacement(result.afterB.placement, color);
    return Math.max(0, after - before);
  } catch {
    return 0;
  }
};

/**
 * Available minerals for ResourceBar.
 *
 * Economy commit is end-of-turn (unit lands). Intent queues a deploy spend that
 * resolve may carry unchanged — only rare interrupts drop a deploy.
 *
 * - **Live:** host `economies` (SPEND_STORED on queue; income on TIMELINE_DONE).
 * - **Review intent + resolve:** snap `B:` minus upcoming spawn spend (same number
 *   both phases — do not snap back to opening bank during resolve).
 */
export const displayedStoredMaterial = (
  store: MatchStore,
  color: StarChessColor,
  snap: ScFenSnapshot | null,
): number => {
  const st = store.shell();

  // Live planning / resolve / targeting — store bank (post-queue spend).
  if (st.phase !== "gameOver") {
    return st.economies[color].stored;
  }

  let bank = snap?.stored?.[color];
  if (bank == null) bank = st.economies[color].stored;

  // Intent and resolve share the post-spend preview; Start/check keep snap B:.
  const phase = store.reviewPhase();
  if (phase !== "intent" && phase !== "resolve") return bank;
  if (!snap) return bank;

  let result = st.settledResolves[st.reviewIndex];
  if (result && isCheckOnlyResolve(result)) {
    result = st.settledResolves[st.reviewIndex + 1];
  }
  if (!result || isCheckOnlyResolve(result)) return bank;
  return Math.max(0, bank - spawnSpendFromResolve(snap, result, color));
};

export const viewerColor = (store: MatchStore): StarChessColor => store.shell().viewer;

export const storedMaterial = (store: MatchStore) =>
  store.shell().economies[viewerColor(store)].stored;

export const materialIncome = (store: MatchStore) =>
  incomeForTurn(Math.max(1, store.shell().liveSnapshot.turn));

export const energyCapacity = (store: MatchStore) =>
  energyForTurn(Math.max(1, store.shell().liveSnapshot.turn));

/** Gas does not bank — remaining refills at turn-open from gasIncome. */
export const energyRemaining = (store: MatchStore) => {
  const snap = store.shell().liveSnapshot;
  return gasRemainingFor(snap, viewerColor(store), store.reviewIntentActions());
};

export const maxDeployedSupply = MAX_DEPLOYED_MATERIAL;

export const deployedMaterial = (store: MatchStore) => {
  try {
    return deployedMaterialFromPlacement(
      readDisplayedSnapshot(store).placement,
      viewerColor(store),
    );
  } catch {
    return 0;
  }
};

export const hasUsedSpecialThisTurn = (store: MatchStore, square: Square) =>
  store.shell().specialsUsed.has(square);

export const classicFenForViewer = (store: MatchStore) => {
  const snap = readDisplayedSnapshot(store);
  return toClassicFen(snap.placement, viewerColor(store), 0, Math.max(1, snap.turn));
};

export const currentQueue = (store: MatchStore) =>
  store.shell().liveSnapshot.queue?.actions ?? [];

export const turnDeadlineAt = (store: MatchStore) => store.shell().deadlineAt;

export const turnSecondsRemaining = (store: MatchStore, now = Date.now()) => {
  const at = store.shell().deadlineAt;
  if (at == null) return 0;
  return Math.max(0, Math.ceil((at - now) / 1000));
};
