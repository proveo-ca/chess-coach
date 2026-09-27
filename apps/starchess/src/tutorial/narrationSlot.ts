// SPEC: _spec/apps/starchess/architecture/reactivity/tutorial.md
import { createMemo, createSignal, onCleanup, untrack, type Accessor } from "solid-js";

import { sameStructure } from "~/tutorial/sameStructure";
import type { NarrationSink, TutorialNarrationState } from "~/types/tutorial";

const NO_NARRATION: TutorialNarrationState = {};
const silent: Accessor<TutorialNarrationState> = () => NO_NARRATION;

/** The tutorial screen's one narration reader; the mounted host is its one writer. */
export const createNarrationSlot = (): {
  narration: Accessor<TutorialNarrationState>;
  provide: NarrationSink;
} => {
  const [source, setSource] = createSignal(silent);
  const narration = createMemo(() => source()(), NO_NARRATION, { equals: sameStructure });
  const provide: NarrationSink = (next) => {
    setSource(() => next);
    onCleanup(() => {
      if (untrack(source) === next) setSource(() => silent);
    });
  };
  return { narration, provide };
};
