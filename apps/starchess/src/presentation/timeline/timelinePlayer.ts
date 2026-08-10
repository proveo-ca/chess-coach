// SPEC: _spec/apps/starchess/animation-pipeline.md
import type { EndScTurnResult, ResolveAttack, ResolveMove, StarChessColor, StarChessPiece } from "@chess-coach/starchess-core";
import { placementToMap, mapToPlacement } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import { ANIM_BY_PIECE } from "~/presentation/animations/attackAnim";
import { promoWalkOffTo, isBoardSquare } from "~/presentation/animations/boardGeom";
import {
  knightElbowMs,
  moveDurationMs as pieceMoveDurationMs,
} from "~/presentation/animations/moveTiming";
import { BISHOP_CHARON } from "~/presentation/animations/bishopCharon";
import { impactMsFor } from "~/presentation/animations/impactTiming";
import { deployCuesForPlacementDiff } from "~/presentation/timeline/deployDiff";
import {
  ATTACK_MS,
  DEATH_MS,
  DEPLOY_MS,
  FRAG_FLIGHT_MS,
  GAS_DROP_MS,
  moveDurationMs,
} from "~/presentation/timeline/timings";
import type { AttackAnimKind } from "~/types/cues";
import {
  MINE_MISSILE_MS,
  MINE_TRAIL_MS,
} from "~/presentation/constants";
import {
  TACTICAL_JUMP_APPEAR_MS,
  TACTICAL_JUMP_TRAIL_MS,
  TACTICAL_JUMP_TRAVEL_MS,
} from "~/presentation/specials/queenTacticalJump";
import { gasDropCornerFor } from "~/presentation/animations/gasDrop";
import type { TimelineCue } from "~/types/match";
import type { Scheduler } from "~/types/ports";

export type TimelineCallbacks = {
  onStart: (cues: TimelineCue[], placement: string) => void;
  onCommit: (patch: {
    placement?: string;
    kingLives?: EndScTurnResult["next"]["kingLives"];
    mines?: EndScTurnResult["next"]["mines"];
    siegedRooks?: readonly Square[];
    /** In-resolve U: stamps — migrate with gas drops / moves for green aura. */
    specialsUsed?: readonly Square[];
    hidden?: readonly Square[];
    playingIds?: readonly string[];
    /**
     * Attack cue ids whose hull is suppressed mid-shot (attacker died —
     * reciprocal fire). DeathAnimation owns the square until death ends;
     * keep flags until the attack wave clears so hulls do not flash back.
     */
    attackDying?: Record<string, boolean>;
    moveProgress?: Record<string, 0 | 1>;
    /** Knight L facing — 0 long leg, 1 short leg after elbow. */
    moveLeg?: Record<string, 0 | 1>;
    /** Tactical Jump thruster trails (outlive hull cue). */
    jumpTrails?: ReadonlyArray<{ id: string; from: Square; to: Square }>;
    /** Spider Mine chase trails (outlive missile hull). */
    mineMissileTrails?: ReadonlyArray<{ id: string; from: Square; to: Square }>;
    /** Hide board mine glyphs while missile / after boom. */
    spentMines?: readonly Square[];
  }) => void;
  onDone: () => void;
};

const attackCue = (
  a: ResolveAttack,
  id: string,
  siegedRooks: readonly Square[],
): TimelineCue | null => {
  if (a.kind === "kingShot" && a.moveCollision) return null;
  if ("moveCollision" in a && a.moveCollision && a.kind === "capture") return null;
  const rookMode =
    a.piece === "r"
      ? siegedRooks.includes(a.from)
        ? ("siege" as const)
        : ("tank" as const)
      : undefined;
  const base = {
    kind: "attack" as const,
    id,
    piece: a.piece,
    color: a.color,
    from: a.from,
    to: a.to,
    ...(rookMode ? { rookMode } : {}),
  };
  if (a.kind === "kingShot") {
    return {
      ...base,
      kingShot: { target: a.target, livesAfter: a.livesAfter },
    };
  }
  return base;
};

const moveCue = (
  m: ResolveMove,
  id: string,
  opts?: { stim?: boolean },
): TimelineCue => ({
  kind: "move",
  id,
  piece: m.piece,
  color: m.color,
  from: m.from,
  to: m.to,
  ...(opts?.stim ? { stim: true } : {}),
});

const relocatePlacement = (placement: string, from: Square, to: Square): string => {
  const map = placementToMap(placement);
  const piece = map.get(from);
  if (!piece) return placement;
  map.delete(from);
  map.set(to, piece);
  return mapToPlacement(map);
};

const withoutSquare = (placement: string, at: Square): string => {
  const map = placementToMap(placement);
  map.delete(at);
  return mapToPlacement(map);
};

