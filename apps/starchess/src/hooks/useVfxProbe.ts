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

  createEffect(
    on(ready, (isReady) => {
      if (!isReady || started) return;
      if (typeof window === "undefined" || typeof requestAnimationFrame !== "function") return;
      if (window.matchMedia?.(REDUCED_MOTION_MQ).matches) return;
      if (!probeIsStale(PROBE_VERSION)) return;
      started = true;
      stop = startVfxProbe(vfxTier(), (result) => {
        stop = undefined;
        recordProbe(result.verdict, PROBE_VERSION, Date.now(), result);
      });
    }),
  );

  onCleanup(() => stop?.());
}
