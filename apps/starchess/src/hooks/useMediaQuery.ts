/**
 * Reactive `matchMedia` — one signal per viewport band.
 * Query strings live in `utils/breakpoints.ts` so JS gates match the CSS bands.
 * // SPEC: _spec/apps/starchess/screens.puml
 */
import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";

/** `false` until mounted, so SSR / test renders never touch `window`. */
export function useMediaQuery(query: string): Accessor<boolean> {
  const [matches, setMatches] = createSignal(false);

  onMount(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    onCleanup(() => mq.removeEventListener("change", sync));
  });

  return matches;
}
