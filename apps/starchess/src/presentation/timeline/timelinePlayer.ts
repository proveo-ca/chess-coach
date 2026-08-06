import type { EndScTurnResult, ResolveAttack, ResolveMove } from "@chess-coach/starchess-core";
import { placementToMap, mapToPlacement } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { TimelineCue } from "~/app/matchTypes";
import type { Scheduler } from "~/ports";
import { deployCuesForPlacementDiff } from "~/presentation/timeline/deployDiff";
import {
  ATTACK_MS,
  DEATH_MS,
  DEPLOY_MS,
  FRAG_FLIGHT_MS,
  PROMO_HOLD_MS,
  moveDurationMs,
} from "~/presentation/timeline/timings";

export type TimelineCallbacks = {
  onStart: (cues: TimelineCue[], placement: string) => void;
  onCommit: (patch: {
    placement?: string;
    kingLives?: EndScTurnResult["next"]["kingLives"];
    mines?: EndScTurnResult["next"]["mines"];
    siegedRooks?: readonly Square[];
    hidden?: readonly Square[];
    playingIds?: readonly string[];
    moveProgress?: Record<string, 0 | 1>;
  }) => void;
  onDone: () => void;
};

const attackCue = (a: ResolveAttack, id: string): TimelineCue | null => {
  if (a.kind === "kingShot" && a.moveCollision) return null;
  if ("moveCollision" in a && a.moveCollision && a.kind === "capture") return null;
  const base = {
    kind: "attack" as const,
    id,
    piece: a.piece,
    color: a.color,
    from: a.from,
    to: a.to,
  };
  if (a.kind === "kingShot") {
    return {
      ...base,
      kingShot: { target: a.target, livesAfter: a.livesAfter },
    };
  }
  return base;
};

const moveCue = (m: ResolveMove, id: string): TimelineCue => ({
  kind: "move",
  id,
  piece: m.piece,
  color: m.color,
  from: m.from,
  to: m.to,
});

const relocatePlacement = (placement: string, from: Square, to: Square): string => {
  const map = placementToMap(placement);
  const piece = map.get(from);
  if (!piece) return placement;
  map.delete(from);
  map.set(to, piece);
  return mapToPlacement(map);
};

/**
 * HP before animated kingShots — undo chips that afterPending already applied
 * (begin / pending checks) so the hull stays pristine until frag impact.
 * Classical chips live only in `next` and are applied at frag without undoing.
 */
const livesBeforeAnimatedShots = (
  result: EndScTurnResult,
): EndScTurnResult["next"]["kingLives"] => {
  const lives = { ...result.afterPending.kingLives };
  const pendingOnly =
    result.next.kingLives.w === result.afterPending.kingLives.w &&
    result.next.kingLives.b === result.afterPending.kingLives.b;
  if (!pendingOnly) return lives;
  for (const a of result.resolved.attacks) {
    if (a.kind !== "kingShot" || a.moveCollision) continue;
    lives[a.target] = lives[a.target] + 1;
  }
  return lives;
};

/**
 * Project EndScTurnResult into a sequential cue timeline.
 * Order: B gas-steps → spawn deploys → classical attack/death/move → F steps → promo.
 */
export const projectResolveTimeline = (result: EndScTurnResult): TimelineCue[] => {
  const cues: TimelineCue[] = [];
  let n = 0;
  for (const m of result.bMoves) cues.push(moveCue(m, `b${n++}`));

  // Command Center / put spawns: pieces that appear on afterB without a matching leave.
  for (const d of deployCuesForPlacementDiff(
    result.afterPending.placement,
    result.afterB.placement,
    "spawn",
  )) {
    cues.push({
      kind: "deploy",
      id: d.id,
      piece: d.piece,
      color: d.color,
      at: d.at,
    });
  }

  for (const a of result.resolved.attacks) {
    const c = attackCue(a, `a${n++}`);
    if (c) cues.push(c);
    if (a.kind === "capture" && a.victim) {
      cues.push({
        kind: "death",
        id: `d${n++}`,
        piece: a.victim.piece,
        color: a.victim.color,
        at: a.to,
      });
    }
    if (a.kind === "mineBlast") {
      cues.push({
        kind: "death",
        id: `m${n++}`,
        piece: a.piece,
        color: a.color,
        at: a.to,
        mine: true,
      });
    }
  }
  for (const m of result.resolved.moves) cues.push(moveCue(m, `c${n++}`));
  for (const m of result.fMoves) cues.push(moveCue(m, `f${n++}`));
  for (const p of result.resolved.promotions) {
    cues.push({
      kind: "promoHold",
      id: `ph${n++}`,
      color: p.color,
      at: p.at,
      unit: p.unit,
    });
    cues.push({
      kind: "deploy",
      id: `pd${n++}`,
      piece: p.unit,
      color: p.color,
      at: p.at,
    });
  }
  return cues;
};

const cueDuration = (cue: TimelineCue): number => {
  switch (cue.kind) {
    case "move":
      return moveDurationMs(cue.from, cue.to);
    case "attack":
      return ATTACK_MS;
    case "death":
      return DEATH_MS;
    case "deploy":
      return DEPLOY_MS;
    case "promoHold":
      return PROMO_HOLD_MS;
  }
};

/** Spawn-batch deploy ids use the `spawn-` prefix from deployDiff. */
const isSpawnDeploy = (cue: TimelineCue): boolean =>
  cue.kind === "deploy" && cue.id.startsWith("spawn-");

