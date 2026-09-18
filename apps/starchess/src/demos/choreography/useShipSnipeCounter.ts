// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Ship Snipe Counter — scripted black B queenWarp d5→f1 once on T21.
 * F-vs-F cannot catch a warp (white sorts first inside a timing),
 * so the enemy warps in B (specialBefore) and the player's F snipe
 * (specialAfter) catches the ship after it lands. Generic adjutant
 * untouched.
 */
import { createEffect } from "solid-js";
import { placementToMap } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { ChoreographyResult } from "~/demos/choreography";
import type { MatchStore } from "~/types/match";

const COUNTER_TURN = 21;
const FROM: Square = "d5";
const TO: Square = "f1";

export const useShipSnipeCounter = (store: MatchStore): ChoreographyResult => {
  let queued = false;

  createEffect(() => {
    if (queued) return;
    try {
      const s = store.state();
      if (s.phase !== "planning" && s.phase !== "targeting") return;
      if (!s.turnStartChecksApplied || s.timeline.active) return;
      const snap = s.liveSnapshot;
      if (snap.turn !== COUNTER_TURN || snap.phase !== "P") return;
      if ((snap.queue?.actions ?? []).some((a) => a.color === "b")) return;
      const map = placementToMap(snap.placement);
      const origin = map.get(FROM);
      if (!origin || origin.type !== "q" || origin.color !== "b") return;
      if (map.has(TO)) return;
      queued = true;
      store.dispatch({
        type: "QUEUE_ACTION",
        action: { timing: "B", kind: "queenWarp", color: "b", from: FROM, to: TO },
      });
    } catch {
      queued = false;
    }
  });

  return {};
};
