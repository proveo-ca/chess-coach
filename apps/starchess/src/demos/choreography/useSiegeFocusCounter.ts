// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Rook Siege focus counter — deterministic lesson-only black intents.
 * Seed turn 0: SCFEN|7k/3p4/8/8/p2R3p/8/3p4/K7|0|33|P|G:11:11|Q:w:;b:|S:d4
 * Turn 0: classical d2→d1 with promotion q (single action — B+C
 * stacking on one pawn is illegal, so no gas stack here). Later
 * turns: ship on d1 pressures c1 (never d4 — an instant Qxd4
 * would fail the lesson), else single-step pawn pushes
 * (a4→a3, d7→d6). Best-effort, never throws.
 */
import { createEffect } from "solid-js";
import { placementToMap } from "@chess-coach/starchess-core";

import type { ChoreographyResult } from "~/demos/choreography";
import type { MatchStore } from "~/types/match";

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

      if (snap.turn === 0) {
        const d2 = map.get("d2");
        if (!d2 || d2.type !== "p" || d2.color !== "b") {
          queuedTurn = snap.turn;
          return;
        }
        if (map.has("d1")) {
          queuedTurn = snap.turn;
          return;
        }
        queuedTurn = snap.turn;
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
        return;
      }

      const d1 = map.get("d1");
      if (d1?.type === "q" && d1.color === "b") {
        queuedTurn = snap.turn;
        // Pressure c1 — never d4: an immediate Qxd4 would
        // fail the lesson before the player can answer it.
        store.dispatch({
          type: "QUEUE_ACTION",
          action: { timing: "C", kind: "classical", color: "b", from: "d1", to: "c1" },
        });
        return;
      }
      const a4 = map.get("a4");
      if (a4?.type === "p" && a4.color === "b") {
        queuedTurn = snap.turn;
        store.dispatch({
          type: "QUEUE_ACTION",
          action: { timing: "C", kind: "classical", color: "b", from: "a4", to: "a3" },
        });
        return;
      }
      const d7 = map.get("d7");
      if (d7?.type === "p" && d7.color === "b") {
        queuedTurn = snap.turn;
        store.dispatch({
          type: "QUEUE_ACTION",
          action: { timing: "C", kind: "classical", color: "b", from: "d7", to: "d6" },
        });
        return;
      }
      queuedTurn = snap.turn;
    } catch {
      /* never throw */
    }
  });

  return {};
};
