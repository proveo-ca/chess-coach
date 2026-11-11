// SPEC: _spec/apps/starchess/vfx-tier.puml
/**
 * Run the silent VFX CPU probe once `ready()` turns true (menu interactive,
 * arrival done) — only when the stored tier is stale and the player has not
 * asked for reduced motion. Unmounting the host ends it without a verdict.
 */
import { createEffect, on, onCleanup, type Accessor } from "solid-js";

import { whenIdle } from "~/adapters/timers";
import { PROBE_VERSION, startVfxProbe } from "~/presentation/animations/vfxProbe";
import { REDUCED_MOTION_MQ } from "~/utils/breakpoints";
import { probeIsStale, recordProbe, vfxTier } from "~/store/vfxTierStore";
import type { Cancel } from "~/types/ports";

const IDLE_TIMEOUT_MS = 2000;

export function useVfxProbe(ready: Accessor<boolean>): void {
  let started = false;
  let stop: (() => void) | undefined;
  let cancelIdle: Cancel | undefined;
  let onVisible: (() => void) | undefined;

  const clearIdle = () => {
    cancelIdle?.();
    cancelIdle = undefined;
  };

  const start = () => {
    if (started) return;
    if (typeof window === "undefined" || typeof requestAnimationFrame !== "function") return;
    if (document.visibilityState === "hidden") {
      // Retry when visible instead of dropping the stale probe silently.
      if (!onVisible) {
        onVisible = () => {
          if (document.visibilityState === "visible") {
            document.removeEventListener("visibilitychange", onVisible!);
            onVisible = undefined;
            start();
          }
        };
        document.addEventListener("visibilitychange", onVisible);
      }
      return;
    }
    if (window.matchMedia?.(REDUCED_MOTION_MQ).matches) return;
    if (!probeIsStale(PROBE_VERSION)) return;
    started = true;
    clearIdle();
    stop = startVfxProbe(vfxTier(), (result) => {
      stop = undefined;
      recordProbe(result.verdict, PROBE_VERSION, Date.now(), result);
    });
  };

  const schedule = () => {
    if (started || cancelIdle) return;
    // Background calibration: never steal first paint / interaction.
    cancelIdle = whenIdle(() => {
      cancelIdle = undefined;
      start();
    }, IDLE_TIMEOUT_MS);
  };

  createEffect(
    on(ready, (isReady) => {
      if (!isReady) return;
      schedule();
    }),
  );

  onCleanup(() => {
    clearIdle();
    if (onVisible) document.removeEventListener("visibilitychange", onVisible);
    stop?.();
  });
}
