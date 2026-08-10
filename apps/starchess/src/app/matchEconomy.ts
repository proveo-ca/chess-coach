/**
 * Match-store selectors used by ResourceBar / TurnBar / GasDeploy.
 * Replaces apps/ui starChessStore reads for the standalone app.
 */
import {
  MAX_DEPLOYED_MATERIAL,
  MAX_STORED_MATERIAL,
  canClassicalPawnDouble,
  deployedMaterialFromPlacement,
  energyForTurn,
  incomeForTurn,
  specialGasCost,
  toClassicFen,
  type EndScTurnResult,
  type ScAction,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { MatchStore } from "~/app/MatchStoreContext";
import { displayedSnapshot } from "~/app/selectors";
import { isCheckOnlyResolve } from "~/presentation/hud/isCheckOnlyResolve";

/** Single-player / review opening Command Center bank (both sides). */
export const OPENING_STORED_MATERIAL = 3;

/**
 * Legacy snaps without SCFEN `B:` — opening bank + income by turn.
 * Prefer {@link reconstructStoredBanks} when a full history is available.
 */
export const estimateStoredFromSnap = (
  snap: ScFenSnapshot,
  _color?: StarChessColor,
): number => {
  let stored = OPENING_STORED_MATERIAL;
  const turn = Math.max(0, snap.turn);
  for (let t = 1; t <= turn; t += 1) {
    stored += incomeForTurn(t);
  }
  return Math.min(MAX_STORED_MATERIAL, Math.max(0, stored));
};

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
      const inc = incomeForTurn(Math.max(1, s.turn));
      bank = {
        w: Math.min(MAX_STORED_MATERIAL, bank.w + inc),
        b: Math.min(MAX_STORED_MATERIAL, bank.b + inc),
      };
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
  const st = store.state();

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

export const viewerColor = (store: MatchStore): StarChessColor => store.state().viewer;

export const storedMaterial = (store: MatchStore) =>
  store.state().economies[viewerColor(store)].stored;

export const materialIncome = (store: MatchStore) =>
  incomeForTurn(Math.max(1, store.state().liveSnapshot.turn));

export const energyCapacity = (store: MatchStore) =>
  energyForTurn(Math.max(1, store.state().liveSnapshot.turn));

/**
 * Display remaining vespene for a side.
 *
 * `snap.gas` is already net of `snap.queue` spends (`addScAction`). DualNav
 * intent may overlay reconstructed specials that are **not** on the snap —
 * debit those so ResourceBar matches GasDeploy when ghost canisters render.
 */
export const gasRemainingFor = (
  snap: Pick<ScFenSnapshot, "gas" | "queue">,
  color: StarChessColor,
  overlayActions?: readonly ScAction[] | null,
): number => {
  let rem = Math.max(0, snap.gas[color] ?? 0);
  if (!overlayActions?.length) return rem;
  const onSnap = new Set((snap.queue?.actions ?? []).map((a) => a.seq));
  for (const a of overlayActions) {
    if (a.color !== color || a.timing === "C") continue;
    if (onSnap.has(a.seq)) continue;
    rem -= specialGasCost(a.kind);
  }
  return Math.max(0, rem);
};

/** Gas does not bank — remaining refills at turn-open from gasIncome. */
export const energyRemaining = (store: MatchStore) => {
  const snap = store.state().liveSnapshot;
  return gasRemainingFor(snap, viewerColor(store), store.reviewIntentActions());
};

export const maxDeployedSupply = MAX_DEPLOYED_MATERIAL;

export const deployedMaterial = (store: MatchStore) => {
  try {
    return deployedMaterialFromPlacement(
      displayedSnapshot(store.state()).placement,
      viewerColor(store),
    );
  } catch {
    return 0;
  }
};

export const hasUsedSpecialThisTurn = (store: MatchStore, square: Square) =>
  store.state().specialsUsed.has(square);

export const classicFenForViewer = (store: MatchStore) => {
  const snap = displayedSnapshot(store.state());
  return toClassicFen(snap.placement, viewerColor(store), 0, Math.max(1, snap.turn));
};

export const canPawnDoubleFree = (store: MatchStore, square: Square) => {
  try {
    return canClassicalPawnDouble(classicFenForViewer(store), square);
  } catch {
    return false;
  }
};

export const currentQueue = (store: MatchStore) =>
  store.state().liveSnapshot.queue?.actions ?? [];

export const turnDeadlineAt = (store: MatchStore) => store.state().deadlineAt;

export const turnSecondsRemaining = (store: MatchStore, now = Date.now()) => {
  const at = store.state().deadlineAt;
  if (at == null) return 0;
  return Math.max(0, Math.ceil((at - now) / 1000));
};
