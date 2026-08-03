/**
 * Brood War combat move processor — plays resolveTurn results as
 * attack → death → occupy / slide, feeding ChessBoard cues.
 */

import { createMemo, createSignal, onCleanup } from "solid-js";
import type { Square } from "chess.js";

import { ATTACK_MS, FRAG_FLIGHT_MS } from "~/broodwar/animations/attackAnim";
import { DEATH_MS } from "~/broodwar/animations/deathAnim";
import { HIT_BOOM_MS, kingDamageStateForLives } from "~/broodwar/animations/kingDamage";
import type { KingDamageCue } from "~/broodwar/animations/kingDamageOverlay";
import type { AttackCue, DeathCue, MoveCue } from "~/broodwar/animations/types";
import { findKing, placementToMap } from "~/broodwar/board";
import { MOVE_MS, MOVE_SQUARE_MS } from "~/broodwar/constants";
import { knightElbowMs, moveDurationMs } from "~/broodwar/animations/moveTiming";
import { migrateSpecialUsed, rookModeAt } from "~/broodwar/broodWarStore";
import type { ResolveTurnResult } from "~/broodwar/resolveTurn";
import type { BroodWarColor } from "~/broodwar/types";
import { isMoverVisibleToSide } from "~/broodwar/vision";
import { game } from "~/store/gameStore";
import { activePlayerColor } from "~/store/settingsStore";

let cueSeq = 0;
const nextId = (prefix: string) => `${prefix}-${++cueSeq}-${Date.now()}`;

/** One roll per damaged king — reuse via `existing?.seed` so flames don't jump on flee/hit. */
const rollFireSeed = () => Math.floor(Math.random() * 0xffffffff);

export type CombatCommit = {
  placement: string;
  kingLives: Record<BroodWarColor, number>;
  phase: "A" | "M" | "P" | "O";
};

export type PlayResolveOptions = {
  /** Board before this resolve (for damaged-king overlay seeding). */
  startPlacement: string;
  /** Apply mid / final board snapshots (classic placement + lives). */
  commit: (snap: CombatCommit) => void;
  /** Starting lives (before this resolve’s king-shots). */
  livesBefore: Record<BroodWarColor, number>;
  /** Viewer for fog-gated mover hulls (defaults to active player). */
  viewer?: BroodWarColor;
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
 * Animation bus + move processor for Brood War classical resolve.
 * Demos / NerdScreen feed `resolveTurn` results here — no per-story VFX forks.
 */
export function useBroodWarCombat() {
  const [attackCues, setAttackCues] = createSignal<AttackCue[]>([]);
  const [attackDying, setAttackDying] = createSignal<Record<string, boolean>>({});
  const [deathCues, setDeathCues] = createSignal<DeathCue[]>([]);
  const [moveCues, setMoveCues] = createSignal<MoveCue[]>([]);
  const [moveProgress, setMoveProgress] = createSignal<Record<string, 0 | 1>>({});
  const [moveLeg, setMoveLeg] = createSignal<Record<string, 0 | 1>>({});
  const [kingDamage, setKingDamage] = createSignal<KingDamageCue[]>([]);
  /** Survives `clear()` / turn-seek so FEN restore doesn't re-roll spots; remount (refresh) resets. */
  const fireSeeds: Partial<Record<BroodWarColor, number>> = {};
  const seedFor = (color: BroodWarColor, existing?: KingDamageCue) => {
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
    lives: Record<BroodWarColor, number>,
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
  };

  const playMoves = (
    moves: ResolveTurnResult["moves"],
    fenAfter: CombatCommit,
    opts: PlayResolveOptions,
    revealedFrom: ReadonlySet<Square> = new Set(),
  ) => {
    const viewer = opts.viewer ?? activePlayerColor();
    const g = game();

    const damagedIds = new Set(kingDamage().map((c) => c.id));
    const kingMoves = moves.filter((m) => m.piece === "k" && damagedIds.has(m.color));
    const hullMoves = moves.filter((m) => !(m.piece === "k" && damagedIds.has(m.color)));
    // Fog gates player visuals only — engine still commits fenAfter after travel.
    // Attackers keep their shot reveal for the occupy/slide cue; rook vision
    // parity comes from the store so siege mode matches ChessBoard fog.
    const shown = hullMoves.filter((m) =>
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

    const livesBefore = opts.livesBefore;
    syncKingDamageFromBoard(opts.startPlacement, livesBefore);

    const afterMoveCommit: CombatCommit = {
      placement: result.afterMove.placement,
      kingLives: result.afterMove.kingLives,
      phase: result.afterMove.kingLives.w === 0 || result.afterMove.kingLives.b === 0 ? "O" : "P",
    };

    if (result.attacks.length === 0) {
      playMoves(result.moves, afterMoveCommit, opts);
      return;
    }

    const stamp = Date.now();
    const attackCuesLocal: AttackCue[] = result.attacks.map((a, i) => {
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

    // Attack hull owns attackers — drop damage overlay on those squares for the shot.
    const attackFrom = new Set(attackCuesLocal.map((a) => a.from));
    setKingDamage((prev) => prev.filter((c) => !attackFrom.has(c.at)));
    setAttackCues(attackCuesLocal);

    after(FRAG_FLIGHT_MS, () => {
      const deaths: DeathCue[] = [];
      for (const a of result.attacks) {
        if (a.kind === "capture") {
          deaths.push({
            id: nextId(`death-${a.to}`),
            piece: a.victim.piece,
            color: a.victim.color,
            at: a.to,
          });
          continue;
        }
        if (a.livesAfter === 0) {
          deaths.push({
            id: nextId(`death-k-${a.to}`),
            piece: "k",
            color: a.target,
            at: a.to,
          });
          // Keep rubble cue ready; death layer wins until collapse finishes.
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
        } else {
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
                // Connecting king-shot — boom once.
                impactSeq: (existing?.impactSeq ?? 0) + 1,
              },
            ];
          });
        }
      }
      if (deaths.length) setDeathCues((prev) => [...prev, ...deaths]);

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

      // Mid board owns damaged kings again before occupy slides.
      syncKingDamageFromBoard(result.afterAttack.placement, result.afterAttack.kingLives);

      if (result.moves.length === 0) {
        const wait = result.attacks.some((a) => a.kind === "kingShot" && a.livesAfter > 0)
          ? HIT_BOOM_MS
          : DEATH_MS;
        after(wait, () => {
          opts.commit(afterMoveCommit);
          syncKingDamageFromBoard(afterMoveCommit.placement, afterMoveCommit.kingLives);
          opts.onDone?.();
        });
        return;
      }

      playMoves(result.moves, afterMoveCommit, opts, attackFrom);
    });
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
    playResolve,
    playRangedAttack,
    syncKingDamageFromBoard,
    clear,
    attackMs: ATTACK_MS,
    deathMs: DEATH_MS,
    moveMs: MOVE_MS,
    fragFlightMs: FRAG_FLIGHT_MS,
  };
}

export type BroodWarCombat = ReturnType<typeof useBroodWarCombat>;
