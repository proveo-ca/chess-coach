// SPEC: _spec/apps/starchess/timeline/overview.puml, _spec/apps/starchess/timeline/cue-projection.puml, _spec/apps/starchess/timeline/cue-playback.puml, _spec/apps/starchess/timeline/cue-lanes.puml, _spec/apps/starchess/animation-pipeline.md, _spec/apps/starchess/core/turn/playback-interpreter.puml
import type { EndScTurnResult, ResolveAttack, ResolveEvent, ResolveMove, StarChessColor, StarChessPiece } from "@chess-coach/starchess-core";
import { placementToMap, mapToPlacement, charonRayEdge } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import { ANIM_BY_PIECE } from "~/presentation/animations/attackAnim";
import { promoWalkOffTo, isBoardSquare } from "~/presentation/animations/boardGeom";
import {
  hoverbikeElbowMs,
  moveDurationMs as pieceMoveDurationMs,
} from "~/presentation/animations/moveTiming";
import { MECHA_CHARON } from "~/presentation/animations/mechaCharon";
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
  CRUSH_DEATH_MS,
  MINE_MISSILE_MS,
  MINE_TRAIL_MS,
  SETTLE_MS,
} from "~/presentation/constants";
import {
  TACTICAL_JUMP_APPEAR_MS,
  TACTICAL_JUMP_TRAIL_MS,
  TACTICAL_JUMP_TRAVEL_MS,
} from "~/presentation/specials/shipTacticalJump";
import { gasDropCornerFor } from "~/presentation/animations/gasDrop";
import { tankModeAt } from "~/presentation/board/tankMode";
import type { CueLane, TimelineCallbacks, TimelineCue } from "~/types/match";
import { BOARD_RUNG, withLane } from "~/presentation/timeline/cueLanes";
import type { Scheduler } from "~/types/ports";

export type { TimelineCallbacks } from "~/types/match";

