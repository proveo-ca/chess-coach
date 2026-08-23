import type { EndScTurnResult } from "@chess-coach/starchess-core";

import { projectResolveTimeline } from "~/presentation/timeline/timelinePlayer";
import type { TimelineCue } from "~/types/match";
import type { ResolveWaveId } from "~/types/tutorial";

export type { ResolveWaveId } from "~/types/tutorial";

export type ResolveWave = {
  id: ResolveWaveId;
  label: string;
  cues: TimelineCue[];
};

const WAVE_ORDER: ResolveWaveId[] = [
  "specialBefore",
  "attack",
  "move",
  "specialAfter",
];

const WAVE_LABEL: Record<ResolveWaveId, string> = {
  specialBefore: "Special",
  attack: "Attack",
  move: "Move",
  specialAfter: "Special",
};

/**
 * Partition projected cues into the four resolve waves.
 * Gas drops after the first classical move belong to specialAfter.
 */
export const splitResolveWaves = (result: EndScTurnResult): ResolveWave[] => {
  const cues = projectResolveTimeline(result);
  const buckets: Record<ResolveWaveId, TimelineCue[]> = {
    specialBefore: [],
    attack: [],
    move: [],
    specialAfter: [],
  };

  let seenClassicalMove = false;
  for (const cue of cues) {
    // Crush deaths + arrival blasts are joined to their spawn deploy (same
    // drop window) — keep them in the deploy's wave bucket rather than
    // treating them as attacks. Lane-based: fcrush/farmm/farmd ride the same
    // lanes as their B-rank siblings.
    if (
      cue.kind === "death" &&
      (cue.lane === "crush" || cue.lane === "arrivalBlast")
    ) {
      buckets[seenClassicalMove ? "specialAfter" : "specialBefore"].push(cue);
      continue;
    }
    if (cue.kind === "move" && !cue.queenJump && !cue.stim) {
      seenClassicalMove = true;
      buckets.move.push(cue);
      continue;
    }
    if (cue.kind === "gasDrop" && seenClassicalMove) {
      buckets.specialAfter.push(cue);
      continue;
    }
    if (cue.kind === "move" && cue.stim && seenClassicalMove) {
      buckets.specialAfter.push(cue);
      continue;
    }
    if (cue.kind === "deploy" && seenClassicalMove) {
      buckets.specialAfter.push(cue);
      continue;
    }
    if (cue.kind === "attack" && cue.anim) {
      buckets.specialBefore.push(cue);
      continue;
    }
    if (
      cue.kind === "death" &&
      !seenClassicalMove &&
      buckets.specialBefore.length
    ) {
      const last = buckets.specialBefore[buckets.specialBefore.length - 1];
      if (last?.kind === "attack" && last.anim) {
        buckets.specialBefore.push(cue);
        continue;
      }
    }
    if (cue.kind === "gasDrop" || cue.kind === "deploy") {
      buckets.specialBefore.push(cue);
      continue;
    }
    if (cue.kind === "move" && (cue.stim || cue.queenJump)) {
      buckets.specialBefore.push(cue);
      continue;
    }
    if (cue.kind === "attack" || cue.kind === "death") {
      buckets.attack.push(cue);
      continue;
    }
    buckets.move.push(cue);
  }

  return WAVE_ORDER.filter((id) => buckets[id].length > 0).map((id) => ({
    id,
    label: WAVE_LABEL[id],
    cues: buckets[id],
  }));
};

export const presentResolveWaveIds = (result: EndScTurnResult): ResolveWaveId[] =>
  splitResolveWaves(result).map((w) => w.id);