/**
 * Play projected cues with an injected scheduler. Commits final board on done.
 * KingShot HP lands at frag impact so {@link KingDamageOverlay} boom syncs to the hit.
 */
export const playTimeline = (
  result: EndScTurnResult,
  scheduler: Scheduler,
  cb: TimelineCallbacks,
): (() => void) => {
  const cues = projectResolveTimeline(result);
  let cancelled = false;
  const cancels: Array<() => void> = [];
  let displayPlacement = result.afterPending.placement;
  let displayLives = livesBeforeAnimatedShots(result);
  let afterBApplied = false;

  const applyAfterB = (extra?: { hidden?: readonly Square[]; playingIds?: readonly string[] }) => {
    afterBApplied = true;
    displayPlacement = result.afterB.placement;
    cb.onCommit({
      placement: result.afterB.placement,
      mines: result.afterB.mines,
      siegedRooks: result.afterB.siegedRooks,
      kingLives: { ...displayLives },
      hidden: extra?.hidden ?? [],
      playingIds: extra?.playingIds ?? [],
      moveProgress: {},
    });
  };

  cb.onStart(cues, result.afterPending.placement);

  const run = (index: number) => {
    if (cancelled) return;
    if (index >= cues.length) {
      cb.onCommit({
        placement: result.next.placement,
        kingLives: result.next.kingLives,
        mines: result.next.mines,
        siegedRooks: result.next.siegedRooks,
        hidden: [],
        moveProgress: {},
        playingIds: [],
      });
      cb.onDone();
      return;
    }

    const cue = cues[index]!;

    // Parallel spawn deploys (Command Center) — one DEPLOY_MS window.
    if (isSpawnDeploy(cue)) {
      const batch: Extract<TimelineCue, { kind: "deploy" }>[] = [];
      let i = index;
      while (i < cues.length && isSpawnDeploy(cues[i]!)) {
        batch.push(cues[i]! as Extract<TimelineCue, { kind: "deploy" }>);
        i++;
      }
      applyAfterB({
        hidden: batch.map((c) => c.at),
        playingIds: batch.map((c) => c.id),
      });
      const wait = scheduler.delay(DEPLOY_MS, () => {
        if (cancelled) return;
        cb.onCommit({ hidden: [], playingIds: [], moveProgress: {} });
        run(i);
      });
      cancels.push(wait);
      return;
    }

    // Classical / promo / gas-step cues need afterB board (siege vision, spawns landed).
    if (!afterBApplied && cue.kind !== "move") {
      applyAfterB();
    }
    // B gas-steps run on afterPending progressively; once we leave B moves, lock afterB.
    if (!afterBApplied && cue.kind === "move" && !cue.id.startsWith("b")) {
      applyAfterB();
    }

    const hidden: Square[] = [];
    if (cue.kind === "move") hidden.push(cue.from);
    if (cue.kind === "attack") hidden.push(cue.from);
    if (cue.kind === "deploy") hidden.push(cue.at);

    if (cue.kind === "move") {
      cb.onCommit({
        hidden,
        playingIds: [cue.id],
        moveProgress: { [cue.id]: 0 },
      });
      const kick = scheduler.delay(0, () => {
        if (cancelled) return;
        cb.onCommit({
          hidden,
          playingIds: [cue.id],
          moveProgress: { [cue.id]: 1 },
        });
      });
      cancels.push(kick);
    } else if (cue.kind === "promoHold") {
      cb.onCommit({
        hidden: [],
        playingIds: [cue.id],
        moveProgress: {},
      });
    } else {
      cb.onCommit({
        hidden,
        playingIds: [cue.id],
        moveProgress: {},
      });
    }

    // KingShot: chip HP at frag so fire/boom lands with the projectile.
    if (cue.kind === "attack" && cue.kingShot) {
      const shot = cue.kingShot;
      const impact = scheduler.delay(FRAG_FLIGHT_MS, () => {
        if (cancelled) return;
        displayLives = {
          ...displayLives,
          [shot.target]: shot.livesAfter,
        };
        cb.onCommit({ kingLives: { ...displayLives } });
      });
      cancels.push(impact);
    }

    const wait = scheduler.delay(cueDuration(cue), () => {
      if (cancelled) return;
      if (cue.kind === "move" && cue.id.startsWith("b")) {
        displayPlacement = relocatePlacement(displayPlacement, cue.from, cue.to);
        cb.onCommit({
          placement: displayPlacement,
          hidden: [],
          playingIds: [],
          moveProgress: {},
        });
      }
      run(index + 1);
    });
    cancels.push(wait);
  };

  cb.onCommit({
    placement: result.afterPending.placement,
    mines: result.afterPending.mines,
    kingLives: { ...displayLives },
    hidden: [],
    playingIds: [],
    moveProgress: {},
  });

  if (cues.length === 0) {
    applyAfterB();
    const wait = scheduler.delay(0, () => {
      cb.onCommit({
        placement: result.next.placement,
        kingLives: result.next.kingLives,
        mines: result.next.mines,
        siegedRooks: result.next.siegedRooks,
        hidden: [],
        playingIds: [],
      });
      cb.onDone();
    });
    cancels.push(wait);
  } else {
    run(0);
  }

  return () => {
    cancelled = true;
    for (const c of cancels) c();
  };
};
