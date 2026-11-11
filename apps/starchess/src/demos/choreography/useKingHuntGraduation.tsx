// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml, _spec/apps/starchess/architecture/reactivity/tutorial.md, _spec/apps/starchess/tutorial/hints-and-coach.md
/**
 * King Hunt (live) — the final lesson. When the enemy Command Center dies, hold
 * a beat for the death VFX, then offer graduation and mark the tutorial cleared.
 */
import { Show, createEffect, createMemo, createSignal, type Component } from "solid-js";

import { createDelay } from "~/adapters/timers";
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

  const enemyDown = createMemo(() => {
    const s = store.shell();
    const over =
      s.phase === "gameOver" || s.liveSnapshot.phase === "O" || s.outcome != null;
    return over && s.liveSnapshot.ccLives.b === 0;
  });

  createEffect(() => {
    if (!ctx.tutorial) return;
    if (!enemyDown() || offered) return;
    createDelay(GRADUATION_DELAY_MS, () => {
      offered = true;
      setOpen(true);
    });
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
