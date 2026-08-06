import type { EndScTurnResult, ResolveAttack, ResolveMove } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { TimelineCue } from "~/app/matchTypes";
import type { Scheduler } from "~/ports";
import {
  ATTACK_MS,
  DEATH_MS,
  DEPLOY_MS,
  PROMO_HOLD_MS,
  moveDurationMs,
} from "~/presentation/timeline/timings";

export type TimelineCallbacks = {
  onStart: (cues: TimelineCue[], placement: string) => void;
  onCommit: (patch: {
    placement?: string;
    kingLives?: EndScTurnResult["next"]["kingLives"];
    mines?: EndScTurnResult["next"]["mines"];
    hidden?: readonly Square[];
  }) => void;
  onDone: () => void;
};

const attackCue = (a: ResolveAttack, id: string): TimelineCue | null => {
  if (a.kind === "kingShot" && a.moveCollision) return null;
  if ("moveCollision" in a && a.moveCollision && a.kind === "capture") return null;
  return {
    kind: "attack",
    id,
    piece: a.piece,
    color: a.color,
    from: a.from,
    to: a.to,
  };
};

const moveCue = (m: ResolveMove, id: string): TimelineCue => ({
  kind: "move",
  id,
  piece: m.piece,
  color: m.color,
  from: m.from,
  to: m.to,
});

/**
 * Project EndScTurnResult into a sequential cue timeline.
 * Gas-step B/F moves animate as ordinary slides; promotions hold then deploy.
 */
export const projectResolveTimeline = (result: EndScTurnResult): TimelineCue[] => {
  const cues: TimelineCue[] = [];
  let n = 0;
  for (const m of result.bMoves) cues.push(moveCue(m, `b${n++}`));
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
  // Spawns / warps on afterB that aren't classical moves — deploy VFX
  // Simplified: if afterB placement differs from start and no classical moved there, skip;
  // combat demos cover attack/move. Deploy for B specials: detect new pieces vs afterPending.
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

/**
 * Play projected cues with an injected scheduler. Commits final board on done.
 */
export const playTimeline = (
  result: EndScTurnResult,
  scheduler: Scheduler,
  cb: TimelineCallbacks,
): (() => void) => {
  const cues = projectResolveTimeline(result);
  let cancelled = false;
  const cancels: Array<() => void> = [];

  cb.onStart(cues, result.afterPending.placement);

  const run = (index: number) => {
    if (cancelled) return;
    if (index >= cues.length) {
      cb.onCommit({
        placement: result.next.placement,
        kingLives: result.next.kingLives,
        mines: result.next.mines,
        hidden: [],
      });
      cb.onDone();
      return;
    }
    const cue = cues[index]!;
    const hidden: Square[] = [];
    if (cue.kind === "move") hidden.push(cue.from);
    if (cue.kind === "attack") hidden.push(cue.from);
    if (cue.kind === "deploy") {
      // Piece appears at end of deploy — hide until done via commit
    }
    cb.onCommit({ hidden });

    const wait = scheduler.delay(cueDuration(cue), () => {
      if (cue.kind === "move") {
        // After slide, board occupancy is tracked via progressive commits in full
        // player; here we only clear hidden until final commit.
        cb.onCommit({ hidden: [] });
      }
      if (cue.kind === "promoHold") {
        // Pawn stays until deploy; final placement has promoted unit.
      }
      run(index + 1);
    });
    cancels.push(wait);
  };

  // Start from afterB so spawns are visible before classical.
  cb.onCommit({
    placement: result.afterB.placement,
    mines: result.afterB.mines,
    kingLives: result.afterPending.kingLives,
    hidden: [],
  });
  run(0);

  return () => {
    cancelled = true;
    for (const c of cancels) c();
  };
};
