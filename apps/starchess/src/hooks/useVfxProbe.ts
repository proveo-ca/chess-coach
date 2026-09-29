// SPEC: _spec/apps/starchess/vfx-tier.puml
/**
 * Run the silent VFX CPU probe once `ready()` turns true (menu interactive,
 * arrival done) — only when the stored tier is stale and the player has not
 * asked for reduced motion. Unmounting the host ends it without a verdict.
 */
import { createEffect, on, onCleanup, type Accessor } from "solid-js";

import { PROBE_VERSION, startVfxProbe } from "~/presentation/animations/vfxProbe";
import { REDUCED_MOTION_MQ } from "~/utils/breakpoints";
import { probeIsStale, recordProbe, vfxTier } from "~/store/vfxTierStore";

export function useVfxProbe(ready: Accessor<boolean>): void {
  let started = false;
  let stop: (() => void) | undefined;
  let idleId: number | undefined;

  const start = () => {
    if (started) return;
    if (typeof window === "undefined" || typeof requestAnimationFrame !== "function") return;
    if (document.visibilityState === "hidden") return;
    if (window.matchMedia?.(REDUCED_MOTION_MQ).matches) return;
    if (!probeIsStale(PROBE_VERSION)) return;
    started = true;
    stop = startVfxProbe(vfxTier(), (result) => {
      stop = undefined;
      recordProbe(result.verdict, PROBE_VERSION, Date.now(), result);
    });
  };

  createEffect(
    on(ready, (isReady) => {
      if (!isReady || started) return;
      // Background calibration: never steal first paint / interaction.
      const ric = (window as unknown as { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
      if (typeof ric === "function") {
        idleId = ric(() => start(), { timeout: 2000 }) as unknown as number;
      } else {
        idleId = window.setTimeout(start, 0);
      }
    }),
  );

  onCleanup(() => {
    if (idleId != null) {
      const cic = (window as unknown as { cancelIdleCallback?: typeof cancelIdleCallback }).cancelIdleCallback;
      if (typeof cic === "function") cic(idleId);
      else clearTimeout(idleId);
    }
    stop?.();
  });
}
