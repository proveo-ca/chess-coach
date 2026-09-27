// SPEC: _spec/apps/starchess/tutorial/hints-and-coach.md
import type { ScAction } from "@chess-coach/starchess-core";
import { createSignal } from "solid-js";

export const queueActionKey = (a: Pick<ScAction, "timing" | "kind" | "from" | "to">): string =>
  a.kind === "classical"
    ? `C=${a.from}${a.to ?? ""}`
    : `${a.timing}=${a.kind}:${a.from}${a.to ? `:${a.to}` : ""}`;

const [queueHint, setQueueHint] = createSignal<string | null>(null);

export { queueHint, setQueueHint };
