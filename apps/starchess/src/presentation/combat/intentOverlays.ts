/**
 * Planning intent overlays — ghost destinations + canister badges + check rings
 * from the live SCFEN queue (and DualNav intent phase).
 *
 * Red dashed rings (`checks`):
 * - fog-visible standing king-checks on the board (resolve at next turn open)
 * - checks that appear after applying queued classical moves (projected)
 * - capture/attack destinations (enemy on classical `to`), including a visible
 *   hostile spider mine there — the unit attacks the mine, it does not walk in
 *
 * King-check rings are gated on the viewer's **current** vision — a projected
 * check never paints on a king the viewer cannot see yet (fog leak at intent).
 *
 * // SPEC: _spec/apps/starchess/core/board/planning-projection.puml
 */
import type { PieceSymbol, Square } from "chess.js";
import {
  collectLegalKingChecks,
  mapToPlacement,
  mineAt,
  parseSquare,
  pawnSingleTarget,
  placementToMap,
  rayBetween,
  rewriteClassicalAfterB,
  rookModeAfterB,
  type RookMode,
  type ScAction,
  type ScMine,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { pieceAtQueuedSquare } from "~/presentation/specials/planning/occupancy";
import {
  isSquareVisibleToSide,
  pieceVisibleToViewer,
  targetVisibleGate,
} from "~/presentation/board/fogVisibility";
import type { IntentGhost } from "~/types/board";

/** Pawn front-diagonal attack shape (fog attack intents need no visible victim). */
const isPawnDiagonalAttack = (
  from: Square,
  to: Square,
  color: StarChessColor,
): boolean => {
  const a = parseSquare(from);
  const b = parseSquare(to);
  const dir = color === "w" ? 1 : -1;
  return Math.abs(b.file - a.file) === 1 && b.rank - a.rank === dir;
};

/**
 * Marine front step (single or double). Marines only ever fire on their front
 * diagonals — core `resolveTurn` blocks a front step that meets a unit and lets
 * a front step walk into a mine, so a straight advance is never an attack.
 */
const isMarineFrontStep = (
  piece: PieceSymbol | undefined,
  from: Square,
  to: Square,
): boolean => piece === "p" && from[0] === to[0];

/**
 * Where a marine front step actually comes to rest: `to` when the path is
 * clear, otherwise the last empty square before the blocker (core `resolveTurn`
 * truncates the advance), or `null` when it cannot move at all.
 */
const marineFrontStop = (
  map: ReadonlyMap<Square, unknown>,
  from: Square,
  to: Square,
): Square | null => {
  const path = [...rayBetween(from, to), to];
  const blocked = path.findIndex((s) => map.has(s));
  if (blocked < 0) return to;
  return blocked > 0 ? path[blocked - 1]! : null;
};

export type IntentCanisterGhost = {
  at: Square;
  color: StarChessColor;
};

/** Threatened square — red dashed ring (king check or capture intent). */
export type IntentCheckGhost = {
  at: Square;
};

export type IntentOverlays = {
  destinations: IntentGhost[];
  /**
   * Ghost vespene badge: gas/warp/siege on the live actor; spawn on the
   * deploy square so a deploy ghost reads “with gas” vs a pure move ghost.
   */
  canisters: IntentCanisterGhost[];
  checks: IntentCheckGhost[];
};

export type IntentOverlayOpts = {
  placement?: string;
  siegedRooks?: readonly Square[];
  mines?: readonly ScMine[];
  /**
   * Local player — only that side’s queue ghosts. Omit for DualNav / observers
   * (both intentions). Check rings stay global (threat is public once lit), but
   * a king-check ring needs this viewer's *current* vision of that king.
   */
  viewer?: StarChessColor;
};

/** Apply queued classical relocates for check projection (captures clear `to`). */
const placementAfterClassicalQueue = (
  placement: string,
  actions: readonly ScAction[],
): string => {
  const map = placementToMap(placement);
  for (const a of actions) {
    if (a.timing !== "C" || a.kind !== "classical") continue;
    const actor = map.get(a.from);
    if (!actor || actor.color !== a.color) continue;
    const target = map.get(a.to);
    // Engine never occupies the enemy king via classical `C=` — skip projection.
    if (target?.type === "k" && target.color !== actor.color) continue;
    // A marine front step that meets a unit is blocked, never a capture — it
    // truncates before the blocker, so the projection must not walk it through.
    const dest = isMarineFrontStep(actor.type, a.from, a.to)
      ? marineFrontStop(map, a.from, a.to)
      : a.to;
    if (!dest) continue;
    map.delete(a.from);
    if (target && target.color !== actor.color && dest === a.to) {
      map.delete(a.to);
    }
    map.set(dest, actor);
  }
  return mapToPlacement(map);
};

const pushCheck = (
  checks: IntentCheckGhost[],
  seen: Set<string>,
  at: Square,
) => {
  if (seen.has(at)) return;
  seen.add(at);
  checks.push({ at });
};

const pushCanister = (
  canisters: IntentCanisterGhost[],
  seen: Set<string>,
  at: Square,
  color: StarChessColor,
) => {
  const key = `${color}:${at}`;
  if (seen.has(key)) return;
  seen.add(key);
  canisters.push({ at, color });
};

/**
 * Where each B/F relocate's unit actually comes to rest, keyed by the actor's
 * live square (what B/F carry as `from`).
 *
 * A special stacked with a same-vector classical resolves as one longer
 * advance, and the queue never records the composed endpoint:
 * - **gas/warp then move** — `rewriteClassicalAfterB` folds the legs together,
 *   so the landing is the *rewritten* C's `to`, not `B.to`.
 * - **move then gas** — the F step recomputes +1 from the post-classical
 *   square (see the `pawnDouble` F branch in core `submit-turn`), so `F.to` is
 *   only a placeholder for the pre-move geometry.
 *
 * Both endpoints come from the same core helpers the resolver uses. Never
 * re-derive the vector here: the rewrite's guards (same-file, forward, start
 * rank, blocked landing) are the contract, and a hand-rolled version would
 * paint squares the unit never reaches.
 */
const stackEndpoints = (
  queue: readonly ScAction[],
  placement: string,
): Map<string, Square> => {
  const out = new Map<string, Square>();
  const projected = rewriteClassicalAfterB(queue, placement);
  projected.forEach((r, i) => {
    const raw = queue[i];
    if (!raw || raw.timing !== "C" || r.timing !== "C") return;
    if (r.from === raw.from && r.to === raw.to) return;
    out.set(`${raw.color}:${raw.from}`, r.to);
  });

  const afterC = placementToMap(placementAfterClassicalQueue(placement, queue));
  for (const a of queue) {
    if (a.timing !== "F" || a.kind !== "pawnDouble") continue;
    const c = queue.find(
      (q) =>
        q.timing === "C" &&
        q.kind === "classical" &&
        q.color === a.color &&
        q.from === a.from,
    );
    if (!c || c.timing !== "C") continue;
    // Resolver fizzles a blocked / off-board F step and the unit parks on the
    // classical landing — no gas leg to paint.
    const land = pawnSingleTarget(c.to, a.color);
    if (!land || afterC.has(land)) continue;
    out.set(`${a.color}:${a.from}`, land);
  }
  return out;
};

/**
 * Map planning `Q:` → destination ghosts + canister badges + red check rings.
 */
export const intentOverlaysFromQueue = (
  actions: readonly ScAction[] | undefined,
  opts?: IntentOverlayOpts,
): IntentOverlays => {
  const destinations: IntentGhost[] = [];
  const canisters: IntentCanisterGhost[] = [];
  const checks: IntentCheckGhost[] = [];
  const seenDest = new Set<string>();
  const seenCan = new Set<string>();
  const seenCheck = new Set<string>();
  const map = opts?.placement ? placementToMap(opts.placement) : null;
  const viewer = opts?.viewer;
  const queue = actions ?? [];
  const stackEnd = opts?.placement
    ? stackEndpoints(queue, opts.placement)
    : new Map<string, Square>();

  for (const a of queue) {
    if (viewer && a.color !== viewer) continue;
    if (a.timing === "C") {
      // Resolve actor via post-B occupancy (spawn / gas / warp landing) so a
      // classical after deploy paints a move ghost — not only the B ghost.
      const piece = map
        ? pieceAtQueuedSquare(map, a.from, a.color, queue)?.type
        : undefined;
      if (!piece) continue;
      const key = `${a.color}:${a.to}`;
      if (!seenDest.has(key)) {
        seenDest.add(key);
        destinations.push({
          at: a.to,
          color: a.color,
          piece,
          ...(piece === "r"
            ? { rookMode: rookModeAfterB(a.from, opts?.siegedRooks, queue) as RookMode }
            : {}),
        });
      }
      // Capture / attack intent — red ring. Never key red chrome off a fully
      // fogged enemy (that would leak occupancy); pawn diagonals always ring
      // (attack shape, victim optional) — ringing only the *empty* ones would
      // leak the same occupancy by omission. Visible / revealed enemies still
      // ring and paint above the veil.
      // A marine advance is never an attack — a unit ahead blocks it and a mine
      // ahead takes the marine with it. No red ring either way, and skipping it
      // here also keeps the ring from leaking a fogged blocker to observers.
      if (isMarineFrontStep(piece, a.from, a.to)) continue;
      const target = map?.get(a.to);
      const mineOnTo = mineAt(opts?.mines, a.to);
      if (piece === "p" && isPawnDiagonalAttack(a.from, a.to, a.color)) {
        pushCheck(checks, seenCheck, a.to);
      } else if (
        !target &&
        mineOnTo &&
        mineOnTo.color !== a.color &&
        piece !== "k" &&
        (!viewer ||
          !opts?.placement ||
          isSquareVisibleToSide(opts.placement, viewer, a.to, {
            siegedRooks: opts.siegedRooks,
            mines: opts.mines,
          }))
      ) {
        // Attacking a visible hostile mine — same red ring as a capture intent
        // (the mine dies in the attack phase and the unit occupies).
        pushCheck(checks, seenCheck, a.to);
      } else if (target && target.color !== a.color) {
        const known =
          !viewer ||
          !opts?.placement ||
          pieceVisibleToViewer(opts.placement, viewer, a.to, target.color, {
            siegedRooks: opts.siegedRooks,
            mines: opts.mines,
          });
        if (known) pushCheck(checks, seenCheck, a.to);
      }
      continue;
    }
    // B / F specials — canister badge + destination ghost when relocating.
    // Spawn: badge rides the deploy ghost (to), not the king — differentiates
    // deploy-with-gas vs pure classical move ghost (no canister).
    // Relocates: the unit rests on its stack endpoint (see stackEndpoints), and
    // the badge sits on both the live actor and that ghost — "this unit is
    // spending" plus "it arrives here by vespene, not by the classical leg".
    const isSpawn = a.kind === "spawn";
    const dest = isSpawn ? a.to : (stackEnd.get(`${a.color}:${a.from}`) ?? a.to);
    pushCanister(canisters, seenCan, isSpawn && a.to ? a.to : a.from, a.color);
    if (!isSpawn && dest && dest !== a.from) {
      pushCanister(canisters, seenCan, dest, a.color);
    }
    if (!dest || dest === a.from) continue;
    const piece: PieceSymbol | undefined =
      isSpawn && a.unit ? a.unit : map?.get(a.from)?.type;
    if (!piece) continue;
    const key = `${a.color}:${dest}`;
    if (seenDest.has(key)) continue;
    seenDest.add(key);
    destinations.push({
      at: dest,
      color: a.color,
      piece,
      ...(isSpawn ? {} : { via: "gas" as const }),
      ...(piece === "r"
        ? {
            rookMode: (isSpawn
              ? "tank"
              : rookModeAfterB(a.from, opts?.siegedRooks, queue)) as RookMode,
          }
        : {}),
    });
  }

  // Fog-visible legal checks — standing now, and after *viewer* classical moves
  // (projected discovered checks). Never apply opponent queue to the projection
  // — that would leak their intent.
  if (opts?.placement) {
    const placements = [opts.placement];
    const projectQueue = viewer
      ? queue.filter((a) => a.color === viewer)
      : queue;
    if (projectQueue.some((a) => a.timing === "C" && a.kind === "classical")) {
      placements.push(placementAfterClassicalQueue(opts.placement, projectQueue));
    }
    const fogOpts = { siegedRooks: opts.siegedRooks, mines: opts.mines };
    /**
     * A check ring names a king's square, so it may only paint where the viewer
     * sees it *right now* — never on the projected board's vision. A queued move
     * that would light and check a hidden king (a knight stepping beside it, a
     * discovered ray) would otherwise confirm its position at intent time,
     * before the move ever resolves. Observers (no viewer) keep every ring.
     */
    const liveGate = targetVisibleGate(opts.placement, fogOpts);
    for (const placement of placements) {
      const isTargetVisible =
        placement === opts.placement
          ? liveGate
          : targetVisibleGate(placement, fogOpts);
      for (const shot of collectLegalKingChecks(placement, { isTargetVisible })) {
        if (viewer && !liveGate(viewer, shot.to)) continue;
        pushCheck(checks, seenCheck, shot.to);
      }
    }
  }

  return { destinations, canisters, checks };
};
