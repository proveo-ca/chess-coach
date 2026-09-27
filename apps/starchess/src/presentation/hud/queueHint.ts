// SPEC: _spec/apps/starchess/tutorial/hints-and-coach.md, _spec/apps/starchess/architecture/reactivity/tutorial.md
import type { ScAction } from "@chess-coach/starchess-core";
import { createContext, useContext, type Accessor } from "solid-js";

export const queueActionKey = (a: Pick<ScAction, "timing" | "kind" | "from" | "to">): string =>
  a.kind === "classical"
    ? `C=${a.from}${a.to ?? ""}`
    : `${a.timing}=${a.kind}:${a.from}${a.to ? `:${a.to}` : ""}`;

const QueueHintContext = createContext<Accessor<string | null>>(() => null);

/** A lesson host provides the queued action to flag for cancel; HUD rows read it. */
export const QueueHintProvider = QueueHintContext.Provider;

export const useQueueHint = (): Accessor<string | null> => useContext(QueueHintContext);
