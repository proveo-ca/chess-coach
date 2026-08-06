/**
 * StarChess combat move processor — plays resolveTurn results as
 * attack → death → occupy / slide, feeding ChessBoard cues.
 * // SPEC: _spec/apps/ui/starchess/resolve.puml
 */

import { createMemo, createSignal, onCleanup } from "solid-js";
import type { Square } from "chess.js";

import { ATTACK_MS, FRAG_FLIGHT_MS } from "~/starchess/animations/attackAnim";
import { DEATH_MS } from "~/starchess/animations/deathAnim";
import { HIT_BOOM_MS, kingDamageStateForLives } from "~/starchess/animations/kingDamage";
import type { KingDamageCue } from "~/starchess/animations/kingDamageOverlay";
import type { AttackCue, DeathCue, MoveCue } from "~/starchess/animations/types";
import { findKing, mapToPlacement, placementToMap } from "~/starchess/board";
import { MINE_MISSILE_MS, MINE_TRAIL_MS, MOVE_MS, MOVE_SQUARE_MS, DEPLOY_MS } from "~/starchess/constants";
import { knightElbowMs, moveDurationMs } from "~/starchess/animations/moveTiming";
import { migrateSpecialUsed, rookModeAt } from "~/starchess/starChessStore";
import {
  applyPathRevealAttack,
  applyPathRevealKingShot,
  type PathRevealSnap,
  type ResolveAttack,
  type ResolveMove,
  type ResolveTurnResult,
} from "~/starchess/resolveTurn";
import type { StarChessColor } from "~/starchess/types";
import { isMoverVisibleToSide } from "~/starchess/vision";
import { game } from "~/store/gameStore";
import { activePlayerColor } from "~/store/settingsStore";
import type { MineMissileCue, QueenJumpTrail, ScMine } from "~/starchess/types";

export type ChasingMineCue = { at: Square; legMs: number[] };

let cueSeq = 0;
const nextId = (prefix: string) => `${prefix}-${++cueSeq}-${Date.now()}`;

/** One roll per damaged king — reuse via `existing?.seed` so flames don't jump on flee/hit. */
const rollFireSeed = () => Math.floor(Math.random() * 0xffffffff);

/** Move one unit from→to in a placement string (no-op if `from` is empty). */
const relocatePlacement = (placement: string, from: Square, to: Square): string => {
  const map = placementToMap(placement);
  const piece = map.get(from);
  if (!piece) return placement;
  map.delete(from);
  map.set(to, piece);
  return mapToPlacement(map);
};

/** Remove whatever occupies `at` from a placement string. */
const withoutSquare = (placement: string, at: Square): string => {
  const map = placementToMap(placement);
  map.delete(at);
  return mapToPlacement(map);
};

export type CombatCommit = {
  placement: string;
  kingLives: Record<StarChessColor, number>;
  phase: "A" | "M" | "P" | "O";
  /** Mines after this commit (attack may clear destination mines). */
  mines: readonly ScMine[];
};

export type PlayResolveOptions = {
  /** Board before this resolve (for damaged-king overlay seeding). */
  startPlacement: string;
  /** Apply mid / final board snapshots (classic placement + lives). */
  commit: (snap: CombatCommit) => void;
  /** Starting lives (before this resolve’s king-shots). */
  livesBefore: Record<StarChessColor, number>;
  /** Viewer for fog-gated mover hulls (defaults to active player). */
  viewer?: StarChessColor;
  onDone?: () => void;
};

export type PlayRangedAttackOptions = {
  /** Single special attack cue (e.g. bishop Charon Booster Missiles). */
  cue: AttackCue;
  /** Victim death cue spawned at impact (omit for pure damage FX). */
  death?: DeathCue | null;
  /** Projectile impact window; defaults to the combat kill→death delay. */
  impactMs?: number;
  /** Commit the board after impact + death collapse. */
  commit: () => void;
  onDone?: () => void;
};

/**
 * Animation bus + move processor for StarChess classical resolve.
 * Demos / NerdScreen feed `resolveTurn` results here — no per-story VFX forks.
 */
