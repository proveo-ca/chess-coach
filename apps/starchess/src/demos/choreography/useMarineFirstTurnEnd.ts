// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Marine lesson — end the first planning window once a classical is queued.
 * Specials lessons run `turnChrome="none"` (no End button), so the window
 * only ever ends on `moveAndSpecial` auto-End — both intents stacked, which
 * is also the lesson's completion. The lesson needs two windows (move first,
 * gas + ghost second), so this hook submits window 1 as soon as the player
 * queues a classical with no special stacked yet. Later windows are
 * untouched: `moveAndSpecial` owns the both-stacked ending. The submit
 * defers to a microtask — same pattern as `useKingDefenseOpening` and
 * BaseScreen's auto-End — so it never nests inside another dispatch.
 * Best-effort, never throws.
 */
import { createEffect } from "solid-js";

import type { ChoreographyResult } from "~/demos/choreography";
import type { MatchStore } from "~/types/match";

/** Seed SCFEN turn field — the first planning window of this lesson. */
const FIRST_TURN = 1;

export const useMarineFirstTurnEnd = (store: MatchStore): ChoreographyResult => {
  let armed = false;

  createEffect(() => {
    if (armed) return;
    const s = store.state();
    if (s.phase !== "planning" && s.phase !== "targeting") return;
    if (s.timeline.active) return;
    const snap = s.liveSnapshot;
    if (snap.turn !== FIRST_TURN || snap.phase !== "P") return;
    const mine = (snap.queue?.actions ?? []).filter((a) => a.color === "w");
    if (!mine.some((a) => a.timing === "C")) return;
    // Both stacked is the lesson's own ending — moveAndSpecial owns it.
    if (mine.some((a) => a.timing !== "C")) return;
    armed = true;
    queueMicrotask(() => {
      try {
        const cur = store.state();
        if (cur.phase !== "planning" && cur.phase !== "targeting") {
          armed = false;
          return;
        }
        const live = cur.liveSnapshot;
        if (live.turn !== FIRST_TURN || live.phase !== "P") return;
        const queued = (live.queue?.actions ?? []).filter((a) => a.color === "w");
        if (!queued.some((a) => a.timing === "C") || queued.some((a) => a.timing !== "C")) {
          armed = false;
          return;
        }
        // submitTurn runs the turn-open checks itself when they are pending.
        store.submitTurn("end");
      } catch {
        armed = false;
      }
    });
  });

  return {};
};
