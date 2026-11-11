// SPEC: _spec/apps/starchess/architecture/layers.puml
import { createContext, useContext, type ParentComponent } from "solid-js";

import type { MatchStore } from "~/types/match";

export const MatchStoreContext = createContext<MatchStore>();

export const MatchStoreProvider: ParentComponent<{ store: MatchStore }> = (props) => (
  <MatchStoreContext.Provider value={props.store}>{props.children}</MatchStoreContext.Provider>
);

export const useMatchStore = (): MatchStore => {
  const ctx = useContext(MatchStoreContext);
  if (!ctx) throw new Error("useMatchStore requires MatchStoreProvider");
  return ctx;
};
