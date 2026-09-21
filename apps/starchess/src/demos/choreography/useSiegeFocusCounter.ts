// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Rook Siege focus counter — deterministic lesson-only black intents.
 * Seed turn 0: SCFEN|7k/3p4/8/8/p2R3p/8/3p4/K7|0|33|P|G:11:11|Q:w:;b:|S:d4
 * Priority each turn: while the h4 pawn lives, stack it gas + move
 * (C plus F pawnDouble, rewriting to a double step — the pawn stays
 * on its square through the attack phase, so the hint stays killable).
 * Promoting d2→d1 is the fallback once h4 falls: B-gas slips
 * away pre-attack (the tank intent on d2 still resolves — HE shells the
 * vacated square) and the ship is answered on d1 next turn. Later the
 * ship pressures c1 (never d4 — an instant Qxd4 would fail the lesson).
 * The d7 pawn likewise slips with 1st-phase gas to d6: the tank intent on
 * d7 collides with the interceptor by the collision rules (explosion on
 * d6, never reaching d7). Best-effort, never throws.
 */
import { createEffect } from "solid-js";
import { placementToMap } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { ChoreographyResult } from "~/demos/choreography";
import type { MatchStore } from "~/types/match";

/**
 * Queue a gas + move double-step (C classical plus F pawnDouble, which
 * rewrites to continue one more square). Returns true when the classical
 * leg landed; a failed F still leaves the single step. Never throws.
 */
const queueGasMove = (
  store: MatchStore,
  from: Square,
  to: Square,
): boolean => {
  try {
    store.dispatch({
      type: "QUEUE_ACTION",
      action: { timing: "C", kind: "classical", color: "b", from, to },
    });
  } catch {
    return false;
  }
  try {
    store.dispatch({
      type: "QUEUE_ACTION",
      action: { timing: "F", kind: "pawnDouble", color: "b", from, to },
    });
  } catch {
    /* gas spent — C alone still steps */
  }
  return true;
};

export const useSiegeFocusCounter = (store: MatchStore): ChoreographyResult => {
  let queuedTurn: number | null = null;

  createEffect(() => {
    try {
      const s = store.state();
      if (s.phase !== "planning" && s.phase !== "targeting") return;
      if (!s.turnStartChecksApplied || s.timeline.active) return;
      const snap = s.liveSnapshot;
      if (snap.phase !== "P") return;
      if (queuedTurn === snap.turn) return;
      if ((snap.queue?.actions ?? []).some((a) => a.color === "b")) {
        queuedTurn = snap.turn;
        return;
      }
      const map = placementToMap(snap.placement);

      const h4 = map.get("h4");
      if (h4?.type === "p" && h4.color === "b") {
        if (queueGasMove(store, "h4", "h3")) queuedTurn = snap.turn;
        return;
      }
      const d2 = map.get("d2");
      if (d2?.type === "p" && d2.color === "b" && !map.has("d1")) {
        // Fallback promotion: B-gas slips away pre-attack (killable
        // on d1 after it lands); C alone would land in the move phase.
        try {
          store.dispatch({
            type: "QUEUE_ACTION",
            action: {
              timing: "B",
              kind: "pawnDouble",
              color: "b",
              from: "d2",
              to: "d1",
              promotion: "q",
            },
          });
          queuedTurn = snap.turn;
        } catch {
          try {
            store.dispatch({
              type: "QUEUE_ACTION",
              action: {
                timing: "C",
                kind: "classical",
                color: "b",
                from: "d2",
                to: "d1",
                promotion: "q",
              },
            });
            queuedTurn = snap.turn;
          } catch {
            /* leave unmarked; retry on next change */
          }
        }
        return;
      }
      const d1 = map.get("d1");
      if (d1?.type === "q" && d1.color === "b") {
        // Pressure c1 — never d4: an immediate Qxd4 would
        // fail the lesson before the player can answer it.
        try {
          store.dispatch({
            type: "QUEUE_ACTION",
            action: { timing: "C", kind: "classical", color: "b", from: "d1", to: "c1" },
          });
          queuedTurn = snap.turn;
        } catch {
          /* leave unmarked; retry on next change */
        }
        return;
      }
      const d7 = map.get("d7");
      if (d7?.type === "p" && d7.color === "b") {
        // 1st-phase gas slips to d6 pre-attack (no promotion off last rank):
        // a tank intent on d7 intercepts at d6 by the collision rules.
        // Falls back to the old C+F stack when the gas step is illegal.
        try {
          store.dispatch({
            type: "QUEUE_ACTION",
            action: { timing: "B", kind: "pawnDouble", color: "b", from: "d7", to: "d6" },
          });
          queuedTurn = snap.turn;
        } catch {
          if (queueGasMove(store, "d7", "d6")) queuedTurn = snap.turn;
        }
        return;
      }
      queuedTurn = snap.turn;
    } catch {
      /* never throw */
    }
  });

  return {};
};
