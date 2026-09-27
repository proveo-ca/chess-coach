// SPEC: _spec/apps/starchess/animation-pipeline.md, _spec/apps/starchess/vfx-tier.puml
/**
 * Keep a cue's CSS animations on the game clock.
 *
 * The timeline's wall-clock pace is authoritative (multiplayer clients advance
 * in lockstep), so a cue's slot never stretches. A CSS animation, though, only
 * starts once the browser has styled the freshly mounted cue — on a slow device
 * that first frame can eat most of a 500ms slot, and the cue unmounts with its
 * ending unplayed. `syncToClock` fast-forwards every animation under the cue to
 * the time elapsed since the cue mounted: a late cue drops its opening frames
 * and still lands its ending, exactly when every other client does.
 *
 * Solid mounts a cue synchronously with the store write, so the ref callback's
 * `performance.now()` is the cue's dispatch time. Syncing is batched into one
 * rAF pass per frame for a couple of frames (the first styles the new cues, the
 * next corrects the paint that followed); animations only move forward.
 *
 * The largest seek per cue is its **clock lag** — how late this device starts
 * VFX. `onClockLag` hands it to the menu CPU probe (`vfxProbe.ts`).
 */

/** Frames after mount during which a cue's animations are re-synced. */
const SYNC_FRAMES = 2;
/** Lag below this is left alone — under a frame, not worth a seek. */
const SLACK_MS = 8;

type Pending = { startedAt: number; frames: number; lagMs: number };

const pending = new Map<Element, Pending>();
const lagListeners = new Set<(lagMs: number) => void>();
let frame = 0;

const settle = (el: Element, p: Pending) => {
  pending.delete(el);
  for (const listener of lagListeners) listener(p.lagMs);
};

const pass = () => {
  frame = 0;
  for (const [el, p] of pending) {
    if (!el.isConnected) {
      pending.delete(el);
      continue;
    }
    const elapsed = performance.now() - p.startedAt;
    for (const anim of el.getAnimations({ subtree: true })) {
      if (anim.playState === "finished") continue;
      const lag = elapsed - Number(anim.currentTime ?? 0);
      p.lagMs = Math.max(p.lagMs, lag);
      if (lag > SLACK_MS) anim.currentTime = elapsed;
    }
    if (++p.frames >= SYNC_FRAMES) settle(el, p);
  }
  if (pending.size && !frame) frame = requestAnimationFrame(pass);
};

/** Fast-forward `el`'s CSS animations to the time since `startedAt` (default: now). */
export const syncToClock = (el: Element, startedAt: number = performance.now()): void => {
  if (typeof requestAnimationFrame !== "function" || typeof el.getAnimations !== "function") return;
  pending.set(el, { startedAt, frames: 0, lagMs: 0 });
  if (!frame) frame = requestAnimationFrame(pass);
};

/** Subscribe to each cue's clock lag (ms) once it settles; returns unsubscribe. */
export const onClockLag = (listener: (lagMs: number) => void): (() => void) => {
  lagListeners.add(listener);
  return () => lagListeners.delete(listener);
};