const attackCue = (
  a: ResolveAttack,
  id: string,
  siegedTanks: readonly Square[],
): TimelineCue | null => {
  if (a.kind === "ccShot" && a.moveCollision) return null;
  if ("moveCollision" in a && a.moveCollision && a.kind === "capture") return null;
  const tankMode =
    a.piece === "r" ? tankModeAt(a.from, siegedTanks) : undefined;
  const base = {
    kind: "attack" as const,
    id,
    piece: a.piece,
    color: a.color,
    from: a.from,
    to: a.to,
    ...(tankMode ? { tankMode } : {}),
  };
  if (a.kind === "ccShot") {
    return {
      ...base,
      ccShot: { target: a.target, livesAfter: a.livesAfter },
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

const arrivalMineCues = (
  at: Square,
  mineColor: StarChessColor,
  unit: { type: StarChessPiece; color: StarChessColor },
  nextId: () => number,
  opts?: { prefix?: string; chaseFrom?: Square },
): TimelineCue[] => {
  const p = opts?.prefix ?? "arm";
  const chaseFrom = opts?.chaseFrom;
  return [
    // A held mine chases the marine onto its Extra Step tile, so the missile
    // flies from the wake square the same way a mid-slide chase does.
    ...(chaseFrom
      ? [
          {
            kind: "mineMissile" as const,
            id: `${p}x${nextId()}`,
            color: mineColor,
            from: chaseFrom,
            to: at,
          },
        ]
      : []),
    {
      kind: "death",
      id: `${p}m${nextId()}`,
      piece: "n",
      color: mineColor,
      at,
      mine: true,
      ...(chaseFrom ? { spentAt: chaseFrom } : {}),
    },
    {
      kind: "death",
      id: `${p}d${nextId()}`,
      piece: unit.type,
      color: unit.color,
      at,
    },
  ];
};

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

const withPieceAt = (
  placement: string,
  at: Square,
  piece: { type: StarChessPiece; color: StarChessColor },
): string => {
  const map = placementToMap(placement);
  map.set(at, piece);
  return mapToPlacement(map);
};

const livesBeforeAnimatedShots = (
  result: EndScTurnResult,
): EndScTurnResult["next"]["ccLives"] => {
  const lives = { ...result.afterPending.ccLives };
  const pendingOnly =
    result.next.ccLives.w === result.afterPending.ccLives.w &&
    result.next.ccLives.b === result.afterPending.ccLives.b;
  if (!pendingOnly) return lives;
  for (const a of result.resolved.attacks) {
    if (a.kind !== "ccShot" || a.moveCollision) continue;
    lives[a.target] = lives[a.target] + 1;
  }
  return lives;
};

export const projectResolveTimeline = (result: EndScTurnResult): TimelineCue[] => {
  const cues: TimelineCue[] = [];
  let n = 0;

  const bGas: TimelineCue[] = [];
  const fGas: TimelineCue[] = [];
  const seenGas = new Set<string>();
  for (const ev of result.events) {
    if (!ev.from) continue;
    if (ev.phase !== "specialBefore" && ev.phase !== "specialAfter") continue;
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

  for (const ev of result.events) {
    if (ev.phase !== "specialBefore") continue;
    if (ev.kind === "charonMissiles" && ev.from && ev.to) {
      // ev.victim is authoritative (resolve returns it on kills only) —
      // never fall back to board lookup, which would fabricate deaths for
      // occupied fizzles (screened ship, marine, ally on the aim square).
      const victim = ev.victim;
      const fizzle = !victim;
      cues.push({
        kind: "attack",
        id: `ch${n++}`,
        piece: "b",
        color: ev.color,
        from: ev.from,
        to: fizzle ? charonRayEdge(ev.from, ev.to) : ev.to,
        anim: MECHA_CHARON,
        ...(fizzle ? { fizzle: true as const } : {}),
      });
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
    if (ev.kind === "stimStep" && ev.to && ev.mineColor && ev.victim) {
      cues.push(
        ...arrivalMineCues(ev.to, ev.mineColor, ev.victim, () => n++),
      );
    }
    if (ev.kind === "tacticalJump" && ev.from && ev.to) {
      cues.push({
        kind: "move",
        id: `qj${n++}`,
        piece: "q",
        color: ev.color,
        from: ev.from,
        to: ev.to,
        shipJump: true,
      });
      if (ev.mineColor) {
        cues.push({
          kind: "death",
          id: `qjm${n++}`,
          piece: "n",
          color: ev.mineColor,
          at: ev.to,
          mine: true,
        });
        if (ev.victim) {
          cues.push({
            kind: "death",
            id: `qjd${n++}`,
            piece: ev.victim.type,
            color: ev.victim.color,
            at: ev.to,
          });
        }
      }
    }
  }

  const sieged = result.afterB.siegedTanks ?? [];
  const crushVictim = new Map<string, ResolveEvent["victim"]>();
  // F-rank spawns must not be emitted by the B diff below — they project in
  // the F block (after fMoves) so a post-attack deploy never plays early.
  const specialAfterSpawns = new Set<string>();
  for (const ev of result.events) {
    if (ev.kind !== "deploy" || !ev.to) continue;
    if (ev.victim) crushVictim.set(`${ev.color}:${ev.to}`, ev.victim);
    if (ev.phase === "specialAfter") specialAfterSpawns.add(`${ev.color}:${ev.to}`);
  }
  const crushDeaths: TimelineCue[] = [];
  const emittedDeploys = new Set<string>();
  // B-gas promotions already materialize the promoted unit in afterB, and the
  // promotions block below walks the marine off then deploys it exactly once —
  // the diff deploy here would play a second, premature arrival.
  const afterBMap = placementToMap(result.afterB.placement);
  const gasPromoAt = new Set(
    result.resolved.promotions
      .filter((p) => afterBMap.get(p.at)?.type === p.unit)
      .map((p) => p.at),
  );
  for (const d of deployCuesForPlacementDiff(
    result.afterPending.placement,
    result.afterB.placement,
    "spawn",
  )) {
    if (specialAfterSpawns.has(`${d.color}:${d.at}`)) continue;
    if (gasPromoAt.has(d.at)) continue;
    const crush = crushVictim.get(`${d.color}:${d.at}`);
    cues.push({
      kind: "deploy",
      id: d.id,
      piece: d.piece,
      color: d.color,
      at: d.at,
    });
    emittedDeploys.add(`${d.color}:${d.at}`);
    if (crush) {
      crushDeaths.push({
        kind: "death",
        id: `crush${n++}`,
        piece: crush.type,
        color: crush.color,
        at: d.at,
        ...(crush.type === "r"
          ? { tankMode: tankModeAt(d.at, sieged) }
          : {}),
      });
    }
  }
  // Same-type same-color replace (e.g. Marine onto Marine) leaves placement
  // identical, so the diff above emits nothing — project deploy + death from
  // the crush event itself. Mined spawns are handled by the event-driven mined
  // block below; F spawns by the F block.
  for (const ev of result.events) {
    if (ev.kind !== "deploy" || ev.phase !== "specialBefore") continue;
    if (!ev.to || !ev.unit || !ev.victim || ev.mineColor) continue;
    const key = `${ev.color}:${ev.to}`;
    if (emittedDeploys.has(key)) continue;
    cues.push({
      kind: "deploy",
      id: `spawn-crush${n++}`,
      piece: ev.unit,
      color: ev.color,
      at: ev.to,
    });
    emittedDeploys.add(key);
    crushDeaths.push({
      kind: "death",
      id: `crush${n++}`,
      piece: ev.victim.type,
      color: ev.victim.color,
      at: ev.to,
      ...(ev.victim.type === "r" ? { tankMode: tankModeAt(ev.to, sieged) } : {}),
    });
  }
  const minedDeploys: TimelineCue[] = [];
  for (const ev of result.events) {
    if (
      ev.kind !== "deploy" ||
      ev.phase !== "specialBefore" ||
      !ev.to ||
      !ev.mineColor ||
      !ev.unit
    ) {
      continue;
    }
    cues.push({
      kind: "deploy",
      id: `spawn-mine${n++}`,
      piece: ev.unit,
      color: ev.color,
      at: ev.to,
    });
    if (ev.victim) {
      crushDeaths.push({
        kind: "death",
        id: `crush${n++}`,
        piece: ev.victim.type,
        color: ev.victim.color,
        at: ev.to,
        ...(ev.victim.type === "r" ? { tankMode: tankModeAt(ev.to, sieged) } : {}),
      });
    }
    minedDeploys.push(
      ...arrivalMineCues(
        ev.to,
        ev.mineColor,
        { type: ev.unit, color: ev.color },
        () => n++,
      ),
    );
  }
  cues.push(...crushDeaths, ...minedDeploys);

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
          ? { tankMode: tankModeAt(a.to, sieged) }
          : {}),
      });
    }
    // A capture onto a mined tile clears the mine with the same shot — both
    // wrecks play, side by side in the one death window.
    if (a.kind === "capture" && a.mineColor) {
      phase1Deaths.push({
        kind: "death",
        id: `m${n++}`,
        piece: "n",
        color: a.mineColor,
        at: a.to,
        mine: true,
      });
    }
    if (a.kind === "mineBlast") {
      phase1Deaths.push({
        kind: "death",
        id: `m${n++}`,
        piece: "n",
        color: a.mineColor,
        at: a.to,
        mine: true,
      });
    }
    if (a.kind === "ccShot" && a.livesAfter === 0) {
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

  for (const a of result.resolved.moveCollisions) {
    if (a.kind === "capture" && a.victim) {
      cues.push({
        kind: "death",
        id: `mc${n++}`,
        piece: a.victim.piece,
        color: a.victim.color,
        at: a.to,
        ...(a.victim.piece === "r"
          ? { tankMode: tankModeAt(a.to, sieged) }
          : {}),
      });
      if (a.mineColor) {
        cues.push({
          kind: "death",
          id: `mcm${n++}`,
          piece: "n",
          color: a.mineColor,
          at: a.to,
          mine: true,
        });
      }
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

  for (const a of result.resolved.pathRevealAttacks) {
    if (a.kind === "ccShot") {
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
        ccShot: { target: a.target, livesAfter: a.livesAfter },
        ...(a.piece === "r"
          ? { tankMode: tankModeAt(a.from, sieged) }
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
            ? { tankMode: tankModeAt(a.to, sieged) }
            : {}),
        });
      }
      // The shot that took the blocker took the mine under it — same tile, its
      // own wreck, before the occupy slide brings the survivor in.
      if (a.mineColor) {
        cues.push({
          kind: "death",
          id: `prdm${n++}`,
          piece: "n",
          color: a.mineColor,
          at: a.to,
          mine: true,
        });
      }
      if (a.occupies) {
        cues.push(moveCue({ piece: a.piece, color: a.color, from: a.from, to: a.to }, `pro${n++}`));
      }
    }
  }

  for (const a of result.resolved.pathRevealMineTriggers) {
    if (a.kind !== "mineBlast") continue;
    if (a.chaseFrom != null) {
      cues.push({
        kind: "mineMissile",
        id: `prmm${n++}`,
        color: a.mineColor,
        from: a.chaseFrom,
        to: a.to,
      });
    }
    cues.push({
      kind: "death",
      id: `prm${n++}`,
      piece: "n",
      color: a.mineColor,
      at: a.to,
      mine: true,
      ...(a.chaseFrom != null ? { spentAt: a.chaseFrom } : {}),
    });
    if (a.victim) {
      cues.push({
        kind: "death",
        id: `prv${n++}`,
        piece: a.victim.piece,
        color: a.victim.color,
        at: a.to,
        ...(a.victim.piece === "r" ? { tankMode: tankModeAt(a.to, sieged) } : {}),
      });
    }
  }

  cues.push(...fGas);
  for (const m of result.fMoves) cues.push(moveCue(m, `f${n++}`, { stim: true }));
  for (const ev of result.events) {
    if (ev.phase !== "specialAfter" || ev.kind !== "tacticalJump") continue;
    if (!ev.from || !ev.to) continue;
    cues.push({
      kind: "move",
      id: `qjf${n++}`,
      piece: "q",
      color: ev.color,
      from: ev.from,
      to: ev.to,
      shipJump: true,
    });
    if (ev.mineColor) {
      cues.push({
        kind: "death",
        id: `qjfm${n++}`,
        piece: "n",
        color: ev.mineColor,
        at: ev.to,
        mine: true,
      });
      if (ev.victim) {
        cues.push({
          kind: "death",
          id: `qjfd${n++}`,
          piece: ev.victim.type,
          color: ev.victim.color,
          at: ev.to,
        });
      }
    }
  }
  // F-rank Charon (2nd gas phase): same volley as B, plus the off-board
  // fizzle flight when the queued ship drifted before resolve.
  for (const ev of result.events) {
    if (ev.phase !== "specialAfter" || ev.kind !== "charonMissiles") continue;
    if (!ev.from || !ev.to) continue;
    const fizzle = !ev.victim;
    cues.push({
      kind: "attack",
      id: `chf${n++}`,
      piece: "b",
      color: ev.color,
      from: ev.from,
      to: fizzle ? charonRayEdge(ev.from, ev.to) : ev.to,
      anim: MECHA_CHARON,
      ...(fizzle ? { fizzle: true as const } : {}),
    });
    if (ev.victim) {
      cues.push({
        kind: "death",
        id: `chfd${n++}`,
        piece: ev.victim.type,
        color: ev.victim.color,
        at: ev.to,
      });
    }
  }
  for (const ev of result.events) {
    if (ev.phase !== "specialAfter" || ev.kind !== "stimStep") continue;
    if (!ev.to || !ev.mineColor || !ev.victim) continue;
    // `farm*`, not `arm*`: these play after the stim move on the afterMove rung.
    cues.push(
      ...arrivalMineCues(ev.to, ev.mineColor, ev.victim, () => n++, {
        prefix: "farm",
        ...(ev.chaseFrom ? { chaseFrom: ev.chaseFrom } : {}),
      }),
    );
  }
  // F-rank spawn deploys: a drop ordered after combat projects here — after
  // attacks and moves — never skipped, never ahead of the wave that precedes
  // it. Layout mirrors the B block: deploys → crush deaths → arrival blasts,
  // so the deploy window can absorb its crush deaths contiguously.
  const fDeploys: TimelineCue[] = [];
  const fCrushes: TimelineCue[] = [];
  const fBlasts: TimelineCue[] = [];
  for (const ev of result.events) {
    if (ev.phase !== "specialAfter" || ev.kind !== "deploy") continue;
    if (!ev.to || !ev.unit) continue;
    fDeploys.push({
      kind: "deploy",
      id: `spawn-f${n++}`,
      piece: ev.unit,
      color: ev.color,
      at: ev.to,
    });
    if (ev.victim) {
      fCrushes.push({
        kind: "death",
        id: `fcrush${n++}`,
        piece: ev.victim.type,
        color: ev.victim.color,
        at: ev.to,
        ...(ev.victim.type === "r"
          ? { tankMode: tankModeAt(ev.to, sieged) }
          : {}),
      });
    }
    if (ev.mineColor) {
      fBlasts.push(
        ...arrivalMineCues(
          ev.to,
          ev.mineColor,
          { type: ev.unit, color: ev.color },
          () => n++,
          { prefix: "farm" },
        ),
      );
    }
  }
  cues.push(...fDeploys, ...fCrushes, ...fBlasts);
  for (const p of result.resolved.promotions) {
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
  return cues.map(withLane);
};

const cueDuration = (cue: TimelineCue): number => {
  switch (cue.kind) {
    case "move":
      if (cue.shipJump) return TACTICAL_JUMP_TRAVEL_MS + TACTICAL_JUMP_APPEAR_MS;
      return cue.piece === "n"
        ? pieceMoveDurationMs(cue.from, cue.to, "n")
        : moveDurationMs(cue.from, cue.to, { stim: !!cue.stim });
    case "attack":
      return cue.anim === MECHA_CHARON ? FRAG_FLIGHT_MS : ATTACK_MS;
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

const crushDurationMs = (): number => CRUSH_DEATH_MS + DEATH_MS;

const attackImpactMs = (a: { anim?: string; piece: string }): number => {
  const anim =
    (a.anim as AttackAnimKind | undefined) ??
    ANIM_BY_PIECE[a.piece as keyof typeof ANIM_BY_PIECE] ??
    "marineRifle";
  return impactMsFor(anim);
};

const hoverbikeLeg0 = (moves: readonly { id: string; piece: string }[]): Record<string, 0 | 1> => {
  const out: Record<string, 0 | 1> = {};
  for (const m of moves) {
    if (m.piece === "n") out[m.id] = 0;
  }
  return out;
};

const inLane = (cue: TimelineCue, ...lanes: readonly string[]): boolean =>
  lanes.includes(cue.lane ?? "");

const isSpawnDeploy = (cue: TimelineCue): boolean =>
  cue.kind === "deploy" && inLane(cue, "deploy");

const isCrushDeath = (cue: TimelineCue): boolean =>
  cue.kind === "death" && inLane(cue, "crush");

const isGasDrop = (cue: TimelineCue): boolean => cue.kind === "gasDrop";

const isPhase1Attack = (cue: TimelineCue): boolean =>
  cue.kind === "attack" && inLane(cue, "phase1Attack");

const isPhase1Death = (cue: TimelineCue): boolean =>
  cue.kind === "death" && inLane(cue, "phase1Death");

const isMoveCollisionDeath = (cue: TimelineCue): boolean =>
  cue.kind === "death" && inLane(cue, "collision");

const isMineTriggerDeath = (cue: TimelineCue): boolean =>
  cue.kind === "death" && inLane(cue, "mine");

const isMineMissile = (cue: TimelineCue): boolean => cue.kind === "mineMissile";

/**
 * Squares whose mine glyph must go dark while its wreck plays. The death layer's
 * `hidden` covers piece glyphs only — `StarChessBoard.showMine()` reads
 * `spentMines`, so a lane that skips this draws an intact mine underneath its
 * own explosion. `spentAt` is the wake square a chasing mine launched from.
 */
const spentMineSquares = (
  deaths: readonly Extract<TimelineCue, { kind: "death" }>[],
): Square[] =>
  [
    ...new Set(
      deaths
        .filter((d) => d.mine)
        .flatMap((d) => (d.spentAt ? [d.at, d.spentAt] : [d.at])),
    ),
  ] as Square[];

const isSimulMoveWave = (cue: TimelineCue): boolean =>
  cue.kind === "move" && !cue.shipJump && inLane(cue, "move");

const isPromoWalk = (cue: TimelineCue): boolean =>
  cue.kind === "move" && inLane(cue, "promoWalk");

const isPromoDeploy = (cue: TimelineCue): boolean =>
  cue.kind === "deploy" && inLane(cue, "promoDeploy");

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

export const playTimeline = (
  result: EndScTurnResult,
  scheduler: Scheduler,
  cb: TimelineCallbacks,
  opts?: {
    cues?: TimelineCue[];
    finalize?: boolean;
  },
): (() => void) => {
  const cues = opts?.cues ?? projectResolveTimeline(result);
  const finalize = opts?.finalize !== false;
  let cancelled = false;
  const cancels: Array<() => void> = [];
  let displayPlacement = result.afterPending.placement;
  const afterBDisplay = ((): string => {
    const promos = result.resolved.promotions;
    if (promos.length === 0) return result.afterB.placement;
    const map = placementToMap(result.afterB.placement);
    let rolled = false;
    for (const promo of promos) {
      const landed = map.get(promo.at);
      if (!landed || landed.color !== promo.color || landed.type !== promo.unit) continue;
      map.set(promo.at, { type: "p", color: promo.color });
      rolled = true;
    }
    return rolled ? mapToPlacement(map) : result.afterB.placement;
  })();
  let displayLives = livesBeforeAnimatedShots(result);
  let afterBApplied = false;
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
    displayPlacement = afterBDisplay;
    cb.onCommit({
      placement: afterBDisplay,
      mines: result.afterB.mines,
      siegedTanks: result.afterB.siegedTanks,
      ccLives: { ...displayLives },
      hidden: extra?.hidden ?? [],
      playingIds: extra?.playingIds ?? [],
      moveProgress: {}, moveLeg: {},
    });
  };

  let afterAttackCommitted = false;
  /**
   * A late deploy window (F wave, after moves/attacks mutated
   * `displayPlacement`) must patch the board forward — `applyAfterB` would
   * rewind placement to the post-B board and resurrect moved/killed units.
   * Re-applying is only safe while placement still equals `afterB`.
   */
  const commitDeployBoard = (
    deploys: readonly Extract<TimelineCue, { kind: "deploy" }>[],
    playingIds: readonly string[],
  ): void => {
    const hidden = deploys.map((c) => c.at);
    if (!afterBApplied || displayPlacement === afterBDisplay) {
      applyAfterB({ hidden, playingIds });
      return;
    }
    for (const d of deploys) {
      displayPlacement = withPieceAt(displayPlacement, d.at, {
        type: d.piece as StarChessPiece,
        color: d.color,
      });
    }
    cb.onCommit({
      placement: displayPlacement,
      hidden,
      playingIds,
      moveProgress: {},
      moveLeg: {},
    });
  };

  const stampAfterAttackBoard = (overlay: {
    hidden?: readonly Square[];
    playingIds?: readonly string[];
    attackDying?: Record<string, boolean>;
  } = {}) => {
    displayPlacement = result.resolved.afterAttack.placement;
    displayLives = { ...result.resolved.afterAttack.ccLives };
    afterAttackCommitted = true;
    cb.onCommit({
      placement: displayPlacement,
      ccLives: { ...displayLives },
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

  type StepBeat = { at: number; run: () => void };

  type CueHandler = (cue: TimelineCue, index: number) => void;

  const runStep = (step: {
    begin?: () => void;
    beats?: readonly StepBeat[];
    durationMs: number;
    end?: () => void;
    next: number;
  }) => {
    step.begin?.();
    for (const beat of step.beats ?? []) {
      const timer = scheduler.delay(beat.at, () => {
        if (cancelled) return;
        beat.run();
      });
      cancels.push(timer);
    }
    const done = scheduler.delay(step.durationMs, () => {
      if (cancelled) return;
      step.end?.();
      run(step.next);
    });
    cancels.push(done);
  };

  cb.onStart(cues, result.afterPending.placement);

  const handleGasWindow: CueHandler = (_cue, index) => {
    const gasTaken = takeWhile(cues, index, isGasDrop);
    const drops = gasTaken.batch as Extract<TimelineCue, { kind: "gasDrop" }>[];
    let deploys: Extract<TimelineCue, { kind: "deploy" }>[] = [];
    let crushes: Extract<TimelineCue, { kind: "death" }>[] = [];
    let next = gasTaken.next;
    if (next < cues.length && isSpawnDeploy(cues[next]!)) {
      const depTaken = takeWhile(cues, next, isSpawnDeploy);
      deploys = depTaken.batch as Extract<TimelineCue, { kind: "deploy" }>[];
      next = depTaken.next;
    }
    if (next < cues.length && isCrushDeath(cues[next]!)) {
      const crushTaken = takeWhile(cues, next, isCrushDeath);
      crushes = crushTaken.batch as Extract<TimelineCue, { kind: "death" }>[];
      next = crushTaken.next;
    }
    const initialPlayingIds = [
      ...drops.map((c) => c.id),
      ...deploys.map((c) => c.id),
    ];
    const fullPlayingIds = [
      ...initialPlayingIds,
      ...crushes.map((c) => c.id),
    ];
    if (deploys.length > 0) {
      commitDeployBoard(deploys, initialPlayingIds);
    } else {
      cb.onCommit({
        hidden: [],
        playingIds: initialPlayingIds,
        moveProgress: {},
        moveLeg: {},
      });
    }
    return runStep({
      beats:
        crushes.length > 0
          ? [
              {
                at: CRUSH_DEATH_MS,
                run: () =>
                  cb.onCommit({
                    hidden: deploys.map((c) => c.at),
                    playingIds: fullPlayingIds,
                    moveProgress: {},
                    moveLeg: {},
                  }),
              },
            ]
          : [],
      durationMs: Math.max(
        GAS_DROP_MS,
        deploys.length > 0 ? DEPLOY_MS : 0,
        crushes.length > 0 ? crushDurationMs() : 0,
      ),
      end: () => {
        for (const d of drops) usedSquares.add(d.at);
        cb.onCommit({
          hidden: [],
          playingIds: [],
          moveProgress: {},
          moveLeg: {},
          ...commitUsed(),
        });
      },
      next,
    });
  };
  const handleDeployWindow: CueHandler = (_cue, index) => {
    const { batch, next } = takeWhile(cues, index, isSpawnDeploy);
    const deploys = batch as Extract<TimelineCue, { kind: "deploy" }>[];
    let crushes: Extract<TimelineCue, { kind: "death" }>[] = [];
    let afterIdx = next;
    if (afterIdx < cues.length && isCrushDeath(cues[afterIdx]!)) {
      const crushTaken = takeWhile(cues, afterIdx, isCrushDeath);
      crushes = crushTaken.batch as Extract<TimelineCue, { kind: "death" }>[];
      afterIdx = crushTaken.next;
    }
    const initialPlayingIds = deploys.map((c) => c.id);
    const fullPlayingIds = [
      ...initialPlayingIds,
      ...crushes.map((c) => c.id),
    ];
    commitDeployBoard(deploys, initialPlayingIds);
    return runStep({
      beats:
        crushes.length > 0
          ? [
              {
                at: CRUSH_DEATH_MS,
                run: () =>
                  cb.onCommit({
                    hidden: deploys.map((c) => c.at),
                    playingIds: fullPlayingIds,
                    moveProgress: {},
                    moveLeg: {},
                  }),
              },
            ]
          : [],
      durationMs: Math.max(
        DEPLOY_MS,
        crushes.length > 0 ? crushDurationMs() : 0,
      ),
      end: () =>
        cb.onCommit({ hidden: [], playingIds: [], moveProgress: {}, moveLeg: {} }),
      next: afterIdx,
    });
  };
  const handlePhase1Wave: CueHandler = (_cue, index) => {
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
    const batchImpactMs = Math.max(...attacks.map(attackImpactMs));

    cb.onCommit({
      hidden: attackHidden,
      playingIds: attackIds,
      moveProgress: {},
      moveLeg: {},
    });

    for (const atk of attacks) {
      if (!atk.ccShot) continue;
      const shot = atk.ccShot;
      const impact = scheduler.delay(attackImpactMs(atk), () => {
        if (cancelled) return;
        displayLives = { ...displayLives, [shot.target]: shot.livesAfter };
        cb.onCommit({ ccLives: { ...displayLives } });
      });
      cancels.push(impact);
    }

    if (deaths.length > 0) {
      const dying: Record<string, boolean> = {};
      for (const a of attacks) {
        if (deaths.some((d) => d.at === a.from)) dying[a.id] = true;
      }

      const spentMines = spentMineSquares(deaths);
      const deathStart = scheduler.delay(batchImpactMs, () => {
        if (cancelled) return;
        cb.onCommit({
          hidden: [...attackHidden, ...deathHidden],
          playingIds: [...attackIds, ...deathIds],
          attackDying: dying,
          ...(spentMines.length ? { spentMines } : {}),
          moveProgress: {},
          moveLeg: {},
        });
      });
      cancels.push(deathStart);

      const deathDone = scheduler.delay(batchImpactMs + DEATH_MS, () => {
        if (cancelled) return;
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
  };
  const handlePhase1Deaths: CueHandler = (_cue, index) => {
    if (!afterBApplied) applyAfterB();
    const { batch, next } = takeWhile(cues, index, isPhase1Death);
    const deaths = batch as Extract<TimelineCue, { kind: "death" }>[];
    return runStep({
      begin: () =>
        cb.onCommit({
          hidden: deaths.map((c) => c.at),
          playingIds: deaths.map((c) => c.id),
          moveProgress: {}, moveLeg: {},
        }),
      durationMs: DEATH_MS,
      end: commitAfterAttack,
      next,
    });
  };
  const handleMineMissile: CueHandler = (_cue, index) => {
    if (!afterBApplied) applyAfterB();
    const { batch, next } = takeWhile(cues, index, isMineMissile);
    const missiles = batch as Extract<TimelineCue, { kind: "mineMissile" }>[];
    const trails = missiles
      .filter((m) => m.from !== m.to)
      .map((m) => ({ id: `${m.id}-trail`, from: m.from, to: m.to }));
    const spent = [
      ...new Set(missiles.map((m) => m.from)),
    ] as Square[];
    const missileMines = missiles.every((m) => m.board === "afterMove")
      ? result.resolved.afterMove.mines
      : result.resolved.afterAttack.mines;
    cb.onCommit({
      mines: missileMines,
      spentMines: spent,
      mineMissileTrails: trails,
      playingIds: missiles.map((c) => c.id),
      hidden: [],
      moveProgress: {},
      moveLeg: {},
    });
    return runStep({
      durationMs: MINE_MISSILE_MS,
      end: () => {
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
      },
      next,
    });
  };
  const handleCollisionDeaths: CueHandler = (_cue, index) => {
    if (!afterBApplied) applyAfterB();
    const { batch, next } = takeWhile(cues, index, isMoveCollisionDeath);
    const deaths = batch as Extract<TimelineCue, { kind: "death" }>[];
    const spent = spentMineSquares(deaths);
    return runStep({
      begin: () =>
        cb.onCommit({
          hidden: deaths.map((c) => c.at),
          playingIds: deaths.map((c) => c.id),
          ...(spent.length ? { spentMines: spent } : {}),
          moveProgress: {},
          moveLeg: {},
        }),
      durationMs: DEATH_MS,
      end: () => {
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
      },
      next,
    });
  };
  const handleMineDeaths: CueHandler = (_cue, index) => {
    if (!afterBApplied) applyAfterB();
    const { batch, next } = takeWhile(cues, index, isMineTriggerDeath);
    const deaths = batch as Extract<TimelineCue, { kind: "death" }>[];
    const spentExtra = spentMineSquares(deaths);
    return runStep({
      begin: () =>
        cb.onCommit({
          mines: result.resolved.afterMove.mines,
          spentMines: spentExtra,
          hidden: deaths.map((c) => c.at),
          playingIds: deaths.map((c) => c.id),
          moveProgress: {},
          moveLeg: {},
        }),
      durationMs: DEATH_MS,
      end: () => {
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
      },
      next,
    });
  };
  const handleMoveWave: CueHandler = (cue, index) => {
    if (!afterBApplied && cue.board !== "preAfterB") applyAfterB();
    const group = cue.group;
    const { batch, next } = takeWhile(
      cues,
      index,
      (c) => isSimulMoveWave(c) && c.group === group,
    );
    const moves = batch as Extract<TimelineCue, { kind: "move" }>[];
    const hidden = moves.map((c) => c.from);
    const ids = moves.map((c) => c.id);
    const progress0 = Object.fromEntries(ids.map((id) => [id, 0 as const]));
    const progress1 = Object.fromEntries(ids.map((id) => [id, 1 as const]));
    const leg0 = hoverbikeLeg0(moves);
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
      const elbow = scheduler.delay(hoverbikeElbowMs(m.from, m.to), () => {
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
    return runStep({
      durationMs:
        Math.max(1, ...moves.map((c) => cueDuration(c))) +
        // Hoverbike / siege tank settle into rest at touchdown;
        // the mover must stay mounted for the unwind transition to complete
        // before hand-off.
        (moves.some((c) => c.piece === "n" || c.piece === "q" || c.piece === "r") ? SETTLE_MS : 0),
      end: () => {
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
      },
      next,
    });
  };
  const handlePromoWalks: CueHandler = (_cue, index) => {
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
    return runStep({
      durationMs: Math.max(...walks.map((c) => cueDuration(c))),
      end: () => {
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
      },
      next,
    });
  };
  const handlePromoDeploys: CueHandler = (_cue, index) => {
    if (!afterBApplied) applyAfterB();
    const { batch, next } = takeWhile(cues, index, isPromoDeploy);
    const deploys = batch as Extract<TimelineCue, { kind: "deploy" }>[];
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
    return runStep({
      durationMs: DEPLOY_MS,
      end: () =>
        cb.onCommit({ hidden: [], playingIds: [], moveProgress: {}, moveLeg: {} }),
      next,
    });
  };

  const handleSequential: CueHandler = (cue, index) => {

    if (!afterBApplied && BOARD_RUNG[cue.board ?? "afterMove"] > BOARD_RUNG.preAfterB) {
      applyAfterB();
    }

    if (cue.kind === "attack" && cue.ccShot && index + 1 < cues.length) {
      const follow = cues[index + 1]!;
      if (
        follow.kind === "death" &&
        follow.piece === "k" &&
        follow.at === cue.to
      ) {
        const attack = cue;
        const death = follow;
        const shot = attack.ccShot!;
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
            ccLives: { ...displayLives },
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

    if (cue.kind === "move" && cue.shipJump) {
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
    // bSpecial / arrivalBlast rungs land here — `armm` / `qjm` / `farmm` are
    // mine deaths with no batching handler of their own.
    const spent = cue.kind === "death" ? spentMineSquares([cue]) : [];

    if (cue.kind === "move") {
      const leg0 = hoverbikeLeg0([cue]);
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
        const elbow = scheduler.delay(hoverbikeElbowMs(cue.from, cue.to), () => {
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
        ...(spent.length ? { spentMines: spent } : {}),
        moveProgress: {},
        moveLeg: {},
      });
    }

    if (cue.kind === "attack" && cue.ccShot) {
      const shot = cue.ccShot;
      const impact = scheduler.delay(attackImpactMs(cue), () => {
        if (cancelled) return;
        displayLives = {
          ...displayLives,
          [shot.target]: shot.livesAfter,
        };
        cb.onCommit({ ccLives: { ...displayLives } });
      });
      cancels.push(impact);
    }

    return runStep({
      durationMs:
        cueDuration(cue) +
        // Hoverbike settle into rest at touchdown; the mover must
        // stay mounted for the unwind transition to complete before hand-off
        // (approach-lane BattleShip slides land here, not in the wave handler).
        (cue.kind === "move" && (cue.piece === "n" || cue.piece === "q")
          ? SETTLE_MS
          : 0),
      next: index + 1,
      end: () => {
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
      },
    });
  
  };

  const HANDLERS: Partial<Record<CueLane, CueHandler>> = {
    gasDrop: handleGasWindow,
    deploy: handleDeployWindow,
    phase1Attack: handlePhase1Wave,
    phase1Death: handlePhase1Deaths,
    mineMissile: handleMineMissile,
    collision: handleCollisionDeaths,
    mine: handleMineDeaths,
    move: handleMoveWave,
    promoWalk: handlePromoWalks,
    promoDeploy: handlePromoDeploys,
  };

  const run = (index: number) => {
    if (cancelled) return;
    if (index >= cues.length) {
      if (finalize) {
        cb.onCommit({
          placement: result.next.placement,
          ccLives: result.next.ccLives,
          mines: result.next.mines,
          siegedTanks: result.next.siegedTanks,
          specialsUsed: result.next.specialsUsed ?? [],
          hidden: [],
          moveProgress: {},
          moveLeg: {},
          playingIds: [],
        });
      } else if (!afterAttackCommitted && cues.some((c) => c.kind === "attack" || c.kind === "death")) {
        commitAfterAttack();
      } else if (!afterBApplied && cues.some((c) => c.kind === "gasDrop" || c.kind === "deploy" || (c.kind === "move" && (c.stim || c.shipJump)))) {
        applyAfterB();
      }
      cb.onDone();
      return;
    }

    const cue = cues[index]!;
    const handle = HANDLERS[cue.lane ?? "move"] ?? handleSequential;
    handle(cue, index);
  };

  cb.onCommit({
    placement: result.afterPending.placement,
    mines: result.afterPending.mines,
    ccLives: { ...displayLives },
    hidden: [],
    playingIds: [],
    moveProgress: {}, moveLeg: {},
  });

  if (cues.length === 0) {
    applyAfterB();
    const wait = scheduler.delay(0, () => {
      cb.onCommit({
        placement: result.next.placement,
        ccLives: result.next.ccLives,
        mines: result.next.mines,
        siegedTanks: result.next.siegedTanks,
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
