// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * King Hunt (live) — the final lesson. When the enemy Command Center dies, hold
 * a beat for the death VFX, then offer graduation and mark the tutorial cleared.
 */
import { Show, createEffect, createSignal, onCleanup, type Component } from "solid-js";

import { TutorialCompleteConfirm } from "~/components/features/TutorialCompleteConfirm";
import type { ChoreographyContext, ChoreographyResult } from "~/demos/choreography";
import { setTutorialCleared } from "~/store/tutorialProgressStore";
import type { MatchStore } from "~/types/match";

/** Hold so the crumple animation reads before the modal covers it. */
const GRADUATION_DELAY_MS = 1200;

export const useKingHuntGraduation = (
  store: MatchStore,
  ctx: ChoreographyContext,
): ChoreographyResult => {
  const [open, setOpen] = createSignal(false);
  let offered = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    if (!ctx.tutorial) return;
    const s = store.state();
    void s.phase;
    void s.liveSnapshot.ccLives.b;
    void s.outcome;
    if (offered) return;
    // Offer whenever the enemy CC dies in this run — even on a replay after
    // the player already cleared once. `cleared` only gates the menu.
    const enemyDead = s.liveSnapshot.ccLives.b === 0;
    const over =
      s.phase === "gameOver" || s.liveSnapshot.phase === "O" || s.outcome != null;
    if (!enemyDead || !over) return;
    offered = true;
    // Deliberately not cleared on effect re-runs — Solid's onCleanup would
    // cancel the pending offer every time the store ticks.
    timer = setTimeout(() => {
      timer = undefined;
      setOpen(true);
    }, GRADUATION_DELAY_MS);
  });

  onCleanup(() => {
    if (timer != null) clearTimeout(timer);
  });

  const Overlay: Component = () => (
    <Show when={ctx.tutorial}>
      <TutorialCompleteConfirm
        open={open()}
        onGoHome={() => {
          setTutorialCleared(true);
          setOpen(false);
          ctx.onExitToMenu?.();
        }}
      />
    </Show>
  );

  return { Overlay };
};
