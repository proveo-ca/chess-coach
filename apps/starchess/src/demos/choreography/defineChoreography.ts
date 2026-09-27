// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml, _spec/apps/starchess/architecture/reactivity/tutorial.md
/**
 * Declarative choreography helper — the shared guard every scripted-enemy-turn
 * hook used to hand-roll: phase/turnStartChecksApplied/timeline checks, "this
 * color already queued this turn" skip, once-per-turn vs once-ever latching,
 * and never-throw. A hook becomes a `steps` list; only board-specific
 * branching stays as code, via `when`/`actions` or the `run` escape hatch.
 */
import { batch, createEffect, createMemo, onMount } from "solid-js";
import { placementToMap } from "@chess-coach/starchess-core";
import type { ScActionInput, ScFenSnapshot, ScPiece, StarChessColor } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { ChoreographyResult, LessonChoreography } from "~/demos/choreography";
import type { MatchStore } from "~/types/match";

export type ChoreographyStep = {
  /** Fires only on this planning turn (`snap.turn`). Omit = every turn. */
  turn?: number;
  /** Extra board/queue guard, beyond the standard preamble. */
  when?: (map: Map<Square, ScPiece>, snap: ScFenSnapshot) => boolean;
  /** Actions to dispatch as `QUEUE_ACTION` once `when` holds. */
  actions?: (map: Map<Square, ScPiece>, snap: ScFenSnapshot) => readonly ScActionInput[];
  /** `SPEND_STORED`, dispatched before `actions`. */
  spendStored?: (
    map: Map<Square, ScPiece>,
    snap: ScFenSnapshot,
  ) => { color: StarChessColor; amount: number } | undefined;
  /** `store.ensureTurnOpenChecks()` — no board guard beyond `when`. */
  ensureTurnOpenChecks?: boolean;
  /** `store.submitTurn("end")`, after `actions`/`ensureTurnOpenChecks`. */
  submitTurn?: "end";
  /**
   * Escape hatch for a branch too irregular for `actions` (per-branch fallback
   * action shapes, a dynamic submit). Runs instead of `actions`/`spendStored`/
   * `submitTurn`. Return `true` once the step's work for this turn (or ever,
   * under `once`) is done; `false` retries on the next tick. Bypasses the
   * standard "already queued for `color`" precheck — the callback decides.
   */
  run?: (args: { store: MatchStore; map: Map<Square, ScPiece>; snap: ScFenSnapshot }) => boolean;
  /**
   * Wrap the step body in `queueMicrotask` — works around a documented
   * TIMELINE_START clobber when a turn-open dispatch is still unwinding. A
   * deferred `run` re-reads `store.state()` itself once the microtask fires,
   * since the board may have moved on by then.
   */
  defer?: boolean;
  /**
   * Latch once for the whole component's life instead of once per turn (a
   * mount-time opening move, not a per-turn counter).
   */
  once?: boolean;
  /**
   * Fires once on mount via a microtask, bypassing the standard phase /
   * turnStartChecksApplied / timeline / already-queued guard entirely — the
   * step's own `turn`/`when` must encode readiness.
   */
  onMount?: boolean;
  /** Color this step acts for and whose queue the guard checks. Default `"b"`. */
  color?: StarChessColor;
  /**
   * Skip the "already queued for `color`" precheck — a `run` step that needs
   * to act (or submit) even when its color already has something queued
   * (`useMineRa1Counter`'s "submit regardless" turn).
   */
  skipQueuedGuard?: boolean;
};

export type ChoreographyConfig = {
  steps: readonly ChoreographyStep[];
  /** Merged into the result — another hook's `Overlay`/`interactive` (e.g. `useKingHuntGraduation`). */
  compose?: LessonChoreography;
  /** Override the default (no gating) `interactive`. */
  interactive?: (store: MatchStore) => boolean;
};

const dispatchStep = (
  store: MatchStore,
  step: ChoreographyStep,
  map: Map<Square, ScPiece>,
  snap: ScFenSnapshot,
): void => {
  if (step.ensureTurnOpenChecks) store.ensureTurnOpenChecks();
  batch(() => {
    const spend = step.spendStored?.(map, snap);
    if (spend) store.dispatch({ type: "SPEND_STORED", color: spend.color, amount: spend.amount });
    for (const action of step.actions?.(map, snap) ?? []) {
      store.dispatch({ type: "QUEUE_ACTION", action });
    }
  });
  if (step.submitTurn) store.submitTurn(step.submitTurn);
};

const runOnMountStep = (store: MatchStore, step: ChoreographyStep): void => {
  onMount(() => {
    queueMicrotask(() => {
      try {
        const snap = store.state().liveSnapshot;
        if (step.turn != null && snap.turn !== step.turn) return;
        const map = placementToMap(snap.placement);
        if (step.when && !step.when(map, snap)) return;
        dispatchStep(store, step, map, snap);
      } catch {
        /* never throw */
      }
    });
  });
};

const createStepGate = (store: MatchStore) => ({
  phase: createMemo(() => store.shell().phase),
  checksApplied: createMemo(() => store.shell().turnStartChecksApplied),
  timelineActive: createMemo(() => store.timeline().active),
  liveSnapshot: createMemo(() => store.shell().liveSnapshot),
});

type StepGate = ReturnType<typeof createStepGate>;

const runTurnStep = (store: MatchStore, gate: StepGate, step: ChoreographyStep): void => {
  let doneForever = false;
  let doneTurn: number | null = null;

  createEffect(() => {
    try {
      const phase = gate.phase();
      if (phase !== "planning" && phase !== "targeting") return;
      if (!gate.checksApplied() || gate.timelineActive()) return;
      const snap = gate.liveSnapshot();
      if (snap.phase !== "P") return;
      if (step.turn != null && snap.turn !== step.turn) return;
      if (doneForever || doneTurn === snap.turn) return;

      const markDone = () => {
        if (step.once) doneForever = true;
        else doneTurn = snap.turn;
      };

      const color = step.color ?? "b";
      if (!step.skipQueuedGuard && (snap.queue?.actions ?? []).some((a) => a.color === color)) {
        markDone();
        return;
      }

      if (step.run) {
        if (step.defer) {
          // Arm immediately — the microtask re-checks the board itself once it
          // fires, and this hook never re-enters regardless of what it finds.
          markDone();
          queueMicrotask(() => {
            try {
              const cur = store.state();
              if (cur.phase !== "planning" && cur.phase !== "targeting") return;
              const live = cur.liveSnapshot;
              if (step.turn != null && live.turn !== step.turn) return;
              if (live.phase !== "P") return;
              step.run!({ store, map: placementToMap(live.placement), snap: live });
            } catch {
              /* never throw */
            }
          });
          return;
        }
        const map = placementToMap(snap.placement);
        if (step.run({ store, map, snap })) markDone();
        return;
      }

      const map = placementToMap(snap.placement);
      if (step.when && !step.when(map, snap)) return;
      dispatchStep(store, step, map, snap);
      markDone();
    } catch {
      /* never throw */
    }
  });
};

export const defineChoreography = (config: ChoreographyConfig): LessonChoreography => {
  return (store, ctx) => {
    const gate = createStepGate(store);
    for (const step of config.steps) {
      if (step.onMount) runOnMountStep(store, step);
      else runTurnStep(store, gate, step);
    }
    const composed = config.compose?.(store, ctx);
    const interactive = config.interactive
      ? createMemo(() => config.interactive!(store))
      : composed?.interactive;
    const result: ChoreographyResult = { ...composed };
    if (interactive) result.interactive = interactive;
    return result;
  };
};
