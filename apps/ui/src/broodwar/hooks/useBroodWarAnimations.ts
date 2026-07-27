import { createSignal, onCleanup } from "solid-js";

import { ATTACK_MS, FRAG_FLIGHT_MS } from "~/broodwar/animations/attackAnim";
import { DEATH_MS } from "~/broodwar/animations/deathAnim";
import type { AttackCue, DeathCue } from "~/broodwar/animations/types";

let cueSeq = 0;
const nextId = (prefix: string) => `${prefix}-${++cueSeq}-${Date.now()}`;

/**
 * Animation bus for Brood War attack / death cues.
 * Turn resolution feeds cues here; ChessBoard renders via `attackCues` / `deathCues`.
 *
 * Capture rule: when a unit is removed by an attack, call `playCaptured` (alias
 * of `playDeath`) — DeathAnimation owns the VFX. If that unit was mid-attack,
 * call `interruptAttack` so the attack hull clears while target FX finish.
 */
export function useBroodWarAnimations() {
  const [attackCues, setAttackCues] = createSignal<AttackCue[]>([]);
  const [deathCues, setDeathCues] = createSignal<DeathCue[]>([]);
  /** Attack cue ids whose hull is suppressed (unit captured / dying). */
  const [attackDying, setAttackDying] = createSignal<Record<string, boolean>>({});

  const timers: number[] = [];
  const after = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };

  const clearTimers = () => {
    while (timers.length) window.clearTimeout(timers.pop());
  };

  onCleanup(clearTimers);

  const clear = () => {
    clearTimers();
    setAttackCues([]);
    setDeathCues([]);
    setAttackDying({});
  };

  const playAttack = (cue: Omit<AttackCue, "id"> & { id?: string }): Promise<void> => {
    const full: AttackCue = { ...cue, id: cue.id ?? nextId("atk") };
    setAttackCues((prev) => [...prev, full]);
    return new Promise((resolve) => {
      after(ATTACK_MS, () => {
        setAttackCues((prev) => prev.filter((c) => c.id !== full.id));
        setAttackDying((prev) => {
          if (!(full.id in prev)) return prev;
          const next = { ...prev };
          delete next[full.id];
          return next;
        });
        resolve();
      });
    });
  };

  /**
   * Engine: this unit was captured / destroyed — play its death animation.
   * Prefer this over swapping attack hulls; DeathAnimation is the sole death layer.
   */
  const playDeath = (cue: Omit<DeathCue, "id"> & { id?: string }): Promise<void> => {
    const full: DeathCue = { ...cue, id: cue.id ?? nextId("death") };
    setDeathCues((prev) => [...prev, full]);
    return new Promise((resolve) => {
      after(DEATH_MS, () => {
        setDeathCues((prev) => prev.filter((c) => c.id !== full.id));
        resolve();
      });
    });
  };

  /** Alias — capture resolution should call this for every removed unit. */
  const playCaptured = playDeath;

  /** Suppress an in-flight attack hull (keep target impact / frag FX). */
  const interruptAttack = (id: string) => {
    setAttackDying((prev) => ({ ...prev, [id]: true }));
  };

  /** @deprecated Prefer `interruptAttack` — same behavior. */
  const markAttackDying = interruptAttack;

  return {
    attackCues,
    deathCues,
    attackDying,
    playAttack,
    playDeath,
    playCaptured,
    interruptAttack,
    markAttackDying,
    clear,
    /** Frag flight / kill-death alignment. */
    killDeathDelayMs: FRAG_FLIGHT_MS,
    attackMs: ATTACK_MS,
    deathMs: DEATH_MS,
  };
}