export function useStarChessCombat() {
  const [attackCues, setAttackCues] = createSignal<AttackCue[]>([]);
  const [attackDying, setAttackDying] = createSignal<Record<string, boolean>>({});
  const [deathCues, setDeathCues] = createSignal<DeathCue[]>([]);
  const [moveCues, setMoveCues] = createSignal<MoveCue[]>([]);
  const [moveProgress, setMoveProgress] = createSignal<Record<string, 0 | 1>>({});
  const [moveLeg, setMoveLeg] = createSignal<Record<string, 0 | 1>>({});
  const [kingDamage, setKingDamage] = createSignal<KingDamageCue[]>([]);
  /** Mine squares in chase wake (board glyph legs + lift). */
  const [chasingMines, setChasingMines] = createSignal<ChasingMineCue[]>([]);
  /** Self-missile hulls after the victim lands. */
  const [mineMissiles, setMineMissiles] = createSignal<MineMissileCue[]>([]);
  /** Single green trails for mine missiles. */
  const [mineMissileTrails, setMineMissileTrails] = createSignal<QueenJumpTrail[]>([]);
  /** Mines that left the board (missile launch) — stay hidden until clear. */
  const [spentMines, setSpentMines] = createSignal<Square[]>([]);
  /** Survives `clear()` / turn-seek so FEN restore doesn't re-roll spots; remount (refresh) resets. */
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

  const timers: number[] = [];
  const after = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };

  const clearTimers = () => {
    while (timers.length) window.clearTimeout(timers.pop());
  };

  onCleanup(clearTimers);

  const syncKingDamageFromBoard = (
    placement: string,
    lives: Record<StarChessColor, number>,
  ) => {
    const map = placementToMap(placement);
    setKingDamage((prev) => {
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
          // Preserve — never invent a hit boom from a FEN restore.
          impactSeq: existing?.impactSeq,
        });
      }
      return cues;
    });
  };

  const clear = () => {
    clearTimers();
    setAttackCues([]);
    setAttackDying({});
    setDeathCues([]);
    setMoveCues([]);
    setMoveProgress({});
    setMoveLeg({});
    setKingDamage([]);
    setChasingMines([]);
    setMineMissiles([]);
    setMineMissileTrails([]);
    setSpentMines([]);
  };

  const playMoves = (
    moves: ResolveTurnResult["moves"],
    fenAfter: CombatCommit,
    opts: PlayResolveOptions,
    revealedFrom: ReadonlySet<Square> = new Set(),
    /** Engine chase victims — always animate even under fog (mineTriggers). */
    forceShowKeys: ReadonlySet<string> = new Set(),
  ) => {
    const viewer = opts.viewer ?? activePlayerColor();
    const g = game();

    const damagedIds = new Set(kingDamage().map((c) => c.id));
    const kingMoves = moves.filter((m) => m.piece === "k" && damagedIds.has(m.color));
    const hullMoves = moves.filter((m) => !(m.piece === "k" && damagedIds.has(m.color)));
    // Fog gates player visuals only — engine still commits fenAfter after travel.
    // Attackers keep their shot reveal for the occupy/slide cue; rook vision
    // parity comes from the store so siege mode matches ChessBoard fog.
    // Chase-blast movers always hull-slide: the mine is hunting them (SCFEN).
    const moveKey = (m: { color: string; from: Square; to: Square }) =>
      `${m.color}:${m.from}:${m.to}`;
    const shown = hullMoves.filter(
      (m) =>
        forceShowKeys.has(moveKey(m)) ||
        isMoverVisibleToSide(g, viewer, m, revealedFrom, { rookModeFor: rookModeAt }),
    );

    let pending = 0;
    const done = () => {
      pending -= 1;
      if (pending > 0) return;
      setMoveCues([]);
      setMoveProgress({});
      setMoveLeg({});
      opts.commit(fenAfter);
      syncKingDamageFromBoard(fenAfter.placement, fenAfter.kingLives);
      opts.onDone?.();
    };
    const arm = (ms: number) => {
      pending += 1;
      after(ms, done);
    };

    for (const m of kingMoves) {
      setKingDamage((prev) =>
        prev.map((c) => (c.id === m.color ? { ...c, at: m.from } : c)),
      );
      after(16, () => {
        setKingDamage((prev) =>
          prev.map((c) => (c.id === m.color ? { ...c, at: m.to } : c)),
        );
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
      setMoveCues((prev) => [...prev, ...cues]);
      for (const c of cues) migrateSpecialUsed(c.from, c.to);
      setMoveProgress((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = 0;
        return next;
      });
      setMoveLeg((prev) => {
        const next = { ...prev };
        for (const id of knightIds) next[id] = 0;
        return next;
      });
      after(40, () => {
        setMoveProgress((prev) => {
          const next = { ...prev };
          for (const id of ids) next[id] = 1;
          return next;
        });
      });
      for (const k of knights) {
        after(40 + knightElbowMs(k.from, k.to), () => {
          setMoveLeg((prev) => (k.id in prev ? { ...prev, [k.id]: 1 } : prev));
        });
      }
      after(40 + batchMs, () => {
        const idSet = new Set(ids);
        setMoveCues((prev) => prev.filter((m) => !idSet.has(m.id)));
        setMoveProgress((prev) => {
          const next = { ...prev };
          for (const id of ids) delete next[id];
          return next;
        });
        setMoveLeg((prev) => {
          const next = { ...prev };
          for (const id of ids) delete next[id];
          return next;
        });
        done();
      });
      pending += 1;
    } else if (kingMoves.length === 0) {
      arm(MOVE_MS);
    }
  };

  /**
   * Play one ranged special attack without a classical relocate:
   * cue → impact (death cue) → death collapse → commit.
   */
  const playRangedAttack = (opts: PlayRangedAttackOptions) => {
    clearTimers();
    setAttackCues([]);
    setAttackDying({});
    setDeathCues([]);
    setMoveCues([]);
    setMoveProgress({});
    setMoveLeg({});

    setAttackCues([opts.cue]);
    after(opts.impactMs ?? FRAG_FLIGHT_MS, () => {
      if (opts.death) setDeathCues([opts.death]);
      after(DEATH_MS, () => {
        setAttackCues([]);
        setDeathCues([]);
        opts.commit();
        opts.onDone?.();
      });
    });
  };

  /**
   * Play a full classical resolve: attack → death → mid-FEN → occupy / slides.
   */
  const playResolve = (result: ResolveTurnResult, opts: PlayResolveOptions) => {
    clearTimers();
    setAttackCues([]);
    setAttackDying({});
    setDeathCues([]);
    setMoveCues([]);
    setMoveProgress({});
    setMoveLeg({});
    setChasingMines([]);
    setMineMissiles([]);
    setMineMissileTrails([]);
    setSpentMines([]);

    const livesBefore = opts.livesBefore;
    syncKingDamageFromBoard(opts.startPlacement, livesBefore);

    const afterMoveCommit: CombatCommit = {
      placement: result.afterMove.placement,
      kingLives: result.afterMove.kingLives,
      phase: result.afterMove.kingLives.w === 0 || result.afterMove.kingLives.b === 0 ? "O" : "P",
      mines: result.afterMove.mines,
    };

    /** Final board — phase 3 fog approaches applied (commit after all three phases). */
    const afterAllCommit: CombatCommit = {
      placement: result.afterAll.placement,
      kingLives: result.afterAll.kingLives,
      phase: result.afterAll.kingLives.w === 0 || result.afterAll.kingLives.b === 0 ? "O" : "P",
      mines: result.afterAll.mines,
    };

    // Phase 3 — fog approaches (path-reveal captures) fire after moves:
    // approach slide → attack cue + victim death → occupy slide → next.
    // `result.pathRevealAttacks` holds only attacks that fired; the running
    // state replays each attack through the engine's single source of truth so
    // intermediate frames never clobber a discovery-square occupier or leave a
    // cleared mine in place.
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
            setAttackCues([cue]);
            after(FRAG_FLIGHT_MS, () => {
              const state = kingDamageStateForLives(a.livesAfter);
              setKingDamage((prev) => {
                const existing = prev.find((c) => c.id === a.target);
                const rest = prev.filter((c) => c.id !== a.target);
                if (state === "pristine") return rest;
                return [
                  ...rest,
                  {
                    id: a.target,
                    at: a.to,
                    damage: state,
                    seed: seedFor(a.target, existing),
                    impactSeq: (existing?.impactSeq ?? 0) + 1,
                  },
                ];
              });
              setAttackCues([]);
              const wait = a.livesAfter > 0 ? HIT_BOOM_MS : DEATH_MS;
              after(wait, () => {
                opts.commit(finalCommit);
                syncKingDamageFromBoard(finalCommit.placement, finalCommit.kingLives);
                running = {
                  placement: applied.placement,
                  mines: [...applied.mines],
                  kingLives: { ...applied.kingLives },
                };
                playNext();
              });
            });
          };
          if (stopAt !== a.pathRevealFrom) {
            const approach: ResolveMove = {
              piece: a.piece,
              color: a.color,
              from: a.pathRevealFrom!,
              to: stopAt,
            };
            const approachCommit: CombatCommit = {
              placement: relocatePlacement(running.placement, a.pathRevealFrom!, stopAt),
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

        // Authoritative post-attack state (mirror of the engine phase-3 loop).
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
          // Two-hop: the actor stages on the discovery square, so the shot
          // originates there. Single-slide (discovery square occupied): the
          // actor shoots from `pathRevealFrom` as it slides straight to `to`.
          from: discoveryFree ? a.from : a.pathRevealFrom!,
          to: a.to,
        };
        const deathId = nextId(`pa-death-${a.to}-${stamp}-${i}`);

        const finishAttack = (
          attackResolvedCommit: CombatCommit,
          occupyMove: ResolveMove,
          occupyCommit: CombatCommit,
        ) => {
          setAttackCues([cue]);
          after(FRAG_FLIGHT_MS, () => {
            setDeathCues((prev) => [
              ...prev,
              { id: deathId, piece: a.victim.piece, color: a.victim.color, at: a.to },
            ]);
            after(DEATH_MS, () => {
              setAttackCues([]);
              setDeathCues((prev) => prev.filter((d) => d.id !== deathId));
              opts.commit(attackResolvedCommit);
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

        // Cinematic two-hop (approach → attack → occupy) only when the discovery
        // square is free; otherwise slide straight `pathRevealFrom → to`.
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

    /**
     * Promotion: land as pawn, brief hold, then swap to the promoted unit so
     * auto-deploy VFX plays. Promoting pawns killed by mines never appear in
     * `result.promotions`. Full off-board walk-off overlay is a follow-up; the
     * pawn→promoted swap is the shipped deploy contract.
     */
    const settlePromotionsThenDone = () => {
      if (!result.promotions.length) {
        opts.commit(afterAllCommit);
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
      opts.commit(prePromo);
      syncKingDamageFromBoard(prePromo.placement, prePromo.kingLives);
      after(Math.max(MOVE_MS, 180), () => {
        opts.commit(afterAllCommit);
        syncKingDamageFromBoard(afterAllCommit.placement, afterAllCommit.kingLives);
        after(DEPLOY_MS, () => opts.onDone?.());
      });
    };

    const finishResolve = () => {
      if (result.pathRevealAttacks.length === 0) {
        settlePromotionsThenDone();
        return;
      }
      playPathRevealAttacks();
    };

    /** Board after slides land, before chase boom removes victims. */
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
      // Chase / stand kills: unit shatter + boom. Mine-only clears: boom only.
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
      if (deaths.length) setDeathCues((prev) => [...prev, ...deaths]);
      after(DEATH_MS, () => {
        const ids = new Set(deaths.map((d) => d.id));
        setDeathCues((prev) => prev.filter((d) => !ids.has(d.id)));
        opts.commit(afterMoveCommit);
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

    /** After victim lands: lift → launch → boom (mine stays idle during the slide). */
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
          color: m.color,
          from: m.from,
          to: m.to,
        }));

      setChasingMines([]);
      // Board glyph gone once the overlay takes over (lift + launch).
      setSpentMines((prev) => [
        ...prev,
        ...missiles.map((m) => m.from).filter((sq) => !prev.includes(sq)),
      ]);
      setMineMissiles(missiles);
      setMineMissileTrails(trails);

      // Lift 200ms + launch 50ms (= MINE_MISSILE_MS), then boom at destination.
      after(MINE_MISSILE_MS, () => {
        setMineMissiles([]);
        playMineBoomsThenFinish(() => {
          after(Math.max(0, MINE_TRAIL_MS - DEATH_MS), () => setMineMissileTrails([]));
          onAfter?.();
        });
      });
    };

    /** Chase model: wake during slides, missile after land, then boom at destination. */
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
          setKingDamage((prev) => {
            const existing = prev.find((c) => c.id === a.target);
            const rest = prev.filter((c) => c.id !== a.target);
            if (state === "pristine") return rest;
            return [
              ...rest,
              {
                id: a.target,
                at: a.to,
                damage: state,
                seed: seedFor(a.target, existing),
                impactSeq: (existing?.impactSeq ?? 0) + 1,
              },
            ];
          });
        }
      }
      if (deaths.length === 0) {
        onAfter?.();
        return;
      }
      setDeathCues((prev) => [...prev, ...deaths]);
      after(DEATH_MS, () => {
        const ids = new Set(deaths.map((d) => d.id));
        setDeathCues((prev) => prev.filter((d) => !ids.has(d.id)));
        onAfter?.();
      });
    };

    const playMovesThenMines = (revealedFrom: ReadonlySet<Square> = new Set()) => {
      const blasts = chaseBlasts();
      // Keys from engine mineTriggers — never invent chase targets in the UI.
      const chaseMoverKeys = new Set(
        blasts.map((a) => `${a.color}:${a.from}:${a.to}`),
      );
      // Do NOT wake/lift the mine during the victim's slide — only after they
      // land (playMineChaseThenBoom): lift 200ms → launch 50ms.

      const afterCollisions = (next: () => void) => () => playMoveCollisionsThen(next);

      if (result.mineTriggers.length === 0) {
        if (result.moves.length === 0) {
          playMoveCollisionsThen(() => {
            opts.commit(afterMoveCommit);
            syncKingDamageFromBoard(afterMoveCommit.placement, afterMoveCommit.kingLives);
            finishResolve();
          });
          return;
        }
        playMoves(result.moves, afterMoveCommit, {
          ...opts,
          onDone: afterCollisions(() => finishResolve()),
        }, revealedFrom);
        return;
      }
      if (result.moves.length === 0) {
        // Stand / zero-move wake — lift → launch → boom (same post-contact timing).
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
      return;
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
          const existing = kingDamage().find((c) => c.id === a.color);
          return {
            ...base,
            damage: dmg === "pristine" ? undefined : dmg,
            seed: seedFor(a.color, existing),
          };
        }
        return base;
      });

    // Fogged clears (moveCollision) skip attack VFX — mid-board + move phase.
    if (attackCuesLocal.length === 0) {
      opts.commit({
        placement: result.afterAttack.placement,
        kingLives: result.afterAttack.kingLives,
        phase: "A",
        mines: result.afterAttack.mines,
      });
      syncKingDamageFromBoard(result.afterAttack.placement, result.afterAttack.kingLives);
      playMovesThenMines();
      return;
    }

    const runAttackPhase = () => {
      // Attack hull owns attackers — drop damage overlay on those squares for the shot.
      const attackFrom = new Set(attackCuesLocal.map((a) => a.from));
      setKingDamage((prev) => prev.filter((c) => !attackFrom.has(c.at)));
      setAttackCues(attackCuesLocal);

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
            setKingDamage((prev) => {
              const existing = prev.find((c) => c.id === a.target);
              const rest = prev.filter((c) => c.id !== a.target);
              return [
                ...rest,
                {
                  id: a.target,
                  at: a.to,
                  damage: "destroyed",
                  seed: seedFor(a.target, existing),
                  impactSeq: (existing?.impactSeq ?? 0) + 1,
                },
              ];
            });
          } else if (a.kind === "kingShot") {
            const state = kingDamageStateForLives(a.livesAfter);
            setKingDamage((prev) => {
              const existing = prev.find((c) => c.id === a.target);
              const rest = prev.filter((c) => c.id !== a.target);
              if (state === "pristine") return rest;
              return [
                ...rest,
                {
                  id: a.target,
                  at: a.to,
                  damage: state,
                  seed: seedFor(a.target, existing),
                  impactSeq: (existing?.impactSeq ?? 0) + 1,
                },
              ];
            });
          }
        }
        if (deaths.length) setDeathCues((prev) => [...prev, ...deaths]);
        if (mineBoomAts.length) {
          setSpentMines((prev) => [...new Set([...prev, ...mineBoomAts])]);
        }

        setAttackDying((prev) => {
          const next = { ...prev };
          for (const a of attackCuesLocal) {
            if (deaths.some((d) => d.at === a.from)) next[a.id] = true;
          }
          return next;
        });

        after(DEATH_MS, () => {
          const deathIds = new Set(deaths.map((d) => d.id));
          setDeathCues((prev) => prev.filter((d) => !deathIds.has(d.id)));
          opts.commit({
            placement: result.afterAttack.placement,
            kingLives: result.afterAttack.kingLives,
            phase: "A",
            mines: result.afterAttack.mines,
          });
        });
      });

      after(ATTACK_MS, () => {
        const ids = new Set(attackCuesLocal.map((a) => a.id));
        setAttackCues((prev) => prev.filter((a) => !ids.has(a.id)));
        setAttackDying((prev) => {
          const next = { ...prev };
          for (const id of ids) delete next[id];
          return next;
        });

        syncKingDamageFromBoard(result.afterAttack.placement, result.afterAttack.kingLives);

        const attackFrom = new Set(attackCuesLocal.map((a) => a.from));
        if (result.moves.length === 0 && result.mineTriggers.length === 0) {
          const wait = result.attacks.some((a) => a.kind === "kingShot" && a.livesAfter > 0)
            ? HIT_BOOM_MS
            : DEATH_MS;
          after(wait, () => {
            playMoveCollisionsThen(() => {
              opts.commit(afterMoveCommit);
              syncKingDamageFromBoard(afterMoveCommit.placement, afterMoveCommit.kingLives);
              finishResolve();
            });
          });
          return;
        }

        playMovesThenMines(attackFrom);
      });
    };

    runAttackPhase();
  };

  const boardKingDamage = createMemo(() => {
    const dying = new Set(deathCues().map((d) => d.at));
    return kingDamage().filter((c) => !dying.has(c.at));
  });

  return {
    attackCues,
    attackDying,
    deathCues,
    moveCues,
    moveProgress,
    moveLeg,
    kingDamage: boardKingDamage,
    chasingMines,
    mineMissiles,
    mineMissileTrails,
    spentMines,
    playResolve,
    playRelocates: (
      moves: ResolveTurnResult["moves"],
      fenAfter: CombatCommit,
      opts: PlayResolveOptions,
    ) => {
      clearTimers();
      setAttackCues([]);
      setAttackDying({});
      setDeathCues([]);
      setMoveCues([]);
      setMoveProgress({});
      setMoveLeg({});
      setChasingMines([]);
      setMineMissiles([]);
      setMineMissileTrails([]);
      setSpentMines([]);
      if (moves.length === 0) {
        opts.commit(fenAfter);
        syncKingDamageFromBoard(fenAfter.placement, fenAfter.kingLives);
        opts.onDone?.();
        return;
      }
      playMoves(moves, fenAfter, opts);
    },
    playRangedAttack,
    syncKingDamageFromBoard,
    clear,
    attackMs: ATTACK_MS,
    deathMs: DEATH_MS,
    moveMs: MOVE_MS,
    fragFlightMs: FRAG_FLIGHT_MS,
    mineMissileMs: MINE_MISSILE_MS,
  };
}

export type StarChessCombat = ReturnType<typeof useStarChessCombat>;
