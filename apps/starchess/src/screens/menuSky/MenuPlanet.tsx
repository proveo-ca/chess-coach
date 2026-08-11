/**
 * StarChess menu sky prop — orbital planet carousel (Tutorial / Credits rim).
 * Worlds arc along a circular path (enter from bottom → park → exit left).
 * Order: Eclipse → Butter → Vermeer.
 */
import { createSignal, onCleanup, onMount, type Component } from "solid-js";

import styles from "~/screens/menuSky/MenuPlanet.module.css";

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
    const timers: number[] = [];
    let charTimer = 0;
    let cancelled = false;

    props.onWorldChange?.(WORLDS[0]!.id);

    const clearChar = () => {
      window.clearInterval(charTimer);
      charTimer = 0;
    };

    const clearTimers = () => {
      for (const id of timers) window.clearTimeout(id);
      timers.length = 0;
    };

    const later = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        const i = timers.indexOf(id);
        if (i >= 0) timers.splice(i, 1);
        if (!cancelled) fn();
      }, ms);
      timers.push(id);
    };

    const startTyping = (label: string) => {
      clearChar();
      setLen(0);
      let i = 0;
      const charMs = TYPE_BUDGET_MS / label.length;
      charTimer = window.setInterval(() => {
        i += 1;
        setLen(i);
        if (i >= label.length) clearChar();
      }, charMs);
    };

    const runWorld = (idx: number) => {
      if (cancelled) return;
      setWorld(idx);
      setLen(0);
      setPhase("enter");

      later(ENTER_MS, () => {
        setPhase("hold");
        startTyping(WORLDS[idx]!.label);

        later(HOLD_MS, () => {
          clearChar();
          setPhase("exit");

          later(EXIT_MS, () => {
            runWorld((idx + 1) % WORLDS.length);
          });
        });
      });
    };

    runWorld(0);

    onCleanup(() => {
      cancelled = true;
      clearChar();
      clearTimers();
    });
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