/** Stamp a unit onto a square (promo land under a deploy cue). */
const withPieceAt = (
  placement: string,
  at: Square,
  piece: { type: StarChessPiece; color: StarChessColor },
): string => {
  const map = placementToMap(placement);
  map.set(at, piece);
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
 * Project EndScTurnResult into a cue timeline.
 * Order: B gas drops → B gas-steps → Charon / Tactical Jump → spawn deploys →
 * phase-1 attacks/deaths → classical → path-reveal → F gas drops → F steps → promo.
 */
export const projectResolveTimeline = (result: EndScTurnResult): TimelineCue[] => {
  const cues: TimelineCue[] = [];
  let n = 0;

  const pendingMap = placementToMap(result.afterPending.placement);
  const bGas: TimelineCue[] = [];
  const fGas: TimelineCue[] = [];
  const seenGas = new Set<string>();
  for (const ev of result.events) {
    if (!ev.from) continue;
    if (ev.phase !== "specialBefore" && ev.phase !== "specialAfter") continue;
    // One absorb per actor square (2-gas specials still get a single drop).
    const key = `${ev.phase}:${ev.from}`;
    if (seenGas.has(key)) continue;
    seenGas.add(key);
    const drop: TimelineCue = {
      kind: "gasDrop",
      id: `gd${n++}`,
      color: ev.color,
      at: ev.from,
      corner: gasDropCornerFor(ev.from),
    };
    if (ev.phase === "specialBefore") bGas.push(drop);
    else fGas.push(drop);
  }
  cues.push(...bGas);

  for (const m of result.bMoves) cues.push(moveCue(m, `b${n++}`, { stim: true }));

  // B specials that need VFX before afterB locks (Charon missiles / Jump trail).
  for (const ev of result.events) {
    if (ev.phase !== "specialBefore") continue;
    if (ev.kind === "bishopSnipe" && ev.from && ev.to) {
      cues.push({
        kind: "attack",
        id: `ch${n++}`,
        piece: "b",
        color: ev.color,
        from: ev.from,
        to: ev.to,
        anim: BISHOP_CHARON,
      });
      const victim = pendingMap.get(ev.to);
      if (victim) {
        cues.push({
          kind: "death",
          id: `chd${n++}`,
          piece: victim.type,
          color: victim.color,
          at: ev.to,
        });
      }
    }
    if (ev.kind === "queenWarp" && ev.from && ev.to) {
      cues.push({
        kind: "move",
        id: `qj${n++}`,
        piece: "q",
        color: ev.color,
        from: ev.from,
        to: ev.to,
        queenJump: true,
      });
    }
  }

  // Command Center / put spawns: pieces that appear on afterB without a matching leave.
  // Skip units that do not survive the turn — deploy VFX must not play on a corpse.
  const finalMap = placementToMap(result.next.placement);
  for (const d of deployCuesForPlacementDiff(
    result.afterPending.placement,
    result.afterB.placement,
    "spawn",
  )) {
    const still = finalMap.get(d.at);
    if (!still || still.type !== d.piece || still.color !== d.color) continue;
    cues.push({
      kind: "deploy",
      id: d.id,
      piece: d.piece,
      color: d.color,
      at: d.at,
    });
  }

  // Phase 1 — simultaneous attacks, then simultaneous deaths (not interleaved).
  // moveCollision captures belong after moves — never phase-1.
  const sieged = result.afterB.siegedRooks ?? [];
  const phase1Attacks: TimelineCue[] = [];
  const phase1Deaths: TimelineCue[] = [];
  for (const a of result.resolved.attacks) {
    if ("moveCollision" in a && a.moveCollision) continue;
    const c = attackCue(a, `a${n++}`, sieged);
    if (c) phase1Attacks.push(c);
    if (a.kind === "capture" && a.victim) {
      phase1Deaths.push({
        kind: "death",
        id: `d${n++}`,
        piece: a.victim.piece,
        color: a.victim.color,
        at: a.to,
        ...(a.victim.piece === "r"
          ? { rookMode: sieged.includes(a.to) ? ("siege" as const) : ("tank" as const) }
          : {}),
      });
    }
    if (a.kind === "mineBlast") {
      phase1Deaths.push({
        kind: "death",
        id: `m${n++}`,
        piece: a.piece,
        color: a.color,
        at: a.to,
        mine: true,
      });
    }
    // Lethal kingShot — DeathAnimation collapse (not a static ruins snap).
    if (a.kind === "kingShot" && a.livesAfter === 0) {
      phase1Deaths.push({
        kind: "death",
        id: `dk${n++}`,
        piece: "k",
        color: a.target,
        at: a.to,
      });
    }
  }
  cues.push(...phase1Attacks, ...phase1Deaths);

  for (const m of result.resolved.moves) cues.push(moveCue(m, `c${n++}`));

  // Move-phase fog / path collisions — deaths after classical land (no attack cue).
  for (const a of result.resolved.moveCollisions) {
    if (a.kind === "capture" && a.victim) {
      cues.push({
        kind: "death",
        id: `mc${n++}`,
        piece: a.victim.piece,
        color: a.victim.color,
        at: a.to,
        ...(a.victim.piece === "r"
          ? { rookMode: sieged.includes(a.to) ? ("siege" as const) : ("tank" as const) }
          : {}),
      });
    } else if (a.kind === "mineBlast") {
      cues.push({
        kind: "death",
        id: `mcm${n++}`,
        piece: "n",
        color: a.mineColor,
        at: a.to,
        mine: true,
      });
    }
  }

  // Phase-2 walk-over / chase mine triggers — after land, before path-reveal.
  // Chase: missile from wake square → impact, then boom. Walk-over: boom only.
  // Promotion onto a hostile mine dies here (no promo walk-off).
  for (const a of result.resolved.mineTriggers) {
    if (a.kind !== "mineBlast") continue;
    if (a.chaseFrom != null) {
      cues.push({
        kind: "mineMissile",
        id: `mm${n++}`,
        color: a.mineColor,
        from: a.chaseFrom,
        to: a.to,
      });
    }
    // Mine boom (hull hidden) — always; walk-over / chase also shreds the victim.
    cues.push({
      kind: "death",
      id: `mtm${n++}`,
      piece: "n",
      color: a.mineColor,
      at: a.to,
      mine: true,
    });
    if (a.victim) {
      cues.push({
        kind: "death",
        id: `mt${n++}`,
        piece: a.victim.piece,
        color: a.victim.color,
        at: a.to,
      });
    }
  }

  // Phase 3 — fog path-discovery. Intention slides to the discovery square,
  // then attacks (king on the way ⇒ kingShot). Must not look like a post-move
  // standing-check chip. Kept as per-approach chains (sequential).
  for (const a of result.resolved.pathRevealAttacks) {
    if (a.kind === "kingShot") {
      const origin = a.pathRevealFrom;
      if (!origin) continue;
      const stopAt = a.stopAt ?? a.from;
      if (a.from !== origin) {
        cues.push(
          moveCue({ piece: a.piece, color: a.color, from: origin, to: a.from }, `prd${n++}`),
        );
      }
      cues.push({
        kind: "attack",
        id: `pra${n++}`,
        piece: a.piece,
        color: a.color,
        from: a.from,
        to: a.to,
        kingShot: { target: a.target, livesAfter: a.livesAfter },
        ...(a.piece === "r"
          ? { rookMode: sieged.includes(a.from) ? ("siege" as const) : ("tank" as const) }
          : {}),
      });
      if (a.livesAfter === 0) {
        cues.push({
          kind: "death",
          id: `prdth${n++}`,
          piece: "k",
          color: a.target,
          at: a.to,
        });
      }
      if (stopAt !== a.from) {
        cues.push(
          moveCue({ piece: a.piece, color: a.color, from: a.from, to: stopAt }, `prs${n++}`),
        );
      }
      continue;
    }
    if (a.kind === "capture") {
      const origin = a.pathRevealFrom;
      if (!origin) continue;
      if (a.from !== origin) {
        cues.push(
          moveCue({ piece: a.piece, color: a.color, from: origin, to: a.from }, `prd${n++}`),
        );
      }
      const c = attackCue(a, `pra${n++}`, sieged);
      if (c) cues.push(c);
      if (a.victim) {
        cues.push({
          kind: "death",
          id: `prdth${n++}`,
          piece: a.victim.piece,
          color: a.victim.color,
          at: a.to,
          ...(a.victim.piece === "r"
            ? { rookMode: sieged.includes(a.to) ? ("siege" as const) : ("tank" as const) }
            : {}),
        });
      }
      if (a.occupies) {
        cues.push(moveCue({ piece: a.piece, color: a.color, from: a.from, to: a.to }, `pro${n++}`));
      }
    }
  }

  cues.push(...fGas);
  for (const m of result.fMoves) cues.push(moveCue(m, `f${n++}`, { stim: true }));
  for (const p of result.resolved.promotions) {
    // Pawn walks one square off the board edge, then the unit deploys.
    cues.push({
      kind: "move",
      id: `pw${n++}`,
      piece: "p",
      color: p.color,
      from: p.at,
      to: promoWalkOffTo(p.at, p.color),
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
      if (cue.queenJump) return TACTICAL_JUMP_TRAVEL_MS + TACTICAL_JUMP_APPEAR_MS;
      // Knights use L-path timing (half per-square rate) — matches MoveAnimation.
      // Stim gas-steps use STIM_MOVE_SQUARE_MS (100ms).
      return cue.piece === "n"
        ? pieceMoveDurationMs(cue.from, cue.to, "n")
        : moveDurationMs(cue.from, cue.to, { stim: !!cue.stim });
    case "attack":
      return cue.anim === BISHOP_CHARON ? FRAG_FLIGHT_MS : ATTACK_MS;
    case "death":
      return DEATH_MS;
    case "deploy":
      return DEPLOY_MS;
    case "gasDrop":
      return GAS_DROP_MS;
    case "mineMissile":
      return MINE_MISSILE_MS;
  }
};

/** Per-weapon kill→death / king-chip meeting point (see impactTiming.ts). */
const attackImpactMs = (a: { anim?: string; piece: string }): number => {
  const anim =
    (a.anim as AttackAnimKind | undefined) ??
    ANIM_BY_PIECE[a.piece as keyof typeof ANIM_BY_PIECE] ??
    "pawnRifle";
  return impactMsFor(anim);
};

/** Initial knight facing map (long leg). Empty when no knights in the wave. */
const knightLeg0 = (moves: readonly { id: string; piece: string }[]): Record<string, 0 | 1> => {
  const out: Record<string, 0 | 1> = {};
  for (const m of moves) {
    if (m.piece === "n") out[m.id] = 0;
  }
  return out;
};

/** Spawn-batch deploy ids use the `spawn-` prefix from deployDiff. */
const isSpawnDeploy = (cue: TimelineCue): boolean =>
  cue.kind === "deploy" && cue.id.startsWith("spawn-");

const isGasDrop = (cue: TimelineCue): boolean => cue.kind === "gasDrop";

/** Phase-1 attacks (not fog path-reveal `pra*` / Charon `ch*`). */
const isPhase1Attack = (cue: TimelineCue): boolean =>
  cue.kind === "attack" && !cue.id.startsWith("pra") && !cue.id.startsWith("ch");

/** Phase-1 deaths (not path-reveal / Charon / post-move mine / move-collision). */
const isPhase1Death = (cue: TimelineCue): boolean =>
  cue.kind === "death" &&
  !cue.id.startsWith("prdth") &&
  !cue.id.startsWith("chd") &&
  !cue.id.startsWith("mt") &&
  !cue.id.startsWith("mc");

/** Post-move fog / path collision deaths — after classical land. */
const isMoveCollisionDeath = (cue: TimelineCue): boolean =>
  cue.kind === "death" && cue.id.startsWith("mc");

/** Post-move mineTriggers (walk-over / chase boom) — after classical land. */
const isMineTriggerDeath = (cue: TimelineCue): boolean =>
  cue.kind === "death" && cue.id.startsWith("mt");

/** Chase missile before mineTrigger boom. */
const isMineMissile = (cue: TimelineCue): boolean => cue.kind === "mineMissile";

/**
 * Simultaneous move waves: B gas-steps, classical C, or F gas-steps.
 * Path-reveal (`pr*`), promo walk-off (`pw*`), and Tactical Jump (`qj*`) stay sequential.
 */
const isSimulMoveWave = (cue: TimelineCue): boolean => {
  if (cue.kind !== "move") return false;
  if (cue.queenJump) return false;
  if (cue.id.startsWith("pr") || cue.id.startsWith("pw") || cue.id.startsWith("qj")) {
    return false;
  }
  return true;
};

const isPromoWalk = (cue: TimelineCue): boolean =>
  cue.kind === "move" && cue.id.startsWith("pw");

const isPromoDeploy = (cue: TimelineCue): boolean =>
  cue.kind === "deploy" && cue.id.startsWith("pd");

const takeWhile = (
  cues: readonly TimelineCue[],
  start: number,
  pred: (c: TimelineCue) => boolean,
): { batch: TimelineCue[]; next: number } => {
  const batch: TimelineCue[] = [];
  let i = start;
  while (i < cues.length && pred(cues[i]!)) {
    batch.push(cues[i]!);
    i += 1;
  }
  return { batch, next: i };
};

/**
 * Play projected cues with an injected scheduler. Commits final board on done.
 * Same-rank opposing actions share one window (checks/attacks together; deaths
 * overlap at FRAG_FLIGHT_MS; then moves) — mirrors engine resolve + playResolve.
 * KingShot HP lands at frag impact so {@link KingDamageOverlay} boom syncs to the hit.
 */
export const playTimeline = (
  result: EndScTurnResult,
  scheduler: Scheduler,
  cb: TimelineCallbacks,
  opts?: {
    /** Override projected cues (tutorial resolve waves). */
    cues?: TimelineCue[];
    /** When false, skip applying `result.next` on completion (mid-wave). */
    finalize?: boolean;
  },
): (() => void) => {
  const cues = opts?.cues ?? projectResolveTimeline(result);
  const finalize = opts?.finalize !== false;
  let cancelled = false;
  const cancels: Array<() => void> = [];
  let displayPlacement = result.afterPending.placement;
  let displayLives = livesBeforeAnimatedShots(result);
  let afterBApplied = false;
  /** Green aura squares — stamped on gas absorb, migrates with hull moves. */
  const usedSquares = new Set<Square>();
  const commitUsed = (): { specialsUsed: Square[] } => ({
    specialsUsed: [...usedSquares].sort() as Square[],
  });
  const migrateUsed = (from: Square, to: Square) => {
    if (from === to || !usedSquares.has(from)) return;
    usedSquares.delete(from);
    if (isBoardSquare(to)) usedSquares.add(to);
  };

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
      moveProgress: {}, moveLeg: {},
    });
  };

  let afterAttackCommitted = false;
  /** Stamp afterAttack placement/lives without necessarily clearing attack overlays. */
  const stampAfterAttackBoard = (overlay: {
    hidden?: readonly Square[];
    playingIds?: readonly string[];
    attackDying?: Record<string, boolean>;
  } = {}) => {
    displayPlacement = result.resolved.afterAttack.placement;
    displayLives = { ...result.resolved.afterAttack.kingLives };
    afterAttackCommitted = true;
    cb.onCommit({
      placement: displayPlacement,
      kingLives: { ...displayLives },
      mines: result.resolved.afterAttack.mines,
      hidden: overlay.hidden ?? [],
      playingIds: overlay.playingIds ?? [],
      ...(overlay.attackDying !== undefined
        ? { attackDying: overlay.attackDying }
        : {}),
      moveProgress: {},
      moveLeg: {},
    });
  };

  const commitAfterAttack = () => {
    stampAfterAttackBoard({ hidden: [], playingIds: [], attackDying: {} });
  };

  cb.onStart(cues, result.afterPending.placement);

  const run = (index: number) => {
    if (cancelled) return;
    if (index >= cues.length) {
      if (finalize) {
        cb.onCommit({
          placement: result.next.placement,
          kingLives: result.next.kingLives,
          mines: result.next.mines,
          siegedRooks: result.next.siegedRooks,
          specialsUsed: result.next.specialsUsed ?? [],
          hidden: [],
          moveProgress: {},
          moveLeg: {},
          playingIds: [],
          // Leave jumpTrails mounted — CSS fade outlives resolve / onDone.
        });
      } else if (!afterAttackCommitted && cues.some((c) => c.kind === "attack" || c.kind === "death")) {
        commitAfterAttack();
      } else if (!afterBApplied && cues.some((c) => c.kind === "gasDrop" || c.kind === "deploy" || (c.kind === "move" && (c.stim || c.queenJump)))) {
        applyAfterB();
      }
      cb.onDone();
      return;
    }

    const cue = cues[index]!;

    // Gas absorbs (+ optional spawn deploys in the same window).
    // CC canister on the king and unit drop start together so deploy is not
    // clipped by a trailing attack when gas finishes first.
    if (isGasDrop(cue)) {
      const gasTaken = takeWhile(cues, index, isGasDrop);
      const drops = gasTaken.batch as Extract<TimelineCue, { kind: "gasDrop" }>[];
      let deploys: Extract<TimelineCue, { kind: "deploy" }>[] = [];
      let next = gasTaken.next;
      if (next < cues.length && isSpawnDeploy(cues[next]!)) {
        const depTaken = takeWhile(cues, next, isSpawnDeploy);
        deploys = depTaken.batch as Extract<TimelineCue, { kind: "deploy" }>[];
        next = depTaken.next;
      }
      const playingIds = [
        ...drops.map((c) => c.id),
        ...deploys.map((c) => c.id),
      ];
      if (deploys.length > 0) {
        applyAfterB({
          hidden: deploys.map((c) => c.at),
          playingIds,
        });
      } else {
        cb.onCommit({
          hidden: [],
          playingIds,
          moveProgress: {},
          moveLeg: {},
        });
      }
      const waitMs = Math.max(
        GAS_DROP_MS,
        deploys.length > 0 ? DEPLOY_MS : 0,
      );
      const wait = scheduler.delay(waitMs, () => {
        if (cancelled) return;
        for (const d of drops) usedSquares.add(d.at);
        cb.onCommit({
          hidden: [],
          playingIds: [],
          moveProgress: {},
          moveLeg: {},
          ...commitUsed(),
        });
        run(next);
      });
      cancels.push(wait);
      return;
    }

    // Spawn deploys without a preceding gas drop (edge / auto-deploy).
    if (isSpawnDeploy(cue)) {
      const { batch, next } = takeWhile(cues, index, isSpawnDeploy);
      const deploys = batch as Extract<TimelineCue, { kind: "deploy" }>[];
      applyAfterB({
        hidden: deploys.map((c) => c.at),
        playingIds: deploys.map((c) => c.id),
      });
      const wait = scheduler.delay(DEPLOY_MS, () => {
        if (cancelled) return;
        cb.onCommit({ hidden: [], playingIds: [], moveProgress: {}, moveLeg: {} });
        run(next);
      });
      cancels.push(wait);
      return;
    }

    // Phase-1 attacks — opposing shots in one window. Deaths overlap at the
    // max per-weapon impactMsFor so impact meets victim collapse (wave sync).
    if (isPhase1Attack(cue)) {
      if (!afterBApplied) applyAfterB();
      const { batch, next } = takeWhile(cues, index, isPhase1Attack);
      const attacks = batch as Extract<TimelineCue, { kind: "attack" }>[];
      let deaths: Extract<TimelineCue, { kind: "death" }>[] = [];
      let afterIdx = next;
      if (next < cues.length && isPhase1Death(cues[next]!)) {
        const taken = takeWhile(cues, next, isPhase1Death);
        deaths = taken.batch as Extract<TimelineCue, { kind: "death" }>[];
        afterIdx = taken.next;
      }

      const attackIds = attacks.map((c) => c.id);
      const deathIds = deaths.map((c) => c.id);
      const attackHidden = attacks.map((c) => c.from);
      const deathHidden = deaths.map((c) => c.at);
      // Max of batch — all deaths in the wave still sync.
      const batchImpactMs = Math.max(...attacks.map(attackImpactMs));

      cb.onCommit({
        hidden: attackHidden,
        playingIds: attackIds,
        moveProgress: {},
        moveLeg: {},
      });

      for (const atk of attacks) {
        if (!atk.kingShot) continue;
        const shot = atk.kingShot;
        const impact = scheduler.delay(attackImpactMs(atk), () => {
          if (cancelled) return;
          displayLives = { ...displayLives, [shot.target]: shot.livesAfter };
          cb.onCommit({ kingLives: { ...displayLives } });
        });
        cancels.push(impact);
      }

      if (deaths.length > 0) {
        // Reciprocal fire: attacker dies on their own square — suppress hull
        // so DeathAnimation owns the cell (same as playResolve). Keep flags
        // until the attack wave ends so hulls do not flash back.
        const dying: Record<string, boolean> = {};
        for (const a of attacks) {
          if (deaths.some((d) => d.at === a.from)) dying[a.id] = true;
        }

        const deathStart = scheduler.delay(batchImpactMs, () => {
          if (cancelled) return;
          cb.onCommit({
            hidden: [...attackHidden, ...deathHidden],
            playingIds: [...attackIds, ...deathIds],
            attackDying: dying,
            moveProgress: {},
            moveLeg: {},
          });
        });
        cancels.push(deathStart);

        const deathDone = scheduler.delay(batchImpactMs + DEATH_MS, () => {
          if (cancelled) return;
          // Deaths finished — drop death cues and stamp afterAttack board so
          // victims leave the fen, but keep attacks (and dying flags) until
          // ATTACK_MS. Clearing playingIds here truncated the attack window.
          stampAfterAttackBoard({
            hidden: attackHidden,
            playingIds: attackIds,
            attackDying: dying,
          });
        });
        cancels.push(deathDone);
      }

      const phaseDoneAt =
        deaths.length > 0
          ? Math.max(ATTACK_MS, batchImpactMs + DEATH_MS)
          : ATTACK_MS;
      const phaseDone = scheduler.delay(phaseDoneAt, () => {
        if (cancelled) return;
        if (afterAttackCommitted) {
          cb.onCommit({
            hidden: [],
            playingIds: [],
            attackDying: {},
            moveProgress: {},
            moveLeg: {},
          });
        } else {
          commitAfterAttack();
        }
        run(afterIdx);
      });
      cancels.push(phaseDone);
      return;
    }

    // Phase-1 deaths without a preceding attack wave (fallback).
    if (isPhase1Death(cue)) {
      if (!afterBApplied) applyAfterB();
      const { batch, next } = takeWhile(cues, index, isPhase1Death);
      const deaths = batch as Extract<TimelineCue, { kind: "death" }>[];
      cb.onCommit({
        hidden: deaths.map((c) => c.at),
        playingIds: deaths.map((c) => c.id),
        moveProgress: {}, moveLeg: {},
      });
      const wait = scheduler.delay(DEATH_MS, () => {
        if (cancelled) return;
        commitAfterAttack();
        run(next);
      });
      cancels.push(wait);
      return;
    }

    // Chase missile — after land, before boom (lift + launch = MINE_MISSILE_MS).
    if (isMineMissile(cue)) {
      if (!afterBApplied) applyAfterB();
      const { batch, next } = takeWhile(cues, index, isMineMissile);
      const missiles = batch as Extract<TimelineCue, { kind: "mineMissile" }>[];
      const trails = missiles
        .filter((m) => m.from !== m.to)
        .map((m) => ({ id: `${m.id}-trail`, from: m.from, to: m.to }));
      const spent = [
        ...new Set(missiles.map((m) => m.from)),
      ] as Square[];
      cb.onCommit({
        // Keep wake mine in snap until boom; spentMines hides the board glyph.
        mines: result.resolved.afterAttack.mines,
        spentMines: spent,
        mineMissileTrails: trails,
        playingIds: missiles.map((c) => c.id),
        hidden: [],
        moveProgress: {},
        moveLeg: {},
      });
      const wait = scheduler.delay(MINE_MISSILE_MS, () => {
        if (cancelled) return;
        cb.onCommit({
          playingIds: [],
          spentMines: spent,
          mineMissileTrails: trails,
          moveProgress: {},
          moveLeg: {},
        });
        const clearTrails = scheduler.delay(MINE_TRAIL_MS, () => {
            if (cancelled) return;
            cb.onCommit({ mineMissileTrails: [] });
          });
        cancels.push(clearTrails);
        run(next);
      });
      cancels.push(wait);
      return;
    }

    // Post-move fog / path collision deaths — after classical land, before mines.
    if (isMoveCollisionDeath(cue)) {
      if (!afterBApplied) applyAfterB();
      const { batch, next } = takeWhile(cues, index, isMoveCollisionDeath);
      const deaths = batch as Extract<TimelineCue, { kind: "death" }>[];
      cb.onCommit({
        hidden: deaths.map((c) => c.at),
        playingIds: deaths.map((c) => c.id),
        moveProgress: {},
        moveLeg: {},
      });
      const wait = scheduler.delay(DEATH_MS, () => {
        if (cancelled) return;
        for (const d of deaths) {
          displayPlacement = withoutSquare(displayPlacement, d.at);
        }
        cb.onCommit({
          placement: displayPlacement,
          hidden: [],
          playingIds: [],
          moveProgress: {},
          moveLeg: {},
        });
        run(next);
      });
      cancels.push(wait);
      return;
    }

    // Post-move mineTriggers — land already applied; boom + victim shred, clear mine.
    if (isMineTriggerDeath(cue)) {
      if (!afterBApplied) applyAfterB();
      const { batch, next } = takeWhile(cues, index, isMineTriggerDeath);
      const deaths = batch as Extract<TimelineCue, { kind: "death" }>[];
      const spentExtra = deaths.filter((d) => d.mine).map((d) => d.at);
      cb.onCommit({
        mines: result.resolved.afterMove.mines,
        spentMines: spentExtra,
        hidden: deaths.map((c) => c.at),
        playingIds: deaths.map((c) => c.id),
        moveProgress: {},
        moveLeg: {},
      });
      const wait = scheduler.delay(DEATH_MS, () => {
        if (cancelled) return;
        for (const d of deaths) {
          displayPlacement = withoutSquare(displayPlacement, d.at);
        }
        cb.onCommit({
          placement: displayPlacement,
          mines: result.resolved.afterMove.mines,
          spentMines: spentExtra,
          hidden: [],
          playingIds: [],
          moveProgress: {},
          moveLeg: {},
        });
        run(next);
      });
      cancels.push(wait);
      return;
    }

    // Simultaneous move wave (B gas / classical C / F) — opposing sides together.
    if (isSimulMoveWave(cue)) {
      if (!afterBApplied && !cue.id.startsWith("b")) applyAfterB();
      const prefix = cue.id.replace(/\d+$/, "");
      const { batch, next } = takeWhile(
        cues,
        index,
        (c) => isSimulMoveWave(c) && c.id.replace(/\d+$/, "") === prefix,
      );
      const moves = batch as Extract<TimelineCue, { kind: "move" }>[];
      const hidden = moves.map((c) => c.from);
      const ids = moves.map((c) => c.id);
      const progress0 = Object.fromEntries(ids.map((id) => [id, 0 as const]));
      const progress1 = Object.fromEntries(ids.map((id) => [id, 1 as const]));
      const leg0 = knightLeg0(moves);
      let legState: Record<string, 0 | 1> = { ...leg0 };
      cb.onCommit({
        hidden,
        playingIds: ids,
        moveProgress: progress0,
        moveLeg: leg0,
      });
      const kick = scheduler.delay(0, () => {
        if (cancelled) return;
        cb.onCommit({
          hidden,
          playingIds: ids,
          moveProgress: progress1,
          moveLeg: { ...legState },
        });
      });
      cancels.push(kick);
      for (const m of moves) {
        if (m.piece !== "n") continue;
        const elbow = scheduler.delay(knightElbowMs(m.from, m.to), () => {
          if (cancelled) return;
          legState = { ...legState, [m.id]: 1 };
          cb.onCommit({
            hidden,
            playingIds: ids,
            moveProgress: progress1,
            moveLeg: { ...legState },
          });
        });
        cancels.push(elbow);
      }
      const batchMs = Math.max(1, ...moves.map((c) => cueDuration(c)));
      const wait = scheduler.delay(batchMs, () => {
        if (cancelled) return;
        for (const m of moves) {
          if (isBoardSquare(m.to)) {
            displayPlacement = relocatePlacement(displayPlacement, m.from, m.to);
            migrateUsed(m.from, m.to);
          }
        }
        cb.onCommit({
          placement: displayPlacement,
          hidden: [],
          playingIds: [],
          moveProgress: {}, moveLeg: {},
          ...commitUsed(),
        });
        run(next);
      });
      cancels.push(wait);
      return;
    }

    // Parallel promo walk-offs, then (separately) promo deploys.
    if (isPromoWalk(cue)) {
      if (!afterBApplied) applyAfterB();
      const { batch, next } = takeWhile(cues, index, isPromoWalk);
      const walks = batch as Extract<TimelineCue, { kind: "move" }>[];
      const hidden = walks.map((c) => c.from);
      const ids = walks.map((c) => c.id);
      const progress0 = Object.fromEntries(ids.map((id) => [id, 0 as const]));
      const progress1 = Object.fromEntries(ids.map((id) => [id, 1 as const]));
      cb.onCommit({
        hidden,
        playingIds: ids,
        moveProgress: progress0,
        moveLeg: {},
      });
      const kick = scheduler.delay(0, () => {
        if (cancelled) return;
        cb.onCommit({
          hidden,
          playingIds: ids,
          moveProgress: progress1,
          moveLeg: {},
        });
      });
      cancels.push(kick);
      const batchMs = Math.max(...walks.map((c) => cueDuration(c)));
      const wait = scheduler.delay(batchMs, () => {
        if (cancelled) return;
        for (const m of walks) {
          displayPlacement = withoutSquare(displayPlacement, m.from);
          usedSquares.delete(m.from);
        }
        cb.onCommit({
          placement: displayPlacement,
          hidden: [],
          playingIds: [],
          moveProgress: {}, moveLeg: {},
          ...commitUsed(),
        });
        run(next);
      });
      cancels.push(wait);
      return;
    }

    if (isPromoDeploy(cue)) {
      if (!afterBApplied) applyAfterB();
      const { batch, next } = takeWhile(cues, index, isPromoDeploy);
      const deploys = batch as Extract<TimelineCue, { kind: "deploy" }>[];
      // Place promoted units now so useAutoDeploy does not see a late spawn
      // after TIMELINE_DONE (pawn leave ≠ queen arrive).
      for (const d of deploys) {
        displayPlacement = withPieceAt(displayPlacement, d.at, {
          type: d.piece as StarChessPiece,
          color: d.color,
        });
      }
      cb.onCommit({
        placement: displayPlacement,
        hidden: deploys.map((c) => c.at),
        playingIds: deploys.map((c) => c.id),
        moveProgress: {}, moveLeg: {},
      });
      const wait = scheduler.delay(DEPLOY_MS, () => {
        if (cancelled) return;
        cb.onCommit({ hidden: [], playingIds: [], moveProgress: {}, moveLeg: {} });
        run(next);
      });
      cancels.push(wait);
      return;
    }

    // Path-reveal chains and any remaining single cues — sequential.
    // Charon / Jump / gas drops play on the pre-B board — do not lock afterB yet.
    const preAfterBSpecial =
      cue.id.startsWith("ch") ||
      cue.id.startsWith("chd") ||
      cue.id.startsWith("qj") ||
      cue.id.startsWith("gd") ||
      cue.kind === "gasDrop" ||
      (cue.kind === "move" && !!cue.queenJump);
    if (!afterBApplied && cue.kind !== "move" && !preAfterBSpecial) {
      applyAfterB();
    }
    if (
      !afterBApplied &&
      cue.kind === "move" &&
      !cue.id.startsWith("b") &&
      !cue.queenJump
    ) {
      applyAfterB();
    }

    // Lethal kingShot on sequential chains (path-reveal `pra*` / Charon `ch*`):
    // crumple at frag impact with the hit — not after full ATTACK_MS (ruins flash).
    if (cue.kind === "attack" && cue.kingShot && index + 1 < cues.length) {
      const follow = cues[index + 1]!;
      if (
        follow.kind === "death" &&
        follow.piece === "k" &&
        follow.at === cue.to
      ) {
        const attack = cue;
        const death = follow;
        const shot = attack.kingShot!;
        const impactAt = attackImpactMs(attack);
        const attackHidden = [attack.from];
        const deathHidden = [death.at];
        cb.onCommit({
          hidden: attackHidden,
          playingIds: [attack.id],
          moveProgress: {},
          moveLeg: {},
        });
        const impact = scheduler.delay(impactAt, () => {
          if (cancelled) return;
          displayLives = { ...displayLives, [shot.target]: shot.livesAfter };
          cb.onCommit({
            kingLives: { ...displayLives },
            hidden: [...attackHidden, ...deathHidden],
            playingIds: [attack.id, death.id],
            moveProgress: {},
            moveLeg: {},
          });
        });
        cancels.push(impact);
        const deathDone = scheduler.delay(impactAt + DEATH_MS, () => {
          if (cancelled) return;
          cb.onCommit({
            hidden: attackHidden,
            playingIds: [attack.id],
            moveProgress: {},
            moveLeg: {},
          });
        });
        cancels.push(deathDone);
        const phaseDoneAt = Math.max(ATTACK_MS, impactAt + DEATH_MS);
        const phaseDone = scheduler.delay(phaseDoneAt, () => {
          if (cancelled) return;
          cb.onCommit({
            hidden: [],
            playingIds: [],
            moveProgress: {},
            moveLeg: {},
          });
          run(index + 2);
        });
        cancels.push(phaseDone);
        return;
      }
    }

    // Tactical Jump — hull travel + trails (not MoveAnimation slide).
    if (cue.kind === "move" && cue.queenJump) {
      const trail = { id: `${cue.id}-trail`, from: cue.from, to: cue.to };
      cb.onCommit({
        hidden: [cue.from, cue.to],
        playingIds: [cue.id],
        moveProgress: {},
        moveLeg: {},
        jumpTrails: [trail],
      });
      const land = scheduler.delay(TACTICAL_JUMP_TRAVEL_MS, () => {
        if (cancelled) return;
        displayPlacement = relocatePlacement(displayPlacement, cue.from, cue.to);
        migrateUsed(cue.from, cue.to);
        cb.onCommit({
          placement: displayPlacement,
          hidden: [cue.from, cue.to],
          playingIds: [cue.id],
          jumpTrails: [trail],
          ...commitUsed(),
        });
      });
      cancels.push(land);
      const hullDone = scheduler.delay(
        TACTICAL_JUMP_TRAVEL_MS + TACTICAL_JUMP_APPEAR_MS,
        () => {
          if (cancelled) return;
          cb.onCommit({
            hidden: [],
            playingIds: [],
            moveProgress: {},
            moveLeg: {},
            jumpTrails: [trail],
          });
          run(index + 1);
        },
      );
      cancels.push(hullDone);
      // Fire-and-forget: trail CSS is 1000ms; do not block onDone / cancel with resolve.
      scheduler.delay(TACTICAL_JUMP_TRAIL_MS, () => {
        cb.onCommit({ jumpTrails: [] });
      });
      return;
    }

    const hidden: Square[] = [];
    if (cue.kind === "move") hidden.push(cue.from);
    if (cue.kind === "attack") hidden.push(cue.from);
    if (cue.kind === "deploy") hidden.push(cue.at);
    if (cue.kind === "death") hidden.push(cue.at);

    if (cue.kind === "move") {
      const leg0 = knightLeg0([cue]);
      let legState: Record<string, 0 | 1> = { ...leg0 };
      cb.onCommit({
        hidden,
        playingIds: [cue.id],
        moveProgress: { [cue.id]: 0 },
        moveLeg: leg0,
      });
      const kick = scheduler.delay(0, () => {
        if (cancelled) return;
        cb.onCommit({
          hidden,
          playingIds: [cue.id],
          moveProgress: { [cue.id]: 1 },
          moveLeg: { ...legState },
        });
      });
      cancels.push(kick);
      if (cue.piece === "n") {
        const elbow = scheduler.delay(knightElbowMs(cue.from, cue.to), () => {
          if (cancelled) return;
          legState = { ...legState, [cue.id]: 1 };
          cb.onCommit({
            hidden,
            playingIds: [cue.id],
            moveProgress: { [cue.id]: 1 },
            moveLeg: { ...legState },
          });
        });
        cancels.push(elbow);
      }
    } else {
      cb.onCommit({
        hidden,
        playingIds: [cue.id],
        moveProgress: {},
        moveLeg: {},
      });
    }

    if (cue.kind === "attack" && cue.kingShot) {
      const shot = cue.kingShot;
      const impact = scheduler.delay(attackImpactMs(cue), () => {
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
      if (cue.kind === "move" && isBoardSquare(cue.to)) {
        displayPlacement = relocatePlacement(displayPlacement, cue.from, cue.to);
        migrateUsed(cue.from, cue.to);
        cb.onCommit({
          placement: displayPlacement,
          hidden: [],
          playingIds: [],
          moveProgress: {},
          moveLeg: {},
          ...commitUsed(),
        });
      } else if (cue.kind === "death") {
        // Vacate so the corpse does not flash back between death VFX and occupy.
        displayPlacement = withoutSquare(displayPlacement, cue.at);
        usedSquares.delete(cue.at);
        cb.onCommit({
          placement: displayPlacement,
          hidden: [],
          playingIds: [],
          moveProgress: {},
          moveLeg: {},
          ...commitUsed(),
        });
      } else {
        cb.onCommit({
          hidden: [],
          playingIds: [],
          moveProgress: {},
          moveLeg: {},
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
    moveProgress: {}, moveLeg: {},
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
