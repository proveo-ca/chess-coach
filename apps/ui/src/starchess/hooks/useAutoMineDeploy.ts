/**
 * Board-level spider-mine deploy: when a mine appears on the map, burrow legs
 * over {@link MINE_DEPLOY_MS} (per-leg random), then idle.
 */

import type { Color, Square } from "chess.js";
import { createEffect, createSignal, onCleanup } from "solid-js";

import { MINE_DEPLOY_MS } from "~/starchess/constants";
import {
  mineDeployCuesForDiff,
  type MineAt,
} from "~/starchess/mines/mineDeploy";
import type { MineDeployCue } from "~/starchess/types";

export function useAutoMineDeploy(opts: {
  mines: () => readonly MineAt[];
  /** When false, re-baseline without burrow VFX (DualNav scrub). */
  enabled?: () => boolean;
}) {
  const [cues, setCues] = createSignal<MineDeployCue[]>([]);
  let prev: MineAt[] | null = null;
  const timers = new Map<string, number>();

  const clearTimers = () => {
    for (const id of timers.values()) window.clearTimeout(id);
    timers.clear();
  };

  onCleanup(clearTimers);

  createEffect(() => {
    const enabled = opts.enabled?.() ?? true;
    const next = [...opts.mines()];
    if (!enabled) {
      clearTimers();
      setCues([]);
      prev = next;
      return;
    }
    if (!prev) {
      prev = next;
      return;
    }
    const fresh = mineDeployCuesForDiff(prev, next);
    prev = next;
    if (fresh.length === 0) return;

    setCues((cur) => [...cur, ...fresh]);
    for (const cue of fresh) {
      const existing = timers.get(cue.id);
      if (existing) window.clearTimeout(existing);
      timers.set(
        cue.id,
        window.setTimeout(() => {
          timers.delete(cue.id);
          setCues((cur) => cur.filter((c) => c.id !== cue.id));
        }, MINE_DEPLOY_MS),
      );
    }
  });

  const deployingAt = () => new Set(cues().map((c) => c.at));
  const cueAt = (sq: Square): MineDeployCue | undefined =>
    cues().find((c) => c.at === sq);

  return { mineDeployCues: cues, deployingAt, cueAt };
}

export type { MineAt };
export type { Color };
