/**
 * Store-free classical resolve playback — attack → death → mid-commit → parallel moves.
 * Timing/order matches apps/ui `useStarChessCombat().playResolve` (no Solid / game store).
 */
import type { Square } from "chess.js";

import {
  applyPathRevealAttack,
  applyPathRevealKingShot,
  findKing,
  isMoverVisibleToSide,
  mapToPlacement,
  placementToMap,
  type PathRevealSnap,
  type ResolveAttack,
  type ResolveMove,
  type ResolveTurnResult,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { promoWalkOffTo } from "~/presentation/animations/boardGeom";
import { HIT_BOOM_MS, kingDamageStateForLives } from "~/presentation/animations/kingDamage";
import { knightElbowMs, moveDurationMs } from "~/presentation/animations/moveTiming";
import {
  ATTACK_MS,
  DEATH_MS,
  DEPLOY_MS,
  FRAG_FLIGHT_MS,
  MINE_MISSILE_MS,
  MINE_TRAIL_MS,
  MOVE_MS,
  MOVE_SQUARE_MS,
} from "~/presentation/constants";
import type {
  AttackCue,
  DeathCue,
  DeployCue,
  KingDamageCue,
  MineMissileCue,
  MoveCue,
  QueenJumpTrail,
} from "~/types/cues";
import type {
  ChasingMineCue,
  CombatCommit,
  CombatFxState,
  PlayResolveHandle,
  PlayResolveOptions,
} from "~/types/combat";

export type {
  ChasingMineCue,
  CombatCommit,
  CombatFxState,
  PlayResolveHandle,
  PlayResolveOptions,
};

const emptyFx = (): CombatFxState => ({
  attackCues: [],
  attackDying: {},
  deathCues: [],
  moveCues: [],
  moveProgress: {},
  moveLeg: {},
  deployCues: [],
  kingDamage: [],
  chasingMines: [],
  mineMissiles: [],
  mineMissileTrails: [],
  spentMines: [],
});

let cueSeq = 0;
const nextId = (prefix: string) => `${prefix}-${++cueSeq}-${Date.now()}`;

const rollFireSeed = () => Math.floor(Math.random() * 0xffffffff);

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

/**
 * Play a full classical resolve: attack → death → mid-FEN → occupy / slides
 * (+ path-reveal / mines / promotions when present).
 */
export const playResolve = (
  result: ResolveTurnResult,
  opts: PlayResolveOptions,
  onFx: (state: CombatFxState) => void,
): PlayResolveHandle => {
  const timers: number[] = [];
  const after = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    while (timers.length) window.clearTimeout(timers.pop());
  };

  let fx = emptyFx();
  const emit = () => onFx({ ...fx, attackDying: { ...fx.attackDying } });
  const setFx = (patch: Partial<CombatFxState>) => {
    fx = { ...fx, ...patch };
    emit();
  };

  const fireSeeds: Partial<Record<StarChessColor, number>> = {};
  const seedFor = (color: StarChessColor, existing?: KingDamageCue) => {
    if (existing?.seed != null) {
      fireSeeds[color] = existing.seed;
      return existing.seed;
    }
    const cached = fireSeeds[color];
    if (cached != null) return cached;
    const rolled = rollFireSeed();
    fireSeeds[color] = rolled;
    return rolled;
  };

  /** Latest placement used for fog mover gating (mirrors UI `game()` after commits). */
  let boardPlacement = opts.startPlacement;

  const sieged = new Set(opts.siegedRooks ?? []);
  const rookModeFor = (sq: Square) => (sieged.has(sq) ? "siege" : "tank");

  const syncKingDamageFromBoard = (
    placement: string,
    lives: Record<StarChessColor, number>,
  ) => {
    const map = placementToMap(placement);
    const prev = fx.kingDamage;
    const cues: KingDamageCue[] = [];
    for (const color of ["w", "b"] as const) {
      const state = kingDamageStateForLives(lives[color]);
      if (state === "pristine") continue;
      const at = findKing(map, color);
      if (!at) continue;
      const existing = prev.find((c) => c.id === color);
      cues.push({
        id: color,
        at,
        damage: state,
        seed: seedFor(color, existing),
        impactSeq: existing?.impactSeq,
      });
    }
    setFx({ kingDamage: cues });
  };

  const doCommit = (snap: CombatCommit) => {
    boardPlacement = snap.placement;
    opts.commit(snap);
  };

  const playMoves = (
    moves: ResolveTurnResult["moves"],
    fenAfter: CombatCommit,
    moveOpts: PlayResolveOptions,
    revealedFrom: ReadonlySet<Square> = new Set(),
    forceShowKeys: ReadonlySet<string> = new Set(),
  ) => {
    const g = boardPlacement;
    const damagedIds = new Set(fx.kingDamage.map((c) => c.id));
    const kingMoves = moves.filter((m) => m.piece === "k" && damagedIds.has(m.color));
    const hullMoves = moves.filter((m) => !(m.piece === "k" && damagedIds.has(m.color)));

    const moveKey = (m: { color: string; from: Square; to: Square }) =>
      `${m.color}:${m.from}:${m.to}`;
    const shown =
      moveOpts.viewer == null
        ? hullMoves
        : hullMoves.filter(
            (m) =>
              forceShowKeys.has(moveKey(m)) ||
              isMoverVisibleToSide(g, moveOpts.viewer!, m, revealedFrom, {
                rookModeFor,
              }),
          );

    let pending = 0;
    const done = () => {
      pending -= 1;
      if (pending > 0) return;
      setFx({ moveCues: [], moveProgress: {}, moveLeg: {} });
      doCommit(fenAfter);
      syncKingDamageFromBoard(fenAfter.placement, fenAfter.kingLives);
      moveOpts.onDone?.();
    };
    const arm = (ms: number) => {
      pending += 1;
      after(ms, done);
    };

    for (const m of kingMoves) {
      setFx({
        kingDamage: fx.kingDamage.map((c) =>
          c.id === m.color ? { ...c, at: m.from } : c,
        ),
      });
      after(16, () => {
        setFx({
          kingDamage: fx.kingDamage.map((c) =>
            c.id === m.color ? { ...c, at: m.to } : c,
          ),
        });
      });
      arm(16 + moveDurationMs(m.from, m.to, "k"));
    }

    if (shown.length > 0) {
      const stamp = Date.now();
      const cues: MoveCue[] = shown.map((s, i) => ({
        id: nextId(`mv-${s.piece}-${s.from}-${stamp}-${i}`),
        piece: s.piece,
        color: s.color,
        from: s.from,
        to: s.to,
      }));
      const ids = cues.map((c) => c.id);
      const knights = cues.filter((c) => c.piece === "n");
      const knightIds = knights.map((c) => c.id);
      const batchMs = Math.max(
        MOVE_SQUARE_MS,
        ...cues.map((c) => moveDurationMs(c.from, c.to, c.piece)),
      );
      setFx({
        moveCues: [...fx.moveCues, ...cues],
        moveProgress: {
          ...fx.moveProgress,
          ...Object.fromEntries(ids.map((id) => [id, 0 as const])),
        },
        moveLeg: {
          ...fx.moveLeg,
          ...Object.fromEntries(knightIds.map((id) => [id, 0 as const])),
        },
      });
      after(40, () => {
        const nextProg = { ...fx.moveProgress };
        for (const id of ids) nextProg[id] = 1;
        setFx({ moveProgress: nextProg });
      });
      for (const k of knights) {
        after(40 + knightElbowMs(k.from, k.to), () => {
          if (!(k.id in fx.moveLeg)) return;
          setFx({ moveLeg: { ...fx.moveLeg, [k.id]: 1 } });
        });
      }
      after(40 + batchMs, () => {
        const idSet = new Set(ids);
        const nextProg = { ...fx.moveProgress };
        const nextLeg = { ...fx.moveLeg };
        for (const id of ids) {
          delete nextProg[id];
          delete nextLeg[id];
        }
        setFx({
          moveCues: fx.moveCues.filter((m) => !idSet.has(m.id)),
          moveProgress: nextProg,
          moveLeg: nextLeg,
        });
        done();
      });
      pending += 1;
    } else if (kingMoves.length === 0) {
      arm(MOVE_MS);
    }
  };

  // --- resolve body ---
  clearTimers();
  fx = emptyFx();
  emit();

  const livesBefore = opts.livesBefore;
  syncKingDamageFromBoard(opts.startPlacement, livesBefore);

  const afterMoveCommit: CombatCommit = {
    placement: result.afterMove.placement,
    kingLives: result.afterMove.kingLives,
    phase: result.afterMove.kingLives.w === 0 || result.afterMove.kingLives.b === 0 ? "O" : "P",
    mines: result.afterMove.mines,
  };

  const afterAllCommit: CombatCommit = {
    placement: result.afterAll.placement,
    kingLives: result.afterAll.kingLives,
    phase: result.afterAll.kingLives.w === 0 || result.afterAll.kingLives.b === 0 ? "O" : "P",
    mines: result.afterAll.mines,
  };

  /**
   * Promotion: land as pawn → walk one square off the board edge
   * ({@link MOVE_SQUARE_MS}) → vacate → battlecruiser / unit deploy.
   * Mines that kill the pawn never appear in `result.promotions`.
   */
  const settlePromotionsThenDone = () => {
    if (!result.promotions.length) {
      doCommit(afterAllCommit);
      syncKingDamageFromBoard(afterAllCommit.placement, afterAllCommit.kingLives);
      opts.onDone?.();
      return;
    }
    const map = placementToMap(afterAllCommit.placement);
    for (const p of result.promotions) {
      map.set(p.at, { type: "p", color: p.color });
    }
    const prePromo: CombatCommit = {
      placement: mapToPlacement(map),
      kingLives: afterAllCommit.kingLives,
      phase: afterAllCommit.phase,
      mines: afterAllCommit.mines,
    };
    doCommit(prePromo);
    syncKingDamageFromBoard(prePromo.placement, prePromo.kingLives);

    const walkCues: MoveCue[] = result.promotions.map((p) => ({
      id: nextId("pw"),
      piece: "p",
      color: p.color,
      from: p.at,
      to: promoWalkOffTo(p.at, p.color),
    }));
    const walkIds = walkCues.map((c) => c.id);
    setFx({
      moveCues: walkCues,
      moveProgress: Object.fromEntries(walkIds.map((id) => [id, 0 as const])),
      moveLeg: {},
      deployCues: [],
    });
    after(40, () => {
      const nextProg = { ...fx.moveProgress };
      for (const id of walkIds) nextProg[id] = 1;
      setFx({ moveProgress: nextProg });
    });

    after(40 + MOVE_SQUARE_MS, () => {
      const vacated = placementToMap(prePromo.placement);
      for (const p of result.promotions) vacated.delete(p.at);
      doCommit({
        ...prePromo,
        placement: mapToPlacement(vacated),
      });

      const deployCues: DeployCue[] = result.promotions.map((p) => ({
        id: nextId("pd"),
        piece: p.unit,
        color: p.color,
        at: p.at,
      }));
      setFx({
        moveCues: [],
        moveProgress: {},
        moveLeg: {},
        deployCues,
      });

      after(DEPLOY_MS, () => {
        setFx({ deployCues: [] });
        doCommit(afterAllCommit);
        syncKingDamageFromBoard(afterAllCommit.placement, afterAllCommit.kingLives);
        opts.onDone?.();
      });
    });
  };

  const playPathRevealAttacks = () => {
    const atks = result.pathRevealAttacks.filter(
      (
        a,
      ): a is
        | Extract<ResolveAttack, { kind: "capture" }>
        | Extract<ResolveAttack, { kind: "kingShot" }> =>
        (a.kind === "capture" || a.kind === "kingShot") && a.pathRevealFrom != null,
    );
    const stamp = Date.now();
    let running: PathRevealSnap & { kingLives: Record<StarChessColor, number> } = {
      placement: afterMoveCommit.placement,
      mines: [...afterMoveCommit.mines],
      kingLives: { ...afterMoveCommit.kingLives },
    };
    let i = 0;

    const playNext = () => {
      const a = atks[i];
      if (!a) {
        settlePromotionsThenDone();
        return;
      }
      i += 1;

      if (a.kind === "kingShot") {
        const applied = applyPathRevealKingShot(running, a);
        if (!applied.fired) {
          running = {
            placement: applied.placement,
            mines: [...applied.mines],
            kingLives: { ...applied.kingLives },
          };
          playNext();
          return;
        }
        const stopAt = a.stopAt ?? a.from;
        const discoveryFree =
          stopAt !== a.pathRevealFrom &&
          !placementToMap(running.placement).has(a.from);
        const cue: AttackCue = {
          id: nextId(`pa-k-${a.piece}-${a.to}-${stamp}-${i}`),
          piece: a.piece,
          color: a.color,
          from: discoveryFree ? a.from : a.pathRevealFrom!,
          to: a.to,
        };
        const finalCommit: CombatCommit = {
          placement: applied.placement,
          kingLives: { ...applied.kingLives },
          phase:
            applied.kingLives.w === 0 || applied.kingLives.b === 0 ? "O" : "M",
          mines: applied.mines,
        };
        const playShot = () => {
          setFx({ attackCues: [cue] });
          after(FRAG_FLIGHT_MS, () => {
            const state = kingDamageStateForLives(a.livesAfter);
            const existing = fx.kingDamage.find((c) => c.id === a.target);
            const rest = fx.kingDamage.filter((c) => c.id !== a.target);
            if (state === "pristine") {
              setFx({ kingDamage: rest, attackCues: [] });
            } else {
              setFx({
                attackCues: [],
                kingDamage: [
                  ...rest,
                  {
                    id: a.target,
                    at: a.to,
                    damage: state,
                    seed: seedFor(a.target, existing),
                    impactSeq: (existing?.impactSeq ?? 0) + 1,
                  },
                ],
              });
            }
            const wait = a.livesAfter > 0 ? HIT_BOOM_MS : DEATH_MS;
            after(wait, () => {
              const done = () => {
                running = {
                  placement: applied.placement,
                  mines: [...applied.mines],
                  kingLives: { ...applied.kingLives },
                };
                playNext();
              };
              // After a discovery approach, slide discovery → stopAt. Otherwise
              // the final commit already relocates pathRevealFrom → stopAt.
              if (discoveryFree && stopAt !== a.from) {
                const settle: ResolveMove = {
                  piece: a.piece,
                  color: a.color,
                  from: a.from,
                  to: stopAt,
                };
                playMoves([settle], finalCommit, {
                  ...opts,
                  onDone: done,
                });
              } else {
                doCommit(finalCommit);
                syncKingDamageFromBoard(finalCommit.placement, finalCommit.kingLives);
                done();
              }
            });
          });
        };
        // Fog discovery: walk to the discovery square, shoot, then the final
        // commit already holds stopAt. Do NOT slide all the way to stopAt
        // before the shot — that reads as "move then attack".
        if (discoveryFree && a.from !== a.pathRevealFrom) {
          const approach: ResolveMove = {
            piece: a.piece,
            color: a.color,
            from: a.pathRevealFrom!,
            to: a.from,
          };
          const approachCommit: CombatCommit = {
            placement: relocatePlacement(running.placement, a.pathRevealFrom!, a.from),
            kingLives: { ...running.kingLives },
            phase: "M",
            mines: running.mines,
          };
          playMoves([approach], approachCommit, {
            ...opts,
            onDone: playShot,
          });
        } else {
          playShot();
        }
        return;
      }

      if (a.kind !== "capture") {
        playNext();
        return;
      }

      const applied = applyPathRevealAttack(running, a);
      if (!applied.fired) {
        running = {
          placement: applied.placement,
          mines: [...applied.mines],
          kingLives: { ...running.kingLives },
        };
        playNext();
        return;
      }
      const kingLives = running.kingLives;
      const discoveryFree = !placementToMap(running.placement).has(a.from);
      const cue: AttackCue = {
        id: nextId(`pa-${a.piece}-${a.to}-${stamp}-${i}`),
        piece: a.piece,
        color: a.color,
        from: discoveryFree ? a.from : a.pathRevealFrom!,
        to: a.to,
      };
      const deathId = nextId(`pa-death-${a.to}-${stamp}-${i}`);

      const finishAttack = (
        attackResolvedCommit: CombatCommit,
        occupyMove: ResolveMove,
        occupyCommit: CombatCommit,
      ) => {
        setFx({ attackCues: [cue] });
        after(FRAG_FLIGHT_MS, () => {
          setFx({
            deathCues: [
              ...fx.deathCues,
              { id: deathId, piece: a.victim.piece, color: a.victim.color, at: a.to },
            ],
          });
          after(DEATH_MS, () => {
            setFx({
              attackCues: [],
              deathCues: fx.deathCues.filter((d) => d.id !== deathId),
            });
            doCommit(attackResolvedCommit);
            syncKingDamageFromBoard(
              attackResolvedCommit.placement,
              attackResolvedCommit.kingLives,
            );
            playMoves([occupyMove], occupyCommit, {
              ...opts,
              onDone: () => {
                running = {
                  placement: applied.placement,
                  mines: [...applied.mines],
                  kingLives: { ...kingLives },
                };
                playNext();
              },
            });
          });
        });
      };

      if (discoveryFree) {
        const approach: ResolveMove = {
          piece: a.piece,
          color: a.color,
          from: a.pathRevealFrom!,
          to: a.from,
        };
        const occupy: ResolveMove = {
          piece: a.piece,
          color: a.color,
          from: a.from,
          to: a.to,
        };
        const approachCommit: CombatCommit = {
          placement: relocatePlacement(running.placement, a.pathRevealFrom!, a.from),
          kingLives,
          phase: "M",
          mines: running.mines,
        };
        const attackResolvedCommit: CombatCommit = {
          placement: withoutSquare(approachCommit.placement, a.to),
          kingLives,
          phase: "M",
          mines: applied.mines,
        };
        const occupyCommit: CombatCommit = {
          placement: relocatePlacement(attackResolvedCommit.placement, a.from, a.to),
          kingLives,
          phase: "M",
          mines: applied.mines,
        };
        playMoves([approach], approachCommit, {
          ...opts,
          onDone: () => finishAttack(attackResolvedCommit, occupy, occupyCommit),
        });
      } else {
        const occupy: ResolveMove = {
          piece: a.piece,
          color: a.color,
          from: a.pathRevealFrom!,
          to: a.to,
        };
        const attackResolvedCommit: CombatCommit = {
          placement: withoutSquare(running.placement, a.to),
          kingLives,
          phase: "M",
          mines: applied.mines,
        };
        const occupyCommit: CombatCommit = {
          placement: applied.placement,
          kingLives,
          phase: "M",
          mines: applied.mines,
        };
        finishAttack(attackResolvedCommit, occupy, occupyCommit);
      }
    };

    playNext();
  };

  const finishResolve = () => {
    if (result.pathRevealAttacks.length === 0) {
      settlePromotionsThenDone();
      return;
    }
    playPathRevealAttacks();
  };

  const landedCommit = (): CombatCommit => {
    const map = placementToMap(result.afterAttack.placement);
    for (const m of result.moves) {
      const piece = map.get(m.from);
      if (!piece || piece.color !== m.color) continue;
      map.delete(m.from);
      map.set(m.to, piece);
    }
    return {
      placement: mapToPlacement(map),
      kingLives: { ...result.afterAttack.kingLives },
      phase: "M",
      mines: result.afterAttack.mines,
    };
  };

  const playMineBoomsThenFinish = (onAfter?: () => void) => {
    const stamp = Date.now();
    const deaths: DeathCue[] = result.mineTriggers
      .filter((a): a is Extract<ResolveAttack, { kind: "mineBlast" }> => a.kind === "mineBlast")
      .map((a, i) => {
        const hasVictim = a.victim != null;
        return {
          id: nextId(`mine-${a.to}-${stamp}-${i}`),
          piece: a.victim?.piece ?? "n",
          color: a.victim?.color ?? a.mineColor,
          at: a.to,
          ...(hasVictim ? {} : { mine: true }),
        };
      });
    if (deaths.length) {
      setFx({
        deathCues: [...fx.deathCues, ...deaths],
        spentMines: [
          ...new Set([
            ...fx.spentMines,
            ...result.mineTriggers
              .filter((a) => a.kind === "mineBlast")
              .map((a) => a.to),
          ]),
        ],
      });
    }
    after(DEATH_MS, () => {
      const ids = new Set(deaths.map((d) => d.id));
      setFx({ deathCues: fx.deathCues.filter((d) => !ids.has(d.id)) });
      doCommit(afterMoveCommit);
      syncKingDamageFromBoard(afterMoveCommit.placement, afterMoveCommit.kingLives);
      onAfter?.();
      finishResolve();
    });
  };

  const chaseBlasts = (): Extract<ResolveAttack, { kind: "mineBlast" }>[] =>
    result.mineTriggers.filter(
      (a): a is Extract<ResolveAttack, { kind: "mineBlast" }> =>
        a.kind === "mineBlast" && a.chaseFrom != null,
    );

  const playMineChaseThenBoom = (onAfter?: () => void) => {
    const blasts = chaseBlasts();
    if (blasts.length === 0) {
      playMineBoomsThenFinish(onAfter);
      return;
    }

    const stamp = Date.now();
    const missiles: MineMissileCue[] = blasts.map((a, i) => ({
      id: nextId(`mine-missile-${a.chaseFrom}-${stamp}-${i}`),
      color: a.mineColor,
      from: a.chaseFrom!,
      to: a.to,
    }));
    const trails: QueenJumpTrail[] = missiles
      .filter((m) => m.from !== m.to)
      .map((m) => ({
        id: `trail-${m.id}`,
        from: m.from,
        to: m.to,
      }));

    setFx({
      chasingMines: [],
      spentMines: [
        ...fx.spentMines,
        ...missiles.map((m) => m.from).filter((sq) => !fx.spentMines.includes(sq)),
      ],
      mineMissiles: missiles,
      mineMissileTrails: trails,
    });

    after(MINE_MISSILE_MS, () => {
      setFx({ mineMissiles: [] });
      playMineBoomsThenFinish(() => {
        after(Math.max(0, MINE_TRAIL_MS - DEATH_MS), () => setFx({ mineMissileTrails: [] }));
        onAfter?.();
      });
    });
  };

  const playMoveCollisionsThen = (onAfter?: () => void) => {
    const stamp = Date.now();
    const deaths: DeathCue[] = [];
    for (const [i, a] of result.moveCollisions.entries()) {
      if (a.kind === "capture") {
        deaths.push({
          id: nextId(`mvcol-${a.to}-${stamp}-${i}`),
          piece: a.victim.piece,
          color: a.victim.color,
          at: a.to,
        });
      } else if (a.kind === "mineBlast") {
        deaths.push({
          id: nextId(`mvcol-mine-${a.to}-${stamp}-${i}`),
          piece: "n",
          color: a.mineColor,
          at: a.to,
          mine: true,
        });
      } else if (a.kind === "kingShot") {
        const state = kingDamageStateForLives(a.livesAfter);
        const existing = fx.kingDamage.find((c) => c.id === a.target);
        const rest = fx.kingDamage.filter((c) => c.id !== a.target);
        if (state === "pristine") {
          setFx({ kingDamage: rest });
        } else {
          setFx({
            kingDamage: [
              ...rest,
              {
                id: a.target,
                at: a.to,
                damage: state,
                seed: seedFor(a.target, existing),
                impactSeq: (existing?.impactSeq ?? 0) + 1,
              },
            ],
          });
        }
      }
    }
    if (deaths.length === 0) {
      onAfter?.();
      return;
    }
    setFx({ deathCues: [...fx.deathCues, ...deaths] });
    after(DEATH_MS, () => {
      const ids = new Set(deaths.map((d) => d.id));
      setFx({ deathCues: fx.deathCues.filter((d) => !ids.has(d.id)) });
      onAfter?.();
    });
  };

  const playMovesThenMines = (revealedFrom: ReadonlySet<Square> = new Set()) => {
    const blasts = chaseBlasts();
    const chaseMoverKeys = new Set(blasts.map((a) => `${a.color}:${a.from}:${a.to}`));
    const afterCollisions = (next: () => void) => () => playMoveCollisionsThen(next);

    if (result.mineTriggers.length === 0) {
      if (result.moves.length === 0) {
        playMoveCollisionsThen(() => {
          doCommit(afterMoveCommit);
          syncKingDamageFromBoard(afterMoveCommit.placement, afterMoveCommit.kingLives);
          finishResolve();
        });
        return;
      }
      playMoves(
        result.moves,
        afterMoveCommit,
        { ...opts, onDone: afterCollisions(() => finishResolve()) },
        revealedFrom,
      );
      return;
    }
    if (result.moves.length === 0) {
      if (blasts.length > 0) {
        playMineChaseThenBoom(afterCollisions(() => undefined));
      } else {
        playMineBoomsThenFinish(afterCollisions(() => undefined));
      }
      return;
    }
    const landed = landedCommit();
    playMoves(
      result.moves,
      landed,
      {
        ...opts,
        onDone: () => playMoveCollisionsThen(() => playMineChaseThenBoom()),
      },
      revealedFrom,
      chaseMoverKeys,
    );
  };

  if (result.attacks.length === 0) {
    playMovesThenMines();
    return { cancel: clearTimers };
  }

  const stamp = Date.now();
  const attackCuesLocal: AttackCue[] = result.attacks
    .filter((a) => !("moveCollision" in a && a.moveCollision))
    .map((a, i) => {
      const base: AttackCue = {
        id: nextId(`atk-${a.piece}-${a.from}-${stamp}-${i}`),
        piece: a.piece,
        color: a.color,
        from: a.from,
        to: a.to,
      };
      if (a.kind === "capture" && a.piece === "k") {
        const dmg = kingDamageStateForLives(livesBefore[a.color]);
        const existing = fx.kingDamage.find((c) => c.id === a.color);
        return {
          ...base,
          damage: dmg === "pristine" ? undefined : dmg,
          seed: seedFor(a.color, existing),
        };
      }
      return base;
    });

  if (attackCuesLocal.length === 0) {
    doCommit({
      placement: result.afterAttack.placement,
      kingLives: result.afterAttack.kingLives,
      phase: "A",
      mines: result.afterAttack.mines,
    });
    syncKingDamageFromBoard(result.afterAttack.placement, result.afterAttack.kingLives);
    playMovesThenMines();
    return { cancel: clearTimers };
  }

  const runAttackPhase = () => {
    const attackFrom = new Set(attackCuesLocal.map((a) => a.from));
    setFx({
      kingDamage: fx.kingDamage.filter((c) => !attackFrom.has(c.at)),
      attackCues: attackCuesLocal,
    });

    after(FRAG_FLIGHT_MS, () => {
      const deaths: DeathCue[] = [];
      const mineBoomAts: Square[] = [];
      for (const a of result.attacks) {
        if ("moveCollision" in a && a.moveCollision) continue;
        if (a.kind === "capture") {
          deaths.push({
            id: nextId(`death-${a.to}`),
            piece: a.victim.piece,
            color: a.victim.color,
            at: a.to,
          });
          continue;
        }
        if (a.kind === "mineBlast") {
          deaths.push({
            id: nextId(`death-mine-${a.to}`),
            piece: a.victim?.piece ?? "n",
            color: a.victim?.color ?? a.mineColor,
            at: a.to,
            mine: true,
          });
          mineBoomAts.push(a.to);
          continue;
        }
        if (a.kind === "kingShot" && a.livesAfter === 0) {
          deaths.push({
            id: nextId(`death-k-${a.to}`),
            piece: "k",
            color: a.target,
            at: a.to,
          });
          const existing = fx.kingDamage.find((c) => c.id === a.target);
          const rest = fx.kingDamage.filter((c) => c.id !== a.target);
          setFx({
            kingDamage: [
              ...rest,
              {
                id: a.target,
                at: a.to,
                damage: "destroyed",
                seed: seedFor(a.target, existing),
                impactSeq: (existing?.impactSeq ?? 0) + 1,
              },
            ],
          });
        } else if (a.kind === "kingShot") {
          const state = kingDamageStateForLives(a.livesAfter);
          const existing = fx.kingDamage.find((c) => c.id === a.target);
          const rest = fx.kingDamage.filter((c) => c.id !== a.target);
          if (state === "pristine") {
            setFx({ kingDamage: rest });
          } else {
            setFx({
              kingDamage: [
                ...rest,
                {
                  id: a.target,
                  at: a.to,
                  damage: state,
                  seed: seedFor(a.target, existing),
                  impactSeq: (existing?.impactSeq ?? 0) + 1,
                },
              ],
            });
          }
        }
      }
      if (deaths.length) setFx({ deathCues: [...fx.deathCues, ...deaths] });
      if (mineBoomAts.length) {
        setFx({ spentMines: [...new Set([...fx.spentMines, ...mineBoomAts])] });
      }

      const dying: Record<string, boolean> = { ...fx.attackDying };
      for (const a of attackCuesLocal) {
        if (deaths.some((d) => d.at === a.from)) dying[a.id] = true;
      }
      setFx({ attackDying: dying });

      after(DEATH_MS, () => {
        const deathIds = new Set(deaths.map((d) => d.id));
        setFx({ deathCues: fx.deathCues.filter((d) => !deathIds.has(d.id)) });
        doCommit({
          placement: result.afterAttack.placement,
          kingLives: result.afterAttack.kingLives,
          phase: "A",
          mines: result.afterAttack.mines,
        });
      });
    });

    after(ATTACK_MS, () => {
      const ids = new Set(attackCuesLocal.map((a) => a.id));
      const nextDying = { ...fx.attackDying };
      for (const id of ids) delete nextDying[id];
      setFx({
        attackCues: fx.attackCues.filter((a) => !ids.has(a.id)),
        attackDying: nextDying,
      });

      syncKingDamageFromBoard(result.afterAttack.placement, result.afterAttack.kingLives);

      const attackFromSq = new Set(attackCuesLocal.map((a) => a.from));
      if (result.moves.length === 0 && result.mineTriggers.length === 0) {
        const wait = result.attacks.some((a) => a.kind === "kingShot" && a.livesAfter > 0)
          ? HIT_BOOM_MS
          : DEATH_MS;
        after(wait, () => {
          playMoveCollisionsThen(() => {
            doCommit(afterMoveCommit);
            syncKingDamageFromBoard(afterMoveCommit.placement, afterMoveCommit.kingLives);
            finishResolve();
          });
        });
        return;
      }

      playMovesThenMines(attackFromSq);
    });
  };

  runAttackPhase();
  return { cancel: clearTimers };
};
