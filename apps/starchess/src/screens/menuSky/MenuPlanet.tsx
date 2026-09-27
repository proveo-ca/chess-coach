/**
 * StarChess menu sky prop — orbital planet carousel (Tutorial / Credits rim).
 * Worlds arc along a circular path (enter from bottom → park → exit left).
 * Order: Eclipse → Butter → Vermeer.
 */
import { createSignal, onCleanup, onMount, type Component } from "solid-js";

import { repeat } from "~/adapters/timers";
import { createPhaseClock } from "~/presentation/animations/phaseLoop";
import styles from "~/screens/menuSky/MenuPlanet.module.css";
import type { Cancel } from "~/types/ports";

export type MenuWorldId = "eclipse" | "butter" | "vermeer";

type World = {
  id: MenuWorldId;
  label: string;
};

const WORLDS: readonly World[] = [
  { id: "eclipse", label: "ECLIPSE" },
  { id: "butter", label: "BUTTER" },
  { id: "vermeer", label: "VERMEER" },
] as const;

const ENTER_MS = 900;
const EXIT_MS = 900;
const HOLD_MS = 2200;
const TYPE_BUDGET_MS = 1400 / 3;

type Phase = "enter" | "hold" | "exit";

export type MenuPlanetProps = {
  /** Fired when the active world changes (sky wash sync). */
  onWorldChange?: (world: MenuWorldId) => void;
};

export const MenuPlanet: Component<MenuPlanetProps> = (props) => {
  const [worldIdx, setWorldIdx] = createSignal(0);
  const [phase, setPhase] = createSignal<Phase>("enter");
  const [len, setLen] = createSignal(0);

  const world = () => WORLDS[worldIdx()]!;
  const word = () => world().label;
  const shown = () => word().slice(0, len());

  const setWorld = (idx: number) => {
    setWorldIdx(idx);
    props.onWorldChange?.(WORLDS[idx]!.id);
  };

  onMount(() => {
    let stopTyping: Cancel = () => {};

    props.onWorldChange?.(WORLDS[0]!.id);

    const startTyping = (label: string) => {
      stopTyping();
      setLen(0);
      let i = 0;
      stopTyping = repeat(TYPE_BUDGET_MS / label.length, () => {
        i += 1;
        setLen(i);
        if (i >= label.length) stopTyping();
      });
    };

    createPhaseClock(
      [
        [
          0,
          (k) => {
            setWorld(k % WORLDS.length);
            setLen(0);
            setPhase("enter");
          },
        ],
        [
          ENTER_MS,
          (k) => {
            setPhase("hold");
            startTyping(WORLDS[k % WORLDS.length]!.label);
          },
        ],
        [
          ENTER_MS + HOLD_MS,
          () => {
            stopTyping();
            setPhase("exit");
          },
        ],
      ],
      ENTER_MS + HOLD_MS + EXIT_MS,
    );

    onCleanup(() => stopTyping());
  });

  return (
    <div
      class={styles.root}
      data-testid="menu-sky-planet"
      data-world={world().id}
      data-phase={phase()}
      aria-hidden="true"
    >
      <div class={styles.stage}>
        <div
          class={styles.planetMotion}
          data-world={world().id}
          data-active={phase()}
        >
          <div class={styles.planetDisc} data-world={world().id} />
        </div>
      </div>

      <div class={styles.tty}>
        <div class={styles.block} data-tty-len={len()}>
          <span class={styles.text}>{shown()}</span>
          <span
            class={styles.caret}
            data-empty={len() === 0 ? "true" : undefined}
          />
        </div>
        <div class={styles.stem} />
        <div class={styles.dot} />
      </div>
    </div>
  );
};
