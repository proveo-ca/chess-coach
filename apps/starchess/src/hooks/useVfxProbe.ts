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
  let idleKind: "idle" | "timeout" | undefined;
  let idleId: number | undefined;
  let onVisible: (() => void) | undefined;

  const clearIdle = () => {
    if (idleId == null) return;
    if (idleKind === "idle") {
      const cic = (window as unknown as { cancelIdleCallback?: typeof cancelIdleCallback })
        .cancelIdleCallback;
      if (typeof cic === "function") cic(idleId);
      else clearTimeout(idleId);
    } else {
      clearTimeout(idleId);
    }
    idleId = undefined;
    idleKind = undefined;
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
    if (started || idleId != null) return;
    // Background calibration: never steal first paint / interaction.
    const ric = (window as unknown as { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback;
    if (typeof ric === "function") {
      idleKind = "idle";
      idleId = ric(() => {
        idleId = undefined;
        idleKind = undefined;
        start();
      }, { timeout: 2000 }) as unknown as number;
    } else {
      idleKind = "timeout";
      idleId = window.setTimeout(() => {
        idleId = undefined;
        idleKind = undefined;
        start();
      }, 0);
    }
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
