// SPEC: _spec/apps/starchess/core/turn/turn-bonus-broadcast.puml
import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import type { Component } from "solid-js";

import { useMatchStore } from "~/app/MatchStoreContext";
import { ChatBubble } from "~/components/primitives/ChatBubble";
import {
  MineralsIcon,
  TimerIcon,
  VespeneIcon,
} from "~/components/primitives/icons";
import styles from "~/components/features/TurnBonusBubble.module.css";

const BOARD_ANCHOR = '[data-testid="starchess-board-chrome"]';

export const TurnBonusBubble: Component = () => {
  const store = useMatchStore();
  const dismiss = () => store.dismissTurnBonus();
  const [pos, setPos] = createSignal<{ left: string; top: string } | null>(null);

  const trackBoard = () => {
    const board = document.querySelector(BOARD_ANCHOR)?.getBoundingClientRect();
    if (!board || board.width === 0) return;
    setPos({
      left: `${board.left + board.width / 2}px`,
      top: `${board.top + board.height / 2}px`,
    });
  };

  createEffect(() => {
    if (!store.shell().turnBonus) return;
    trackBoard();
    window.addEventListener("resize", trackBoard);
    onCleanup(() => window.removeEventListener("resize", trackBoard));
  });

  return (
    <Show when={store.shell().turnBonus}>
      {(bonus) => (
        <div
          class={`turn-bonus-slot ${styles.slot}`}
          role="status"
          aria-live="polite"
          style={{
            ...(pos() ?? {
              left: `${window.innerWidth / 2}px`,
              top: `${window.innerHeight / 2}px`,
            }),
            transform: "translate(-50%, -50%)",
          }}
        >
          <ChatBubble
            class="turn-bonus-bubble"
            testId="turn-bonus-bubble"
            label={
              `Turn ${bonus().turn} — +${bonus().minerals} minerals ` +
              `+${bonus().gas} gas, ${bonus().seconds}s clock. Activate to dismiss.`
            }
            onClick={dismiss}
          >
            <span class={`turn-bonus-turn ${styles.turn}`}>
              Turn {bonus().turn}
            </span>
            <span class={`turn-bonus-grant ${styles.grant}`}>
              <span
              class={`turn-bonus-minerals ${styles.stat}`}
              title="Minerals income per turn"
            >
              <MineralsIcon size={15} />
              +{bonus().minerals}
            </span>
            <span class={`turn-bonus-gas ${styles.stat}`} title="Vespene gas cap this turn">
              <VespeneIcon size={15} />
              +{bonus().gas}
            </span>
            <span class={`turn-bonus-clock ${styles.stat}`} title="Planning clock this turn">
              <TimerIcon size={15} value={`${bonus().seconds}s`} />
            </span>
            </span>
          </ChatBubble>
        </div>
      )}
    </Show>
  );
};
